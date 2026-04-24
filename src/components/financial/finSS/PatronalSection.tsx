import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Info } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { SS_EMPLOYER_RATE, SS_EMPLOYEE_RATE } from '@/lib/payrollCalculations';
import { PaymentRow } from './PaymentRow';
import type { PatronalRow, SSContract } from './types';

interface Props {
  data: PatronalRow[];
  contracts: SSContract[];
  currentYear: number;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
}

export function PatronalSection({ data, contracts, currentYear, onSave, onToggle }: Props) {
  const totalPrevisto = data.reduce((s, d) => s + d.ssEmployer, 0);
  const totalGrossAnual = data.reduce((s, d) => s + d.totalGross, 0);

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/15/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4 flex gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong>Como funciona:</strong> A contribuição é calculada sobre o salário bruto dos membros com <strong>contrato de trabalho</strong>.
            Taxa patronal: 23,75%. Taxa do trabalhador: 11%. Prestadores de serviços não estão incluídos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contribuições Patronais — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Salário Bruto</TableHead>
                <TableHead className="text-right">SS Patronal (23,75%)</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Registar</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(d => (
                <PaymentRow
                  key={d.month}
                  month={d.month}
                  predicted={d.ssEmployer}
                  paid={d.paid}
                  isPaid={d.isPaid}
                  onSave={onSave}
                  onToggle={onToggle}
                  extraCells={
                    <TableCell className="text-right text-muted-foreground">{d.totalGross > 0 ? formatEuro(d.totalGross) : '—'}</TableCell>
                  }
                />
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalGrossAnual)}</TableCell>
                <TableCell className="text-right">{formatEuro(totalPrevisto)}</TableCell>
                <TableCell className="text-right">{formatEuro(data.reduce((s, d) => s + d.paid, 0))}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {contracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por Colaborador</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Salário Bruto</TableHead>
                  <TableHead className="text-right">SS Patronal / mês</TableHead>
                  <TableHead className="text-right">SS Trabalhador / mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(c => {
                  const gross = c.monthly_value || 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.team_members?.full_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatEuro(gross)}</TableCell>
                      <TableCell className="text-right">{formatEuro(Math.round(gross * SS_EMPLOYER_RATE * 100) / 100)}</TableCell>
                      <TableCell className="text-right">{formatEuro(Math.round(gross * SS_EMPLOYEE_RATE * 100) / 100)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
