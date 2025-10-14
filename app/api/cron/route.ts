import db from '@/db';
import { models, prompts, promptJobs } from '@/db/schema';
import { eq, and, or, isNull, lt, inArray } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {

    const authHeader = request.headers.get('authorization');

    if (authHeader !== process.env.CRON_SECRET) {
        return new Response('Unauthorized', {
          status: 401,
        });
      }

    try {
        console.log('\n⏰ Cron job triggered - checking for due prompts...');
        
        // Calculate the cutoff time for daily prompts (24 hours ago)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Fetch prompts that are due (active, daily frequency, and either never run or last run > 24h ago)
        const duePrompts = await db
            .select()
            .from(prompts)
            .where(
                and(
                    eq(prompts.active, true),
                    eq(prompts.frequency, 'daily'),
                    or(
                        isNull(prompts.lastRunAt),
                        lt(prompts.lastRunAt, oneDayAgo)
                    )
                )
            );

        if (duePrompts.length === 0) {
            console.log('✅ No prompts due for processing\n');
            return NextResponse.json({
                success: true,
                message: 'No prompts due for processing',
                promptCount: 0,
            });
        }

        console.log(`📋 Found ${duePrompts.length} due prompt(s)\n`);

        // Generate batch key (YYYY-MM-DD in UTC)
        const now = new Date();
        const batchKey = now.toISOString().split('T')[0];

        let totalJobsCreated = 0;
        const jobsToTrigger: number[] = [];

        // Create jobs for each prompt
        for (const prompt of duePrompts) {
            console.log(`📝 Enqueuing jobs for: "${prompt.question}" (ID: ${prompt.id})`);

            // Get model IDs for this prompt
            const modelIds = prompt.models.map((m: { id: number }) => m.id);
            
            // Fetch full model details
            const promptModels = await db
                .select()
                .from(models)
                .where(inArray(models.id, modelIds));

            // Cap runs at 10 for safety
            const runs = Math.min(prompt.runs, 10);

            // Create jobs for each model and run
            for (const model of promptModels) {
                for (let runIndex = 0; runIndex < runs; runIndex++) {
                    try {
                        const [job] = await db
                            .insert(promptJobs)
                            .values({
                                promptId: prompt.id,
                                modelId: model.id,
                                runIndex,
                                batchKey,
                                status: 'queued',
                                scheduledFor: now,
                            })
                            .onConflictDoNothing()
                            .returning({ id: promptJobs.id });

                        if (job) {
                            totalJobsCreated++;
                            jobsToTrigger.push(job.id);
                            console.log(`  ✅ Created job ${job.id} for ${model.provider}/${model.name} (run ${runIndex + 1}/${runs})`);
                        } else {
                            console.log(`  ⏭️ Job already exists for ${model.provider}/${model.name} (run ${runIndex + 1}/${runs})`);
                        }
                    } catch (error) {
                        console.error(`  ❌ Failed to create job for model ${model.id}, run ${runIndex}:`, error);
                    }
                }
            }

            // Update lastRunAt for this prompt to prevent re-enqueuing
            await db
                .update(prompts)
                .set({ lastRunAt: now })
                .where(eq(prompts.id, prompt.id));
        }

        console.log(`\n🔒 Created ${totalJobsCreated} new job(s), triggering processors...\n`);

        // Trigger processing for each job (fire and forget)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const triggerPromises = jobsToTrigger.map(async (jobId) => {
            try {
                fetch(`${baseUrl}/api/jobs/process`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `${process.env.CRON_SECRET}`,
                    },
                    body: JSON.stringify({ jobId }),
                }).catch((error) => {
                    console.error(`❌ Failed to trigger job ${jobId}:`, error);
                });
            } catch (error) {
                console.error(`❌ Error triggering job ${jobId}:`, error);
            }
        });

        // Fire and forget
        Promise.allSettled(triggerPromises);

        console.log(`✅ Cron job complete - enqueued ${totalJobsCreated} job(s) for ${duePrompts.length} prompt(s)\n`);

        return NextResponse.json({
            success: true,
            message: `Enqueued ${totalJobsCreated} jobs for ${duePrompts.length} prompts`,
            promptCount: duePrompts.length,
            jobsCreated: totalJobsCreated,
            batchKey,
        });
    } catch (error) {
        console.error('\n❌ Error in cron job:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}