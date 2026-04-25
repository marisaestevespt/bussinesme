import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { History } from 'lucide-react';
import { SectionCard, SectionTitle } from './SectionPrimitives';

interface Props {
  projectHistory: any[];
  pc: string;
}

export function PortalHistorySection({ projectHistory, pc }: Props) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={History}>Histórico de Projetos</SectionTitle>
      <p className="text-sm text-muted-foreground -mt-2">Projetos anteriores concluídos.</p>
      {projectHistory.map((h: any) => (
        <SectionCard key={h.id} className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{h.project_name}</p>
            <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">Concluído</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            {h.product_name && <span>🏷️ {h.product_name}</span>}
            {h.start_date && <span>📅 Início: {h.start_date}</span>}
            {h.end_date && <span>🏁 Fim: {h.end_date}</span>}
          </div>
          {Array.isArray(h.timeline_phases) && h.timeline_phases.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2">Timeline</p>
              <div className="space-y-1.5">
                {h.timeline_phases.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      p.status === 'concluido' ? 'text-white' : p.status === 'em_curso' ? 'text-white' : 'bg-muted text-muted-foreground'
                    }`} style={p.status === 'concluido' || p.status === 'em_curso' ? { backgroundColor: pc } : undefined}>
                      {p.status === 'concluido' ? '✓' : i + 1}
                    </div>
                    <span className={p.status === 'concluido' ? 'text-muted-foreground line-through' : ''}>{p.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(h.monthly_summaries) && h.monthly_summaries.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="summaries" className="border-border/30">
                <AccordionTrigger className="text-xs hover:no-underline">Resumos Mensais ({h.monthly_summaries.length})</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {h.monthly_summaries.map((s: any, i: number) => (
                    <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 text-xs">
                      <p className="font-semibold" style={{ color: pc }}>{s.month}/{s.year}</p>
                      <p className="text-muted-foreground whitespace-pre-wrap mt-1">{s.content}</p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {h.notes && (
            <div className="mt-3 rounded-xl bg-muted/20 p-3">
              <p className="text-xs font-semibold mb-1">Notas</p>
              <p className="text-xs text-muted-foreground">{h.notes}</p>
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}