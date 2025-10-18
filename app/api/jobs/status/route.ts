import db from '@/db';
import { promptJobs, prompts, models, promptRuns } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== process.env.CRON_SECRET) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const promptRunId = searchParams.get('promptRunId');
        const batchKey = searchParams.get('batchKey');
        const promptId = searchParams.get('promptId');
        const status = searchParams.get('status');

        let query = db.select({
            job: promptJobs,
            prompt: {
                id: prompts.id,
                question: prompts.question,
                category: prompts.category,
            },
            model: {
                id: models.id,
                name: models.name,
                provider: models.provider,
            }
        })
        .from(promptJobs)
        .leftJoin(promptRuns, eq(promptJobs.promptRunId, promptRuns.id))
        .leftJoin(prompts, eq(promptRuns.promptId, prompts.id))
        .leftJoin(models, eq(promptJobs.modelId, models.id))
        .orderBy(desc(promptJobs.createdAt))
        .limit(100);

        // Apply filters
        const conditions = [];
        if (jobId) {
            conditions.push(eq(promptJobs.id, jobId));
        }
        if (promptRunId) {
            conditions.push(eq(promptRuns.id, promptRunId));
        }
        if (promptId) {
            conditions.push(eq(promptRuns.promptId, promptId));
        }
        if (batchKey) {
            conditions.push(eq(promptRuns.batchKey, batchKey));
        }
        
        if (status) {
            conditions.push(eq(promptJobs.status, status));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as any;
        }

        const jobs = await query;

        // Calculate summary stats
        const summary = {
            total: jobs.length,
            queued: jobs.filter(j => j.job.status === 'queued').length,
            processing: jobs.filter(j => j.job.status === 'processing').length,
            succeeded: jobs.filter(j => j.job.status === 'succeeded').length,
            failed: jobs.filter(j => j.job.status === 'failed').length,
            skipped: jobs.filter(j => j.job.status === 'skipped').length,
        };

        return NextResponse.json({
            success: true,
            summary,
            jobs,
        });
    } catch (error) {
        console.error('Error fetching job status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

