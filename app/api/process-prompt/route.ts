import db from '@/db';
import { entities, models, prompts, responses } from '@/db/schema';
import { generateObject, generateText } from 'ai';
import { eq, inArray } from 'drizzle-orm';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { z } from 'zod';
import { polishEntity } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { promptId } = await request.json();

        if (!promptId) {
            return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
        }

        // Fetch the specific prompt
        const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId));

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
        }

        const openRouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY as string,
        });

        // Get the models for this prompt
        const promptModels = await db.select().from(models).where(inArray(models.id, prompt.models.map((model: any) => model.id)));
        const runs = prompt.runs;

        // Process each model
        for (const model of promptModels) {
            for (let i = 0; i < runs; i++) {
                let output = "";
                
                if (model.supportsObjectOutput) {
                    const response = await generateObject({
                        model: openRouter(`${model.provider}/${model.name}`),
                        system: SYSTEM_PROMPT,
                        prompt: prompt.question,
                        output: "object",
                        schema: z.object({
                            entity: z.string(),
                        }),
                    });

                    output = response.object.entity;
                } else {
                    const response = await generateText({
                        model: openRouter(`${model.provider}/${model.name}`),
                        system: SYSTEM_PROMPT,
                        prompt: prompt.question,
                    });
                    output = response.text;
                }

                const polishedOutput = polishEntity(output);

                const [entity] = await db
                    .insert(entities)
                    .values({ name: polishedOutput, category: prompt.category })
                    .onConflictDoNothing()
                    .returning({ id: entities.id });

                await db.insert(responses).values({
                    promptId: prompt.id,
                    modelId: model.id,
                    entityId: entity.id,
                    responseText: output,
                });
            }
        }

        return NextResponse.json({ success: true, promptId });
    } catch (error) {
        console.error('Error processing prompt:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

