import { createOpenAI, openai } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError, generateText, Output } from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { z } from "zod";

const openAIRouter = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY as string,
});

const entitySchema = z.object({
    entity: z.string()
        .min(1, "Entity cannot be empty")
        .max(64, "Entity name too long")
        .describe("The single entity name only, with no explanations or extra text")
});

const openAIWebSearchToolSchema = z.object({
    searchContextSize: z.enum(["high", "medium", "low"]),
    userLocation: z.object({
        type: z.enum(["approximate"]),
        city: z.string().optional(),
        region: z.string().optional(),
    }).optional()
})

type OpenAIWebSearchToolSchemaType = z.infer<typeof openAIWebSearchToolSchema>;

export async function getResponse(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}): Promise<{response: string, generationType: "object" | "text"}> {
    try {
        const { object } = await generateObject({
            model: openAIRouter(model.name),
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
                model: openAIRouter(model.name),
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

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}, webSearchConfig?: OpenAIWebSearchToolSchemaType): Promise<{response: string, sources: string[]}> {
    try {
        const defualtConfig: OpenAIWebSearchToolSchemaType = {
            searchContextSize: 'high',
        }

        const config = webSearchConfig ? webSearchConfig : defualtConfig;

        const { output, sources, text } = await generateText({
            model: openAIRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            output: model.supportsObjectOutput ? Output.object({
                schema: entitySchema
            }) : undefined,
            tools: {
                web_search: openAIRouter.tools.webSearch({
                    searchContextSize: config.searchContextSize,
                    userLocation: config.userLocation
                }),
              },
            toolChoice: { type: 'tool', toolName: 'web_search' },
        });

        const sourceUrls = sources.map((source) => source.sourceType === "url" ? source.url : "")

        const response = model.supportsObjectOutput ? output.entity : text;
        return {response: response, sources: sourceUrls};
    } catch (error) {
        // Throw error to be used later and stored
        console.log(error)

        throw error;
    }
}