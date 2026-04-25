import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { PaymentRow } from './PaymentRow';
import type { IndependenteRow } from './types';

interface Props {
  data: IndependenteRow[];
  currentYear: number;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
}

export function IndependenteSection({ data, currentYear, onSave, onToggle }: Props) {
  const total = data.reduce((s, d) => s + d.contribution, 0);

  const quarterGroups = [
    { label: 'Jan — Mar', months: [1, 2, 3] },
    { label: 'Abr — Jun', months: [4, 5, 6] },
    { label: 'Jul — Set', months: [7, 8, 9] },
    { label: 'Out — Dez', months: [10, 11, 12] },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/15/50 dark:bg-info/20 dark:border-info">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Como funciona:</strong> Declaras a faturação do trimestre → essa declaração define a contribuição do mês da declaração + 2 meses seguintes.</p>
            <p>Faturação × 70% = Rendimento relevante → ÷ 3 = Base mensal → × 21,4% = Contribuição. Mínimo: contribuição mínima mensal.</p>
            <p className="text-xs">Declaração: Jan (Out-Dez anterior) · Abr (Jan-Mar) · Jul (Abr-Jun) · Out (Jul-Set). Pagamento: dia 10-20 do mês seguinte.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contribuições Independente — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Fat. Trimestre</TableHead>
                <TableHead className="text-right">Rend. Relevante</TableHead>
                <TableHead className="text-right">Base Mensal</TableHead>
                <TableHead className="text-right">Contribuição</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Registar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterGroups.map((group) => {
                const groupData = data.filter(d => group.months.includes(d.month));
                return (
                  <>
                    <TableRow key={`header-${group.label}`} className="border-t-2 bg-muted/30">
                      <TableCell colSpan={9} className="py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-foreground">{group.label}</span>
                          <span className="text-muted-foreground">— Base: {groupData[0].srcLabel}</span>
                          <span className="text-muted-foreground">· Declaração: {groupData[0].declMonth} {groupData[0].declYear}</span>
                          {!groupData[0].hasData && (
                            <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30 dark:bg-warning/20 dark:text-warning dark:border-warning">
                              Sem dados de faturação
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {groupData.map(d => (
                      <PaymentRow
                        key={d.month}
                        month={d.month}
                        predicted={d.contribution}
                        paid={d.paid}
                        isPaid={d.isPaid}
                        onSave={onSave}
                        onToggle={onToggle}
                        extraCells={
                          <>
                            <TableCell className="text-right text-muted-foreground">{d.hasData && d.quarterRevenue > 0 ? formatEuro(d.quarterRevenue) : '—'}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{d.hasData && d.rendimentoRelevante > 0 ? formatEuro(d.rendimentoRelevante) : '—'}</TableCell>
                            <TableCell className="text-right">{d.hasData && d.baseIncidencia > 0 ? formatEuro(d.baseIncidencia) : '—'}</TableCell>
                          </>
                        }
                      />
                    ))}
                  </>
                );
              })}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell colSpan={3} />
                <TableCell className="text-right">{formatEuro(total)}</TableCell>
                <TableCell className="text-right">{formatEuro(data.reduce((s, d) => s + d.paid, 0))}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
