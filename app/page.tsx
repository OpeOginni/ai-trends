import ResponseCharts from "@/components/response-charts";
import DashboardSkeleton from "@/components/dashboard-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHighlightedPrompts } from "@/server/prompts";
import { Suspense } from "react";
import { BarChart3, TrendingUp, Sparkles } from "lucide-react";

export default async function Home() {

  const highlightedPrompts = await getHighlightedPrompts();

  const individualCategories = Array.from(new Set(highlightedPrompts.map((prompt) => prompt.category)));

  return (
    <div className="flex flex-col items-center min-h-screen p-8 pb-20 gap-12 sm:p-20 bg-gradient-to-b from-background to-muted/20">
      <div className="flex flex-col items-center gap-4 text-center max-w-3xl">
        <div className="flex items-center gap-3">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            AI Trends
          </h1>
        </div>
        
        <p className="text-lg text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          You had Google Trends, now check out trends in different AI models
          <TrendingUp className="w-4 h-4" />
        </p>
      </div>

      <main className="flex w-full gap-8 items-center justify-center">
        <Suspense fallback={<DashboardSkeleton promptCount={highlightedPrompts.length} />}>
          <Tabs defaultValue={individualCategories[0]} className="w-full max-w-4xl">
            <TabsList className="w-full justify-start overflow-x-auto">
              {individualCategories.map((category) => (
                <TabsTrigger key={category} value={category} className="flex-1 min-w-fit">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
            {individualCategories.map((category) => (
              <TabsContent className="flex flex-col gap-8 w-full items-center justify-center mt-8" key={category} value={category}>
                {highlightedPrompts.filter((prompt) => prompt.category === category).map((prompt) => (
                  // <div key={prompt.id} className="flex flex-row items-center justify-center">
                    <ResponseCharts key={prompt.id} promptId={prompt.id} />
                  // </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </Suspense>
      </main>
    </div>
  );
}
