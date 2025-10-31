import { createAnthropic, anthropic } from '@ai-sdk/anthropic';
import { generateObject, NoObjectGeneratedError, generateText, Output, Tool } from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { z } from "zod";

const anthropicRouter = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY as string,
});

const entitySchema = z.object({
    entity: z.string()
        .min(1, "Entity cannot be empty")
        .max(64, "Entity name too long")
        .describe("The single entity name only, with no explanations or extra text")
});

const anthropicWebSearchToolSchema = z.object({
    maxUses: z.number(),
    allowedDomains: z.array(z.string()).optional(),
    blockedDomains: z.array(z.string()).optional(),
    userLocation: z.object({
        type: z.enum(["approximate"]),
        country: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        timezone: z.string().optional(),
    }).optional()
})

export type AnthropicWebSearchToolSchemaType = z.infer<typeof anthropicWebSearchToolSchema>;

export async function getResponse(prompt: string, model: {name: string, temperature: boolean | null}): Promise<{response: string, generationType: "object" | "text"}> {
    try {
        const { object } = await generateObject({
            model: anthropicRouter(model.name),
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
                model: anthropicRouter(model.name),
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

export async function getResponseWithWebSearch(prompt: string, model: {name: string, temperature: boolean | null}, webSearchConfig?: AnthropicWebSearchToolSchemaType): Promise<{response: string, sources: string[]}> {
    try {
        const defualtConfig: AnthropicWebSearchToolSchemaType = {
            maxUses: 3,
        }

        const config = webSearchConfig ? webSearchConfig : defualtConfig;

        const { experimental_output, sources } = await generateText({
            model: anthropicRouter(model.name),
            system: SYSTEM_PROMPT,
            prompt: prompt,
            temperature: model.temperature ? 0.3 : undefined,
            experimental_output: Output.object({
                schema: entitySchema
            }),
            tools: {
                web_search: anthropic.tools.webSearch_20250305(config)  as unknown as Tool<never, never>, // https://ai-sdk.dev/providers/ai-sdk-providers/anthropic#web-search-tool
              },
            toolChoice: { type: 'tool', toolName: 'web_search' }, 
        });

        const sourceUrls = sources.map((source) => source.sourceType === "url" ? source.url : "")

        return {response: experimental_output.entity, sources: sourceUrls};
    } catch (error) {
        // Throw error to be used later and stored
        console.log(error)

        throw error;
    }
}