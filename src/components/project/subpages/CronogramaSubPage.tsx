import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  cronogramaJson: string | null;
  onChange: (json: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function CronogramaSubPage({ projectId, cronogramaJson, onChange, onBack, onSave, saving, dirty }: Props) {
  let rows: { macro: string; prazo: string }[] = [];
  try { rows = cronogramaJson ? JSON.parse(cronogramaJson) : []; } catch { rows = []; }
  if (rows.length === 0) rows = [{ macro: '', prazo: '' }];

  const updateRows = (newRows: { macro: string; prazo: string }[]) => onChange(JSON.stringify(newRows));

  return (
    <SubPageShell
      title="Cronograma Geral"
      description="Marcos macro do projeto e respetivos prazos. Para tarefas detalhadas usa as Fases ou Tarefas."
      icon={CalendarIcon}
      onBack={onBack}
      onSave={onSave}
      saving={saving}
      dirty={dirty}
    >
      <EntitySection title="Marcos" icon={CalendarIcon} description="Lista de macro-fases com prazo final">
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-foreground">Macro</TableHead>
                <TableHead className="w-[180px] text-foreground">Prazo</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={row.macro} onChange={e => { const r = [...rows]; r[i] = { ...r[i], macro: e.target.value }; updateRows(r); }} placeholder="Ex: Fase de pesquisa" className="border-0 bg-transparent focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><Input type="date" value={row.prazo} onChange={e => { const r = [...rows]; r[i] = { ...r[i], prazo: e.target.value }; updateRows(r); }} className="border-0 bg-transparent focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell>
                    <button onClick={() => { const r = rows.filter((_, j) => j !== i); updateRows(r.length ? r : [{ macro: '', prazo: '' }]); }} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => updateRows([...rows, { macro: '', prazo: '' }])} className="gap-1 mt-3"><Plus className="h-3.5 w-3.5" /> Adicionar linha</Button>
      </EntitySection>

      <EntitySection title="Documentos do cronograma" icon={CalendarIcon} description="Gantt em PDF, planeamentos partilhados, exports, etc.">
        <ProjectAssetGallery projectId={projectId} pageKey="cronograma" categories={['Gantt', 'Plano', 'Export']} emptyTitle="Sem documentos do cronograma" emptyDescription="Carrega Gantt, planos ou anexa links externos." />
      </EntitySection>
    </SubPageShell>
  );
}