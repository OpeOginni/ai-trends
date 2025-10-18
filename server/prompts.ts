"use server"

import db from "@/db"
import { prompts, responses } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function getPrompt(promptId: string) {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, promptId))

    if (!prompt) {
        return null;
    }

    return prompt;
}

export async function getHighlightedPrompts() {
    const fetchedPrompts = await db.select().from(prompts).where(and(eq(prompts.isHighlighted, true), eq(prompts.active, true)));

    return fetchedPrompts;
}