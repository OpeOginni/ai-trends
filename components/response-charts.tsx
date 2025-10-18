"use client"

import { getPromptResponseAnalytics, getPromptResponses } from "@/server/responses"
import { useQuery } from "@tanstack/react-query"
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

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

const CustomLegend = ({ allModels }: { allModels: string[] }) => (
  <div className="flex flex-wrap gap-1.5 mb-3 justify-start">
    {allModels.map((model) => {
      const isHidden = hiddenModels.has(model)
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
        </button>
      )
    })}
  </div>
)

    if (isLoading) {
        return <div>Loading...</div>
    }


    const analytics = data?.analytics ?? [];

    const allModels = Array.from(new Set(
        analytics.flatMap(item => Object.keys(item ?? {})
        .filter(key => key !== "entity"))
    )).sort();


    const chartConfig = Object.fromEntries(
        allModels.map((model, i) => [model, { label: model, color: `var(--chart-${i + 1})` }])
    ) satisfies ChartConfig;

    return (
        <Card className="w-[800px]">
        <CardHeader>
          <CardTitle>{data?.prompt?.question}</CardTitle>
          <CardDescription>January - June 2024</CardDescription>
        </CardHeader>
        <CardContent>
        <CustomLegend allModels={allModels} />

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
            <ChartTooltip content={<ChartTooltipContent className="w-[150px]" hideLabel/>} />
            {/* <ChartLegend verticalAlign="top" content={<CustomLegend payload={allModels} />} /> */}
            {allModels
            .filter(model => !hiddenModels.has(model))
            .map((model, index) => {
                return (
                    <Bar
                    dataKey={model}
                    stackId="a"
                    fill={chartConfig[model].color}
                    radius={[2, 2, 2, 2]}
                    // animationDuration={0}
                    />
                )
            })}
        </BarChart>  
    </ChartContainer>
    </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter>
    </Card>
    )
}

