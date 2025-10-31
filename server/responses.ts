"use server"

import db from "@/db";
import { entities, models, responses, promptJobs, promptRuns } from "@/db/schema";
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
            analytics: [],
            sources: {}
        };
    }

    if(dateTimestamp) {
        dayStart = startOfDay(dateTimestamp);
        dayEnd = endOfDay(dateTimestamp);
    } else {
        dayStart = startOfDay(prompt.lastRunAt ?? new Date());
        dayEnd = endOfDay(prompt.lastRunAt ?? new Date());
    }

    // Get all responses with their web search status
    const rawResponses = await db.select({
        entity: entities.name,
        model: models.name,
        webSearchSources: responses.webSearchSources,
    })
    .from(responses)
    .where(and(
        eq(responses.promptId, promptId), 
        between(responses.timestamp, dayStart, dayEnd)
    ))
    .leftJoin(models, eq(responses.modelId, models.id))
    .leftJoin(entities, eq(responses.entityId, entities.id))
    
    // Group and count in JavaScript to handle web search variants properly
    const groupedCounts = new Map<string, { count: number; webSearchSources: any }>();
    rawResponses.forEach(row => {
        if (!row.entity || !row.model) return;
        
        const simpleModelName = row.model.includes("/") ? row.model.split("/")[1] : row.model;
        // webSearchSources is null for non-web search jobs, array (possibly empty) for web search jobs
        const hasWebSearch = row.webSearchSources !== null;
        const modelKey = hasWebSearch ? `${simpleModelName} (web)` : simpleModelName;
        const groupKey = `${row.entity}::${modelKey}`;
        
        const existing = groupedCounts.get(groupKey);
        if (existing) {
            existing.count += 1;
        } else {
            groupedCounts.set(groupKey, {
                count: 1,
                webSearchSources: row.webSearchSources
            });
        }
    });
    
    const rawCounts = Array.from(groupedCounts.entries()).map(([key, data]) => {
        const [entity, model] = key.split('::');
        return {
            entity,
            model,
            count: data.count,
            webSearchSources: data.webSearchSources
        };
    });

    // Collect sources grouped by entity and model variant
    const sourcesMap: Record<string, Record<string, string[]>> = {};

    const analyticsArray = rawCounts.reduce((acc, row) => {
        if (!row.entity) return acc;
        
        // Try to find an existing object for this entity
        const existing = acc.find(item => item.entity === row.entity);

        // Determine if this is a web search variant
        // webSearchSources is null for non-web search jobs, array (possibly empty) for web search jobs
        const hasWebSearch = row.webSearchSources !== null;

        // Store sources if web search was used and sources exist
        if (hasWebSearch && Array.isArray(row.webSearchSources) && row.webSearchSources.length > 0) {
            const entityName = row.entity;
            if (!sourcesMap[entityName]) {
                sourcesMap[entityName] = {};
            }
            if (!sourcesMap[entityName][row.model]) {
                sourcesMap[entityName][row.model] = [];
            }
            // Add unique sources
            const sources = row.webSearchSources.filter((s: string) => s && s.trim() !== '') as string[];
            sources.forEach((source: string) => {
                if (!sourcesMap[entityName][row.model].includes(source)) {
                    sourcesMap[entityName][row.model].push(source);
                }
            });
        }

        if (existing) {
            // If it exists, add or update the model count
            existing[row.model] = (existing[row.model] ?? 0) + Number(row.count);
        } else {
            // If not, create a new entry with entity and model count
            acc.push({
                entity: row.entity,
                [row.model]: Number(row.count)
            });
        }

        return acc;
    }, [] as Array<Record<string, any>>);

    return {
        prompt: prompt,
        analytics: analyticsArray,
        sources: sourcesMap
    };
}