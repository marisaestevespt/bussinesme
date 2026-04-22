import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Save } from 'lucide-react';

interface Props {
  cronogramaJson: string | null;
  onChange: (json: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function CronogramaSubPage({ cronogramaJson, onChange, onBack, onSave, saving, dirty }: Props) {
  let rows: { macro: string; prazo: string }[] = [];
  try { rows = cronogramaJson ? JSON.parse(cronogramaJson) : []; } catch { rows = []; }
  if (rows.length === 0) rows = [{ macro: '', prazo: '' }];

  const updateRows = (newRows: { macro: string; prazo: string }[]) => onChange(JSON.stringify(newRows));

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <h2 className="text-xl font-bold">Cronograma Geral</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Macro</TableHead><TableHead className="w-[180px]">Prazo</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={row.macro} onChange={e => { const r = [...rows]; r[i] = { ...r[i], macro: e.target.value }; updateRows(r); }} placeholder="Ex: Fase de pesquisa" className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><Input type="date" value={row.prazo} onChange={e => { const r = [...rows]; r[i] = { ...r[i], prazo: e.target.value }; updateRows(r); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><button onClick={() => { const r = rows.filter((_, j) => j !== i); updateRows(r.length ? r : [{ macro: '', prazo: '' }]); }} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => updateRows([...rows, { macro: '', prazo: '' }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar linha</Button>
        {dirty && <Button onClick={onSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
      </div>
    </AppLayout>
  );
}