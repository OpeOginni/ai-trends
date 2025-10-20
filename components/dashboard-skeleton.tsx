import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

function ChartSkeleton() {
  return (
    <Card className="w-[800px] animate-pulse">
      <CardHeader>
        <CardTitle>
          <div className="h-6 bg-muted rounded w-3/4"></div>
        </CardTitle>
        <CardDescription>
          <div className="h-4 bg-muted rounded w-1/4 mt-1"></div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded w-20"></div>
          ))}
        </div>
        
        <div className="h-[300px] flex items-end gap-2 px-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1 items-center justify-end">
              <div 
                className="w-full bg-muted rounded-t"
                style={{ height: `${Math.random() * 60 + 40}%` }}
              ></div>
              <div className="h-3 bg-muted rounded w-8 mt-2"></div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="h-4 bg-muted rounded w-1/3"></div>
        <div className="h-3 bg-muted rounded w-1/2"></div>
      </CardFooter>
    </Card>
  );
}

export default function DashboardSkeleton({ promptCount = 3 }: { promptCount?: number }) {
  return (
    <Tabs defaultValue="0" className="w-full max-w-4xl">
      <TabsList className="w-full justify-start overflow-x-auto">
        {[...Array(promptCount)].map((_, i) => (
          <TabsTrigger key={i} value={i.toString()} className="flex-1 min-w-fit" disabled>
            <div className="h-4 bg-muted/50 rounded w-24"></div>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent className="flex w-full justify-center mt-8" value="0">
        <ChartSkeleton />
      </TabsContent>
    </Tabs>
  );
}
