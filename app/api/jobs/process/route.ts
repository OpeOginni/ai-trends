import db from '@/db';
import { entities, models, prompts, promptJobs, responses, promptRuns } from '@/db/schema';
import { generateObject, generateText } from 'ai';
import { eq, and, sql } from 'drizzle-orm';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { z } from 'zod';
import { polishEntity } from '@/lib/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== process.env.CRON_SECRET) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const { jobId } = await request.json();

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // Atomically claim the job - update status from queued to processing
        const [job] = await db
            .update(promptJobs)
            .set({
                status: 'processing',
                startedAt: new Date(),
                attemptCount: sql`${promptJobs.attemptCount} + 1`,
            })
            .where(and(
                eq(promptJobs.id, jobId),
                eq(promptJobs.status, 'queued')
            ))
            .returning();

        // If no job was updated, it's either already processed or doesn't exist
        if (!job) {
            // Check if job exists
            const [existingJob] = await db
                .select()
                .from(promptJobs)
                .where(eq(promptJobs.id, jobId));

            if (!existingJob) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            // Job already processed (idempotent)
            console.log(`⏭️ Job ${jobId} already ${existingJob.status}, skipping...`);
            return NextResponse.json({
                success: true,
                jobId,
                status: existingJob.status,
                message: 'Job already processed'
            });
        }

        console.log(`\n🔄 Processing job ${jobId}...`);
        console.log(`📋 Prompt Run ID: ${job.promptRunId}, Model ID: ${job.modelId}, Run: ${job.runIndex + 1}`);

        try {
            // Fetch the prompt and model
            const [promptRun] = await db.select().from(promptRuns).where(eq(promptRuns.id, job.promptRunId)).leftJoin(prompts, eq(promptRuns.promptId, prompts.id));
            const [model] = await db.select().from(models).where(eq(models.id, job.modelId));

            if (!promptRun || !promptRun.prompts || !model) {
                throw new Error(`Prompt or model not found: promptId=${job.promptRunId}, modelId=${job.modelId}`);
            }

            console.log(`📝 Prompt: "${promptRun.prompts.question}"`);
            console.log(`🤖 Model: ${model.provider}/${model.name}`);

            // Set up SDK
            const openRouter = createOpenRouter({
                apiKey: process.env.OPENROUTER_API_KEY as string,
            });

            const openAIRouter = createOpenAI({
                apiKey: process.env.OPENAI_API_KEY as string,
            });

            // Define strict schema for entity extraction
            const entitySchema = z.object({
                entity: z.string()
                    .min(1, "Entity cannot be empty")
                    .max(64, "Entity name too long")
                    .describe("The single entity name only, with no explanations or extra text")
            });

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
                    prompt: promptRun.prompts.question,
                    output: "object",
                    schema: entitySchema,
                    temperature: model.temperature ? 0.3 : undefined, // Lower temperature for more focused responses
                });

                output = response.object.entity;
            } catch (error) {
                console.error(`  ⚠️ Object generation failed, trying text fallback:`, error);

                const textResponse = await generateText({
                    model: sdkModel,
                    system: SYSTEM_PROMPT,
                    prompt: promptRun.prompts.question,
                    temperature: model.temperature ? 0.3 : undefined,
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
                    category: promptRun.prompts.category,
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
                promptId: promptRun.prompts.id,
                modelId: model.id,
                entityId: entity.id,
                responseText: output,
            });

            console.log(`  💾 Saved to DB (Entity ID: ${entity.id})`);

            // Mark job as succeeded
            await db
                .update(promptJobs)
                .set({
                    status: 'succeeded',
                    finishedAt: new Date(),
                })
                .where(eq(promptJobs.id, jobId));
            
            await db.update(promptRuns).set({
                successfulJobs: sql`${promptRuns.successfulJobs} + 1`,
            }).where(eq(promptRuns.id, job.promptRunId));

            console.log(`✅ Job ${jobId} completed successfully\n`);

            return NextResponse.json({
                success: true,
                jobId,
                promptRunId: job.promptRunId,
                status: 'succeeded',
                entityId: entity.id
            });

        } catch (error) {
            // Mark job as failed with error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await db
                .update(promptJobs)
                .set({
                    status: 'failed',
                    errorMessage,
                    finishedAt: new Date(),
                })
                .where(eq(promptJobs.id, jobId));

            await db.update(promptRuns).set({
                successfulJobs: sql`${promptRuns.successfulJobs} + 1`,
                failedJobs: sql`${promptRuns.failedJobs} + 1`,
            }).where(eq(promptRuns.id, job.promptRunId));

            console.error(`❌ Job ${jobId} failed:`, errorMessage);

            return NextResponse.json({
                success: false,
                jobId,
                status: 'failed',
                error: errorMessage
            }, { status: 500 });
        }

    } catch (error) {
        console.error('\n❌ Error processing job:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

