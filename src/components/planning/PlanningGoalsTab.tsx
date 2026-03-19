import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { planStatusLabel, PERIODS, GOAL_STATUSES } from '@/hooks/usePlanningData';

export function PlanningGoalsTab({ planning }: { planning: any }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [view, setView] = useState('por_objetivo');
  const [form, setForm] = useState({ objective_id: '', period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });

  const allGoals = planning.allGoals;
  const objectives = planning.allObjectives;

  const filteredGoals = useMemo(() => {
    let g = allGoals;
    if (filter === 'com_desvio') g = g.filter((x: any) => x.actual_value && x.target_value && Number(x.actual_value) < Number(x.target_value));
    if (filter === 'atingidas') g = g.filter((x: any) => x.status === 'atingido');
    if (filter === 'por_iniciar') g = g.filter((x: any) => x.status === 'por_iniciar');
    return g;
  }, [allGoals, filter]);

  const handleSave = () => {
    planning.upsertGoal.mutate(form);
    setDialogOpen(false);
    setForm({ objective_id: '', period: 'Janeiro', target_value: '', actual_value: '', status: 'por_iniciar' });
  };

  const getObjectiveName = (id: string) => objectives.find((o: any) => o.id === id)?.title || '—';

  // Group goals
  const grouped = useMemo(() => {
    if (view === 'por_objetivo') {
      const map: Record<string, any[]> = {};
      filteredGoals.forEach((g: any) => {
        const key = g.objective_id || 'sem_objetivo';
        if (!map[key]) map[key] = [];
        map[key].push(g);
      });
      return map;
    }
    return { all: filteredGoals };
  }, [filteredGoals, view]);

  const monthOrder = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'T1', 'T2', 'T3', 'T4'];

  const sortByPeriod = (a: any, b: any) => monthOrder.indexOf(a.period) - monthOrder.indexOf(b.period);

  const getObjectiveArea = (id: string) => {
    const obj = objectives.find((o: any) => o.id === id);
    if (!obj) return null;
    const areas: Record<string, string> = { financeiro: 'Financeiro', comercial: 'Comercial', marketing: 'Marketing', operacao: 'Operação', equipa: 'Equipa', inovacao: 'Inovação', outro: 'Outro' };
    return areas[obj.area] || obj.area;
  };

  const getObjectiveDeadline = (id: string) => objectives.find((o: any) => o.id === id)?.deadline || null;

  const renderGoalRow = (g: any, showObjective: boolean) => {
    const dev = g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null;
    const hasDeviation = dev !== null && dev < 0;
    const area = getObjectiveArea(g.objective_id);
    const deadline = getObjectiveDeadline(g.objective_id);
    return (
      <TableRow key={g.id} className={hasDeviation ? 'bg-red-50/50' : ''}>
        {showObjective && <TableCell className="text-xs">{getObjectiveName(g.objective_id)}</TableCell>}
        <TableCell className="text-sm">{g.period}</TableCell>
        <TableCell className="text-xs">{area ? <Badge variant="outline" className="text-[10px]">{area}</Badge> : '—'}</TableCell>
        <TableCell className="text-xs">{deadline || '—'}</TableCell>
        <TableCell className="text-xs">{g.target_value || '—'}</TableCell>
        <TableCell className="text-xs">{g.actual_value || '—'}</TableCell>
        <TableCell className={`text-xs ${hasDeviation ? 'text-destructive font-medium' : ''}`}>{dev != null ? (dev >= 0 ? `+${dev}` : dev) : '—'}</TableCell>
        <TableCell>
          <Badge variant={g.status === 'atingido' ? 'default' : g.status === 'nao_atingido' ? 'destructive' : 'secondary'} className="text-[10px]">
            {planStatusLabel(g.status)}
          </Badge>
          {hasDeviation && g.status !== 'atingido' && <Badge variant="destructive" className="text-[9px] ml-1">Desvio</Badge>}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {['todos', 'com_desvio', 'atingidas', 'por_iniciar'].map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="text-xs h-7">
              {f === 'todos' ? 'Todos' : f === 'com_desvio' ? 'Com desvio' : f === 'atingidas' ? 'Atingidas' : 'Por iniciar'}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="por_objetivo">Por objetivo</SelectItem>
              <SelectItem value="por_mes">Por mês</SelectItem>
              <SelectItem value="por_trimestre">Por trimestre</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Meta</Button>
        </div>
      </div>

      {filteredGoals.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem metas registadas. Crie metas a partir dos objetivos ou diretamente aqui.
        </CardContent></Card>
      ) : view === 'por_objetivo' ? (
        Object.entries(grouped).map(([objId, goals]) => (
          <Card key={objId}>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">{objId === 'sem_objetivo' ? 'Sem objetivo' : getObjectiveName(objId)}</h3>
              <Table>
                <TableHeader><TableRow>
                   <TableHead>Período</TableHead><TableHead>Área</TableHead><TableHead>Prazo</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{(goals as any[]).sort(sortByPeriod).map(g => renderGoalRow(g, false))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader><TableRow>
                 <TableHead>Objetivo</TableHead><TableHead>Período</TableHead><TableHead>Área</TableHead><TableHead>Prazo</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredGoals
                  .filter((g: any) => view === 'por_trimestre' ? g.period_type === 'trimestral' : g.period_type === 'mensal')
                  .sort(sortByPeriod)
                  .map((g: any) => renderGoalRow(g, true))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Objetivo Anual</Label>
              <Select value={form.objective_id || '_none'} onValueChange={v => setForm(p => ({ ...p, objective_id: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar objetivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem objetivo</SelectItem>
                  {objectives.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Período</Label>
              <Select value={form.period} onValueChange={v => setForm(p => ({ ...p, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor alvo</Label><Input value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} /></div>
              <div><Label>Valor real</Label><Input value={form.actual_value} onChange={e => setForm(p => ({ ...p, actual_value: e.target.value }))} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.objective_id}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
