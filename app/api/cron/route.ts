import db from '@/db';
import { prompts } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // Fetch scheduled prompts
        const scheduledPrompts = await db
            .select()
            .from(prompts)
            .where(and(eq(prompts.frequency, 'daily'), isNotNull(prompts.lastRunAt)));

        // Trigger processing for each prompt without awaiting
        const processPromises = scheduledPrompts.map(async (prompt) => {
            try {
                // Call the process-prompt API for each prompt
                // Using fetch without await so we don't block
                fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-prompt`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ promptId: prompt.id }),
                }).catch((error) => {
                    console.error(`Failed to trigger processing for prompt ${prompt.id}:`, error);
                });
            } catch (error) {
                console.error(`Error triggering prompt ${prompt.id}:`, error);
            }
        });

        // Don't await the promises - just fire and forget
        Promise.allSettled(processPromises);

        return NextResponse.json({
            success: true,
            message: `Triggered processing for ${scheduledPrompts.length} prompts`,
            promptCount: scheduledPrompts.length,
        });
    } catch (error) {
        console.error('Error in cron job:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}