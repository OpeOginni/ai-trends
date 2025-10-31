import db from "..";
import { models, NewModel } from "../schema";


async function seedModels() {
    const newModels: NewModel[] = [
        // OpenAI models
        {
            name: "o3-2025-04-16",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2024-05",
            temperature: false,
            category: "general",
        },
        {
            name: "o3-pro-2025-06-10",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2024-05",
            temperature: false,
            category: "general",
        },
        {
            name: "gpt-5-chat-latest",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: false,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2024-09",
            temperature: true,
            category: "general"
        },
        {
            name: "gpt-5-codex",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2024-10",
            temperature: false,
            category: "coding"
        },
        // Anthropic models
        {
            name: "claude-sonnet-4-5",
            provider: "anthropic",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        {
            name: "claude-opus-4-1",
            provider: "anthropic",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-03",
            temperature: true,
            category: "general"
        },
        {
            name: "claude-haiku-4-5",
            provider: "anthropic",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        // Google models
        {
            name: "gemini-2.5-pro",
            provider: "google",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-01",
            temperature: true,
            category: "general"
        },
        {
            name: "gemini-2.5-flash",
            provider: "google",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-01",
            temperature: true,
            category: "general"
        },
        // XAI models
        {
            name: "grok-4-0709",
            provider: "xai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        {
            name: "grok-4-fast-non-reasoning",
            provider: "xai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: true,
            nativeWebSearchTool: true,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        // OpenRouter models
        {
            name: "openai/gpt-5-chat",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: false,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2024-09",
            temperature: true,
            category: "general"
        },
        {
            name: "openai/gpt-5-codex",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2024-10",
            temperature: true,
            category: "coding"
        },
        {
            name: "anthropic/claude-sonnet-4.5",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        {
            name: "anthropic/claude-opus-4.1",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2025-03",
            temperature: true,
            category: "general"
        },
        {
            name: "anthropic/claude-haiku-4.5",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            nativeWebSearchTool: false,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        {
            name: "google/gemini-2.5-pro",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-01",
            temperature: true,
            category: "general"
        },
        {
            name: "google/gemini-2.5-flash",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-01",
            temperature: true,
            category: "general"
        },
        {
            name: "deepseek/deepseek-chat-v3.1",
            provider: "openrouter",
            openWeights: true,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        },
        {
            name: "x-ai/grok-4",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-07",
            temperature: true,
            category: "general"
        }
    ]

    console.log("Found", newModels.length, "models")
    console.log("Seeding models...")
    await db.insert(models).values(newModels)
    console.log("Models seeded successfully")
}

seedModels().catch((error) => {
    console.error("Error seeding models:", error)
}).finally(() => {
    process.exit(0)
})