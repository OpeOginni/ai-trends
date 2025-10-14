import db from "..";
import { models, NewModel } from "../schema";


async function seedModels() {
    const newModels: NewModel[] = [
        {
            name: "o3",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2024-05",
            category: "general",
        },
        {
            name: "o3-pro",
            provider: "openai",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2024-05",
            category: "general",
        },
        {
            name: "openai/gpt-5-chat",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: false,
            hasWebAccess: false,
            knowledge: "2024-09",
            category: "general"
        },
        // {
        //     name: "openai/gpt-5",
        //     provider: "openrouter",
        //     openWeights: false,
        //     reasoning: true,
        //     supportsObjectOutput: true,
        //     hasWebAccess: true,
        //     knowledge: "2024-09",
        //     category: "general"
        // },
        {
            name: "openai/gpt-5-codex",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2024-10",
            category: "coding"
        },
        {
            name: "anthropic/claude-sonnet-4.5",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-07",
            category: "general"
        },
        {
            name: "anthropic/claude-opus-4.1",
            provider: "openrouter",
            openWeights: false,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-03",
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
            category: "general"
        },
        {
            name: "x-ai/grok-4",
            provider: "openrouter",
            openWeights: true,
            reasoning: true,
            supportsObjectOutput: true,
            hasWebAccess: false,
            knowledge: "2025-07",
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