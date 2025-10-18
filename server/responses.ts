"use server"

import db from "@/db";
import { entities, models, responses } from "@/db/schema";
import { between, eq, and, count } from "drizzle-orm"
import { endOfDay, startOfDay } from "date-fns"
import { getPrompt } from "./prompts";

export async function getPromptResponses(promptId: string, dateTimestamp?: number) {
    let dayStart: Date;
    let dayEnd: Date;

    const prompt = await getPrompt(promptId);
    if(!prompt) {
        return [];
    }

    if(dateTimestamp) {
        dayStart = startOfDay(new Date(dateTimestamp));
        dayEnd = endOfDay(new Date(dateTimestamp));
    } else {
        dayStart = startOfDay(prompt.lastRunAt ?? new Date());
        dayEnd = endOfDay(prompt.lastRunAt ?? new Date());
    }

    const fetchedResponses = await db.select({
        responseText: responses.responseText,
        model: models.name,
        entity: entities.name,
    }).from(responses).where(and(eq(responses.promptId, promptId), between(responses.timestamp, dayStart, dayEnd))).leftJoin(models, eq(responses.modelId, models.id)).leftJoin(entities, eq(responses.entityId, entities.id)).groupBy(entities.name)

    return fetchedResponses;
}

export async function getPromptResponseAnalytics(promptId: string, dateTimestamp?: Date) {
    
    let dayStart: Date;
    let dayEnd: Date;

    const prompt = await getPrompt(promptId);

    if(!prompt) {
        return {
            prompt: null,
            analytics: []
        };
    }

    if(dateTimestamp) {
        dayStart = startOfDay(dateTimestamp);
        dayEnd = endOfDay(dateTimestamp);
    } else {
        dayStart = startOfDay(prompt.lastRunAt ?? new Date());
        dayEnd = endOfDay(prompt.lastRunAt ?? new Date());
    }

    const rawCounts = await db.select({
        entity: entities.name,
        model: models.name,
        count: count(responses.id)
    })
    .from(responses)
    .where(and(
        eq(responses.promptId, promptId), 
        between(responses.timestamp, dayStart, dayEnd)
    )).leftJoin(models, eq(responses.modelId, models.id))
    .leftJoin(entities, eq(responses.entityId, entities.id))
    .groupBy(entities.name, models.name)

    const analyticsArray = rawCounts.reduce((acc, row) => {
        // Try to find an existing object for this entity
        const existing = acc.find(item => item.entity === row.entity);

        const simpleModelName = row.model?.includes("/") ? row.model?.split("/")[1] : row.model;

        if (existing) {
            // If it exists, add or update the model count
            existing[simpleModelName!] = (existing[simpleModelName!] ?? 0) + Number(row.count);
        } else {
            // If not, create a new entry with entity and model count
            acc.push({
                entity: row.entity!,
                [simpleModelName!]: Number(row.count)
            });
        }

        return acc;
    }, [] as Array<Record<string, any>>);

    return {
        prompt: prompt,
        analytics: analyticsArray
    };
}