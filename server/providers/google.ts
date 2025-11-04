import { createGoogleGenerativeAI, google, GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateObject, NoObjectGeneratedError, generateText, Output, Tool } from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { z } from "zod";

const googleGenerativeAIRouter = createGoogleGenerativeAI({
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
            model: googleGenerativeAIRouter(model.name),
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
                model: googleGenerativeAIRouter(model.name),
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

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}): Promise<{response: string, sources: string[]}> {
    try {
        const { output, sources, text, providerMetadata, toolCalls, toolResults, dynamicToolCalls, content } = await generateText({
            model: googleGenerativeAIRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            output: model.supportsObjectOutput ? Output.object({
                schema: entitySchema
            }) : undefined,
            tools: {
                google_search: googleGenerativeAIRouter.tools.googleSearch({
                    needsApproval: false,
                }) as unknown as Tool<never, never>,
            },
            // toolChoice: { type: 'tool', toolName: 'google_search' },
        });

        const googleMetadata = providerMetadata?.google as
        | GoogleGenerativeAIProviderMetadata
        | undefined;

        const sourceUrls = sources.map((source) => source.sourceType === "url" ? source.url : "")

        const response = model.supportsObjectOutput ? output.entity : text;
        return {response: response, sources: sourceUrls};
    } catch (error) {
        // Throw error to be used later and stored
        console.log(error)

        throw error;
    }
}