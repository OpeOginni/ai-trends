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

export async function getResponse(prompt: string, model: {name: string, temperature: boolean}): Promise<{response: string, generationType: "object" | "text"}> {
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
            const { text, experimental_output } = await generateText({
                model: openAIRouter(model.name),
                system: SYSTEM_PROMPT,
                prompt: prompt,
                temperature: model.temperature ? 0.3 : undefined,
                experimental_output: Output.object({
                    schema: entitySchema
                }),
            });
            
            return {response: experimental_output.entity, generationType: "text"};
        }

        throw error;
    }
}

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean}, webSearchConfig?: OpenAIWebSearchToolSchemaType): Promise<{response: string, sources: string[]}> {
    try {
        const defualtConfig: OpenAIWebSearchToolSchemaType = {
            searchContextSize: 'medium',
        }

        const config = webSearchConfig ? webSearchConfig : defualtConfig;

        const { text, sources } = await generateText({
            model: openAIRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            experimental_output: Output.object({
                schema: entitySchema
            }),
            tools: {
                web_search: openai.tools.webSearch({
                    searchContextSize: config.searchContextSize,
                    userLocation: config.userLocation
                }),
              },
        });

        const sourceUrls = sources.map((source) => source.sourceType === "url" ? source.url : "")

        return {response: text, sources: sourceUrls};
    } catch (error) {
        // Throw error to be used later and stored
        console.log(error)

        throw error;
    }
}