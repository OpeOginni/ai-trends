import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "better-auth";

const client = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY as string,
})

const entitySchema = z.object({
    entity: z.string()
        .min(1, "Entity cannot be empty")
        .max(64, "Entity name too long")
        .describe("The single entity name only, with no explanations or extra text")
});

export async function getResponse(prompt: string, model: string) {
    const response = await generateObject({
        model: client(model),
        system: SYSTEM_PROMPT,
        prompt: prompt,
        output: "object",
        schema: entitySchema,
        temperature: 0.3,
    })
}