import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface LaunchEntry {
  id: string;
  title: string;
  entry_type: string;
  product: string | null;
  start_date: string | null;
  end_date: string | null;
  result: string;
  summary: string | null;
  what_worked: string | null;
  what_didnt_work: string | null;
  results_numbers: string | null;
  learnings: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  launches: LaunchEntry[];
}

const RESULT_COLOR: Record<string, string> = {
  funcionou: 'bg-success/15 text-success dark:bg-green-950 dark:text-green-300',
  'não funcionou': 'bg-destructive/15 text-destructive dark:bg-red-950 dark:text-red-300',
  parcialmente: 'bg-warning/15 text-warning dark:bg-amber-950 dark:text-amber-300',
};

export function PastLaunchesDialog({ open, onOpenChange, productName, launches }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Lançamentos anteriores — {productName}</DialogTitle>
          <DialogDescription>
            Existem {launches.length} lançamento(s) registado(s) para este produto. Analisa os resultados antes de avançar.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4">
            {launches.map(l => (
              <Card key={l.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm">{l.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.start_date ? format(new Date(l.start_date), 'MMM yyyy', { locale: pt }) : '—'}
                        {l.end_date ? ` → ${format(new Date(l.end_date), 'MMM yyyy', { locale: pt })}` : ''}
                      </p>
                    </div>
                    <Badge className={RESULT_COLOR[l.result.toLowerCase()] || ''}>{l.result}</Badge>
                  </div>

                  {l.summary && <Section label="Resumo" text={l.summary} />}
                  {l.what_worked && <Section label="O que funcionou" text={l.what_worked} />}
                  {l.what_didnt_work && <Section label="O que não funcionou" text={l.what_didnt_work} />}
                  {l.results_numbers && <Section label="Resultados" text={l.results_numbers} />}
                  {l.learnings && <Section label="Aprendizagens" text={l.learnings} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}
