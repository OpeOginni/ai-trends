"use client"

import { getPromptResponseAnalytics } from "@/server/responses"
import { useQuery } from "@tanstack/react-query"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Globe } from "lucide-react";
import { useState } from "react";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export default function ResponseCharts(props: { promptId: string, dateTimestamp?: Date}) {
    const { data, isLoading } = useQuery({ queryKey: ["response-analytics", props.promptId], queryFn: () => getPromptResponseAnalytics(props.promptId, props.dateTimestamp) })
    const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set())

    const toggleModel = (model: string) => {
        const newHidden = new Set(hiddenModels)
        if (newHidden.has(model)) {
          newHidden.delete(model)
        } else {
          newHidden.add(model)
        }
        setHiddenModels(newHidden)
    }

    const CustomTooltip = ({ active, payload }: any) => {
      if (!active || !payload || !payload.length) return null;
      
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            {payload
              .filter((item: any) => item.value !== undefined && item.value !== 0)
              .map((item: any) => {
                const isWebModel = item.dataKey?.includes(" (web)");
                return (
                  <div key={item.dataKey} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex items-center gap-1 font-medium">
                      {item.dataKey}
                      {isWebModel && (
                        <Globe className="w-3 h-3 text-blue-500" />
                      )}
                    </span>
                    <span className="ml-auto font-mono font-bold">
                      {item.value}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      );
    };

    const CustomLegend = ({ allModels, sources, chartConfig }: { allModels: string[], sources: Record<string, Record<string, string[]>>, chartConfig: ChartConfig }) => {
      const isWebModel = (model: string) => model.includes(" (web)");
      
      // Separate models into web and non-web
      const webModels = allModels.filter(isWebModel);
      const nonWebModels = allModels.filter(m => !isWebModel(m));
      
      const renderModelButton = (model: string) => {
        const isHidden = hiddenModels.has(model);
        const hasWebSearch = isWebModel(model);
        return (
          <button
            key={model}
            onClick={() => toggleModel(model)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all border ${
              isHidden 
                ? 'opacity-50 bg-muted border-muted-foreground/20' 
                : 'opacity-100 bg-background border-border hover:bg-accent'
            }`}
          >
            <div 
              className="w-2 h-2 rounded-sm flex-shrink-0" 
              style={{ backgroundColor: isHidden ? '#ccc' : chartConfig[model]?.color }}
            />
            <span className={isHidden ? 'line-through' : ''}>
              {model}
            </span>
            {hasWebSearch && (
              <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />
            )}
          </button>
        );
      };
      
      return (
        <div className="space-y-3 mb-3">
          {webModels.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                With Web Search
              </div>
              <div className="flex flex-wrap gap-1.5">
                {webModels.map(renderModelButton)}
              </div>
            </div>
          )}
          
          {nonWebModels.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                Without Web Search
              </div>
              <div className="flex flex-wrap gap-1.5">
                {nonWebModels.map(renderModelButton)}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (isLoading) {
        return <div>Loading...</div>
    }


    const analytics = data?.analytics ?? [];
    const sources = (data?.sources ?? {}) as Record<string, Record<string, string[]>>;

    const allModels = Array.from(new Set(
        analytics.flatMap(item => Object.keys(item ?? {})
        .filter(key => key !== "entity"))
    )).sort();

    // Separate web and non-web models
    const webModels = allModels.filter(m => m.includes(" (web)"));
    const nonWebModels = allModels.filter(m => !m.includes(" (web)"));
    
    // Sort models: non-web first, then web (to group them visually)
    const sortedModels = [...nonWebModels, ...webModels];

    const chartConfig = Object.fromEntries(
        sortedModels.map((model, i) => [model, { label: model, color: `var(--chart-${i + 1})` }])
    ) satisfies ChartConfig;

    // Group models by base name (without web suffix) for side-by-side display
    const baseModelNames = new Set(
        allModels.map(model => model.replace(" (web)", ""))
    );

    return (
        <Card className="w-[800px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data?.prompt?.question}
            {data?.prompt?.useWebSearchTool === null && (
              <span className="text-xs text-muted-foreground font-normal">
                (with & without web search)
              </span>
            )}
          </CardTitle>
          <CardDescription>January - June 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <CustomLegend allModels={sortedModels} sources={sources} chartConfig={chartConfig} />

    <ChartContainer id={`response-chart-${props.promptId}`} config={chartConfig}>
        <BarChart accessibilityLayer data={analytics}>
            <CartesianGrid vertical={false} />
            <XAxis
                dataKey="entity"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
            />
            <ChartTooltip content={<CustomTooltip />} />
            {sortedModels
            .filter(model => !hiddenModels.has(model))
            .map((model, index) => {
                return (
                    <Bar
                    key={`${props.promptId}-${model}`}
                    dataKey={model}
                    stackId="a"
                    fill={chartConfig[model].color}
                    radius={[0, 0, 0, 0]}
                    />
                )
            })}
        </BarChart>  
    </ChartContainer>
    
    {/* Sources Display */}
    {Object.keys(sources).length > 0 && (
      <div className="mt-6 pt-4 border-t">
        <h3 className="text-sm font-semibold mb-3">Web Search Sources</h3>
        <div className="space-y-4">
          {analytics.map((item) => {
            const entityName = item.entity as string;
            const entitySources = sources[entityName] as Record<string, string[]> | undefined;
            if (!entitySources || Object.keys(entitySources).length === 0) return null;

            return (
              <div key={entityName} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">{entityName}</h4>
                <div className="space-y-2">
                  {Object.entries(entitySources).map(([modelKey, modelSources]) => {
                    if (!Array.isArray(modelSources) || modelSources.length === 0) return null;
                    return (
                      <div key={modelKey} className="pl-4 space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Globe className="w-3 h-3 text-blue-500" />
                          <span>{modelKey}</span>
                        </div>
                        <ul className="pl-6 space-y-1">
                          {modelSources.map((source: string, idx: number) => (
                            <li key={idx}>
                              <a
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline break-all"
                              >
                                {source}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    </CardContent>
    </Card>
    )
}

