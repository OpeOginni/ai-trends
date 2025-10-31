import db from "..";
import { models, NewPrompt, prompts } from "../schema";
import { and, eq } from "drizzle-orm";

async function seedPrompts() {

    const fetchedModels = await db.select().from(models).where(and(eq(models.hasWebAccess, true), eq(models.nativeWebSearchTool, true)))

    console.log("Found", fetchedModels.length, "models")

    console.log("Updating prompts...")

    await db.update(prompts).set({
        models: fetchedModels.map((model) => ({id: model.id})),
        runs: 1
    })

    console.log("Prompts updated successfully")
}

seedPrompts().catch((error) => {
    console.error("Error seeding prompts:", error)
}).finally(() => {
    process.exit(0)
})