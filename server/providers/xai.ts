import { createXai } from "@ai-sdk/xai";
import { generateObject, NoObjectGeneratedError, generateText, Output } from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { z } from "zod";

const xAIRouter = createXai({
    apiKey: process.env.XAI_API_KEY as string,
});

const entitySchema = z.object({
    entity: z.string()
        .min(1, "Entity cannot be empty")
        .max(64, "Entity name too long")
        .describe("The single entity name only, with no explanations or extra text")
});

const xAIWebSearchSourcesSchema = z.array(
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("web"),
            country: z.string(),
            allowedWebsites: z.array(z.string()).optional(),
            excludedWebsites: z.array(z.string()).optional(),
            safeSearch: z.boolean().default(true),
        }),
        z.object({
            type: z.literal("x"),
            includedXHandles: z.array(z.string()).optional(),
            excludedXHandles: z.array(z.string()).optional(),
            postFavoriteCount: z.number().optional(),
            postViewCount: z.number().optional(),
        }),
        z.object({
            type: z.literal("news"),
            country: z.string(),
            excludedWebsites: z.array(z.string()).optional(),
            safeSearch: z.boolean().default(true),
        })
    ])
);

const xAIWebSearchToolSchema = z.object({
    mode: z.enum(["on", "off"]).default("off"),
    returnCitations: z.boolean().default(true).optional(),
    maxSearchResults: z.number().default(5).optional(),
    sources: xAIWebSearchSourcesSchema,
})

type XAIWebSearchToolSchemaType = z.infer<typeof xAIWebSearchToolSchema>;

export async function getResponse(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}): Promise<{response: string, generationType: "object" | "text"}> {
    try {
        const { object } = await generateObject({
            model: xAIRouter(model.name),
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
                model: xAIRouter(model.name),
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

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean | null, supportsObjectOutput: boolean}, webSearchConfig?: XAIWebSearchToolSchemaType): Promise<{response: string, sources: string[]}> {
    try {
        const defualtConfig: XAIWebSearchToolSchemaType = {
            mode: "on",
            sources: [],
        }

        const config = webSearchConfig ? webSearchConfig : defualtConfig;

            const { output, sources, text } = await generateText({
            model: xAIRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            output: model.supportsObjectOutput ? Output.object({
                schema: entitySchema
            }) : undefined,
            providerOptions: {
                xai: {
                    searchParameters: config,
                }
            }
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