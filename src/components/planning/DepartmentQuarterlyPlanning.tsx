import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { QuarterlyProgrammingView } from './QuarterlyProgrammingView';
import { QuarterlyRetrospectiveView } from './QuarterlyRetrospectiveView';
import { shiftQuarter, type QuarterStr } from '@/hooks/useQuarterlyPlan';

interface Props {
  planning: any;
  year: number;
  planAreaKey: string;
  label: string;
}

/**
 * Bloco de programação trimestral para um único departamento, com seletor
 * de Q1-Q4 e as 3 sub-tabs (Retrospetiva, Estado, Programação).
 */
export function DepartmentQuarterlyPlanning({ planning, year, planAreaKey, label }: Props) {
  const currentQ = (['T1', 'T2', 'T3', 'T4'] as const)[Math.floor(new Date().getMonth() / 3)];
  const [quarter, setQuarter] = useState<QuarterStr>(currentQ);

  const prev = shiftQuarter(year, quarter, -1);
  const next = shiftQuarter(year, quarter, 1);

  return (
    <section className="space-y-3 pt-6 border-t border-border/60">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Análise & Programação Trimestral</h2>
            <p className="text-xs text-muted-foreground">Retrospetiva, estado e programação de {label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['T1', 'T2', 'T3', 'T4'] as const).map((q) => (
            <Button
              key={q}
              size="sm"
              variant={q === quarter ? 'default' : 'outline'}
              className="h-7 text-xs px-3"
              onClick={() => setQuarter(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      </div>

      <Card className="hq-card">
        <CardContent className="pt-5">
          <Tabs defaultValue="programa">
            <TabsList className="grid grid-cols-3 w-full h-auto p-1">
              <TabsTrigger value="retro" className="py-2 text-xs">
                <span className="font-semibold">Retrospetiva</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{prev.quarter}·{prev.year}</span>
              </TabsTrigger>
              <TabsTrigger value="estado" className="py-2 text-xs">
                <span className="font-semibold">Estado</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{quarter}·{year}</span>
              </TabsTrigger>
              <TabsTrigger value="programa" className="py-2 text-xs">
                <span className="font-semibold">Programação</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{next.quarter}·{next.year}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="retro" className="mt-4">
              <QuarterlyRetrospectiveView
                planning={planning}
                year={prev.year}
                quarter={prev.quarter}
                onlyArea={planAreaKey}
              />
            </TabsContent>

            <TabsContent value="estado" className="mt-4">
              <p className="text-[11px] text-muted-foreground mb-3">
                Estado do trimestre vigente: vê os KPIs e Key Results acima nesta página.
              </p>
              <QuarterlyProgrammingView
                year={year}
                quarter={quarter}
                onlyArea={planAreaKey}
              />
            </TabsContent>

            <TabsContent value="programa" className="mt-4">
              <QuarterlyProgrammingView
                year={next.year}
                quarter={next.quarter}
                onlyArea={planAreaKey}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}