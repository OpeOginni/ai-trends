import db from "..";
import { models, NewPrompt, prompts } from "../schema";


async function seedPrompts() {

    const fetchedModels = await db.select().from(models)


    const modelIds = fetchedModels.map((model) => ({id: model.id}))

    const newPrompts: NewPrompt[] = [
        {
            category: "celebrities",
            question: "Who is the best Tech/Developer Social Media Influencer?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        },
        {
            category: "celebrities",
            question: "Who is the most influential sports person?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        },
        {
            category: "location",
            question: "Best christmas holiday locations for a family of 4?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        },
        {
            category: "hardware",
            question: "Best brand of laptop for a student?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        },
        {
            category: "software",
            question: "Best TS/JS frontend framework for a startup?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        },
        {
            category: "software",
            question: "Best programming language for a startup?",
            frequency: "daily",
            runs: 2,
            active: true,
            isHighlighted: true,
            models: modelIds
        }
    ]

    console.log("Found", fetchedModels.length, "models")
    console.log("Found", newPrompts.length, "prompts")

    console.log("Seeding prompts...")
    await db.insert(prompts).values(newPrompts)

    console.log("Prompts seeded successfully")
}

seedPrompts().catch((error) => {
    console.error("Error seeding prompts:", error)
}).finally(() => {
    process.exit(0)
})