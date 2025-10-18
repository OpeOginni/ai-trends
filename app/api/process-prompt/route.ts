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

async function processPrompt(promptId: string) {
    // Fetch the specific prompt
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId));

    if (!prompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    console.log('\n🔄 Starting prompt processing...');
    console.log(`📝 Prompt: "${prompt.question}"`);
    console.log(`📊 Category: ${prompt.category}`);

    const openRouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY as string,
    });

    const openAIRouter = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY as string,
    });

    // Get the models for this prompt
    const promptModels = await db.select().from(models).where(inArray(models.id, prompt.models.map((model: any) => model.id)));
    const runs = Math.min(prompt.runs, 10); // Cap runs at 10 for safety

    console.log(`🤖 Processing ${promptModels.length} model(s) with ${runs} run(s) each\n`);

    // Define strict schema for entity extraction
    const entitySchema = z.object({
        entity: z.string()
            .min(1, "Entity cannot be empty")
            .max(64, "Entity name too long")
            .describe("The single entity name only, with no explanations or extra text")
    });

    // Process each model
    for (const model of promptModels) {
        console.log(`\n🔹 Model: ${model.provider}/${model.name} for prompt ${prompt.id}`);
        
        for (let i = 0; i < runs; i++) {
            console.log(`  Run ${i + 1}/${runs}...`);
            
            let output = "";
            let sdkModel;

            // Set up the correct SDK model
            if (model.provider === "openai") {
                sdkModel = openAIRouter(model.name);
            } else {
                sdkModel = openRouter(model.name);
            }

            try {
                // Always use generateObject for consistency and better output
                const response = await generateObject({
                    model: sdkModel,
                    system: SYSTEM_PROMPT,
                    prompt: prompt.question,
                    output: "object",
                    schema: entitySchema,
                    temperature: model.temperature ? 0.3 : undefined, // Lower temperature for more focused responses
                });

                output = response.object.entity;
            } catch (error) {
                console.error(`  ⚠️ Object generation failed, trying text fallback:`, error);
                
                // Fallback to text generation if object generation fails
                const { generateText } = await import('ai');
                const textResponse = await generateText({
                    model: sdkModel,
                    system: SYSTEM_PROMPT,
                    prompt: prompt.question,
                    temperature: 0.3,
                });
                output = textResponse.text;
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
            });

            console.log(`  💾 Saved to DB (Entity ID: ${entity.id})`);
        }
    }

    console.log('\n✅ Processing complete!\n');
    return NextResponse.json({ success: true, promptId });
}

