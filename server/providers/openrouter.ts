import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText, NoObjectGeneratedError, Output, Tool } from "ai";
import { z } from "zod";
import { AnthropicWebSearchToolSchemaType } from "./anthropic";

const openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY as string,
})

const googleRouter = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY as string,
});


const entitySchema = z.object({
    entity: z.string()
        .min(1, "Entity cannot be empty")
        .max(64, "Entity name too long")
        .describe("The single entity name only, with no explanations or extra text")
});

export async function getResponse(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}): Promise<{response: string, generationType: "object" | "text"}> {
    try {
        const { object } = await generateObject({
            model: openRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            output: "object",
            schema: entitySchema,
            temperature: model.temperature ? 0.3 : undefined
        })

        return {response: object.entity, generationType: "object"};
    } catch (error) {
        if (error instanceof NoObjectGeneratedError) {
            console.error(`⚠️ Object generation failed, trying text fallback:`, error);

            const { text, output } = await generateText({
                model: openRouter(model.name),
                system: SYSTEM_PROMPT,
                prompt: prompt,
                temperature: model.temperature ? 0.3 : undefined,
                output: model.supportsObjectOutput ? Output.object({
                    schema: entitySchema
                }) : undefined,
            });

            const response = model.supportsObjectOutput ? output.entity : text;
            return {response: response, generationType: "text"};
        }

        throw error;
    }
}

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}, webSearchConfig?: AnthropicWebSearchToolSchemaType): Promise<{response: string, sources: string[]}> {
    try {
        const { output, sources, text } = await generateText({
            model: openRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            output: model.supportsObjectOutput ? Output.object({
                schema: entitySchema
            }) : undefined,
            tools: {
                google_search: googleRouter.tools.googleSearch({}) as unknown as Tool<never, never>,
              },
            toolChoice: { type: 'tool', toolName: 'google_search' },
        });

        const sourceUrls = sources.map((source) => source.sourceType === "url" ? source.url : "")

        const response = model.supportsObjectOutput ? output.entity : text;

        return {response: output.entity, sources: sourceUrls};
    } catch (error) {
        // Throw error to be used later and stored
        console.log(error)

        throw error;
    }
}