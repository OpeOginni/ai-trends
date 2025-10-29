import db from '@/db';
import { entities, models, prompts, responses } from '@/db/schema';
import { generateObject } from 'ai';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { z } from 'zod';
import { polishEntity } from '@/lib/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { AnthropicWebSearchToolSchemaType } from '@/server/providers/anthropic';
import * as openAI from "@/server/providers/openai"
import * as anthropic from "@/server/providers/anthropic"
import * as google from "@/server/providers/google"
import * as openrouter from "@/server/providers/openrouter"

// Simple in-memory cache for idempotency (expires after 5 minutes)
const processingCache = new Map<number, { timestamp: number; promise: Promise<any> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// DEPRECATED: This endpoint is kept for backward compatibility
// New implementations should use the job queue system:
// - POST /api/cron to enqueue jobs
// - POST /api/jobs/process to process individual jobs
// See JOBS_SYSTEM.md for details

export async function POST(request: NextRequest) {
    console.warn('⚠️ DEPRECATED: /api/process-prompt is deprecated. Use job queue system instead.');
    
    const authHeader = request.headers.get('authorization');

    if (authHeader !== process.env.CRON_SECRET) {
        return new Response('Unauthorized', {
          status: 401,
        });
      }

    try {
        const { promptId } = await request.json();

        if (!promptId) {
            return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
        }

        // Clean up expired cache entries
        const now = Date.now();
        for (const [key, value] of processingCache.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
                processingCache.delete(key);
            }
        }

        // Check if this prompt is already being processed
        const cached = processingCache.get(promptId);
        if (cached) {
            console.log(`⏭️ Prompt ${promptId} already processing, skipping duplicate...`);
            return NextResponse.json({ 
                success: true, 
                promptId, 
                message: 'Already processing' 
            });
        }

        // Create processing promise
        const processingPromise = processPrompt(promptId);
        processingCache.set(promptId, { timestamp: now, promise: processingPromise });

        const result = await processingPromise;
        
        // Remove from cache after completion
        processingCache.delete(promptId);
        
        return result;
    } catch (error) {
        console.error('\n❌ Error processing prompt:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function processPrompt(promptId: string, useWebSearchTool: boolean = false, webSearchConfig?: AnthropicWebSearchToolSchemaType) {
    // Fetch the specific prompt
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId));

    if (!prompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    console.log('\n🔄 Starting prompt processing...');
    console.log(`📝 Prompt: "${prompt.question}"`);
    console.log(`📊 Category: ${prompt.category}`);

    // Get the models for this prompt
    const promptModels = await db.select().from(models).where(inArray(models.id, prompt.models.map((model: any) => model.id)));

    const runs = Math.min(prompt.runs, 10); // Cap runs at 10 for safety

    console.log(`🤖 Processing ${promptModels.length} model(s) with ${runs} run(s) each\n`);

    // Process each model
    for (const model of promptModels) {
        console.log(`\n🔹 Model: ${model.provider}/${model.name} for prompt ${prompt.id}`);
        
        for (let i = 0; i < runs; i++) {
            console.log(`  Run ${i + 1}/${runs}...`);

            let output = "";
            let webSources: string[] | null = null;

            if (useWebSearchTool) {
                switch (model.provider) {
                    case "openai":
                        const openAIResponse = await openAI.getResponseWithWebSearch(prompt.id, {name: model.name, temperature: model.temperature})
                        output = openAIResponse.response;
                        webSources = openAIResponse.sources;
                    case "google":
                        const googleResponse = await google.getResponseWithWebSearch(prompt.id, {name: model.name, temperature: model.temperature})
                        output = googleResponse.response;
                        webSources = googleResponse.sources;
                    case "anthropic":
                        const anthropicResponse = await anthropic.getResponseWithWebSearch(prompt.id, {name: model.name, temperature: model.temperature})
                        output = anthropicResponse.response;
                        webSources = anthropicResponse.sources
                    default:
                        const openrouterResponse = await openrouter.getResponseWithWebSearch(prompt.id, {name: model.name, temperature: model.temperature})
                        output = openrouterResponse.response;
                        webSources = openrouterResponse.sources;
                }
            } else {
                switch (model.provider) {
                    case "openai":
                        const openAIResponse = await openAI.getResponse(prompt.id, {name: model.name, temperature: model.temperature})
                        output = openAIResponse.response;
                    case "google":
                        const googleResponse = await google.getResponse(prompt.id, {name: model.name, temperature: model.temperature})
                        output = googleResponse.response;
                    case "anthropic":
                        const anthropicResponse = await anthropic.getResponse(prompt.id, {name: model.name, temperature: model.temperature})
                        output = anthropicResponse.response;
                    default:
                        const openrouterResponse = await openrouter.getResponse(prompt.id, {name: model.name, temperature: model.temperature})
                        output = openrouterResponse.response;
                }
            }

            console.log(`  ✅ Response: "${output}"`);

            const polishedOutput = polishEntity(output);
            console.log(`  ✨ Polished: "${polishedOutput}"`);

            // Upsert entity - either insert new or get existing
            const [entity] = await db
                .insert(entities)
                .values({ 
                    name: polishedOutput, 
                    category: prompt.category,
                    totalMentions: 1,
                    lastMentionedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: [entities.name],
                    set: { 
                        lastMentionedAt: new Date(),
                        totalMentions: sql`${entities.totalMentions} + 1`
                    }
                })
                .returning({ id: entities.id });

            // Insert response
            await db.insert(responses).values({
                promptId: prompt.id,
                modelId: model.id,
                entityId: entity.id,
                responseText: output,
                webSearchSources: webSources,
            });

            console.log(`  💾 Saved to DB (Entity ID: ${entity.id})`);
        }
    }

    console.log('\n✅ Processing complete!\n');
    return NextResponse.json({ success: true, promptId });
}

