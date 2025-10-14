import db from '@/db';
import { prompts } from '@/db/schema';
import { eq, and, or, isNull, lt, sql, inArray } from 'drizzle-orm';
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

        // Update lastRunAt for all due prompts BEFORE triggering to prevent duplicates
        const promptIds = duePrompts.map(p => p.id);
        await db
            .update(prompts)
            .set({ lastRunAt: new Date() })
            .where(inArray(prompts.id, promptIds));

        console.log('🔒 Marked prompts as processing...\n');

        // Trigger processing for each prompt
        const processPromises = duePrompts.map(async (prompt) => {
            try {
                console.log(`🚀 Triggering: "${prompt.question}" (ID: ${prompt.id})`);
                
                fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-prompt`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `${process.env.CRON_SECRET}`,
                    },
                    body: JSON.stringify({ promptId: prompt.id }),
                }).catch((error) => {
                    console.error(`❌ Failed to trigger prompt ${prompt.id}:`, error);
                });
            } catch (error) {
                console.error(`❌ Error triggering prompt ${prompt.id}:`, error);
            }
        });

        // Fire and forget
        Promise.allSettled(processPromises);

        console.log(`\n✅ Cron job complete - triggered ${duePrompts.length} prompt(s)\n`);

        return NextResponse.json({
            success: true,
            message: `Triggered processing for ${duePrompts.length} prompts`,
            promptCount: duePrompts.length,
        });
    } catch (error) {
        console.error('\n❌ Error in cron job:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}