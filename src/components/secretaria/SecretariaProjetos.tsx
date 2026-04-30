import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMyProjects, PROJ_STATUS_MAP } from './secretaria-shared';

export default function SecretariaProjetos() {
  const projects = useMyProjects();
  const [view, setView] = useState<'ativos' | 'todos'>('ativos');
  const filtered = view === 'ativos' ? (projects.data || []).filter(p => p.status === 'em_curso') : (projects.data || []);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Button variant={view === 'ativos' ? 'default' : 'outline'} size="sm" onClick={() => setView('ativos')}>Ativos</Button>
        <Button variant={view === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setView('todos')}>Todos</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projeto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Data de entrega</TableHead>
            <TableHead>Departamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem projetos.</TableCell></TableRow>}
          {filtered.map((p: any) => {
            const si = PROJ_STATUS_MAP[p.status] || { label: p.status, color: '' };
            return (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/hub/projetos/${p.id}`, '_self')}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{p.type === 'clientes' || p.type === 'cliente_projeto_unico' ? 'Cliente - Projeto Único' : p.type === 'cliente_servico_mensal' ? 'Cliente - Serviço Mensal' : p.type === 'lancamento' ? 'Interno - Lançamento' : 'Interno'}</Badge></TableCell>
                <TableCell><Badge className={cn('text-[10px]', si.color)}>{si.label}</Badge></TableCell>
                <TableCell><div className="flex items-center gap-2"><Progress value={p.progress || 0} className="h-1.5 w-16" /><span className="text-xs">{p.progress || 0}%</span></div></TableCell>
                <TableCell className="text-sm">{p.deadline ? format(parseISO(p.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{(() => {
                  const arr = Array.isArray((p as any).departments) ? (p as any).departments.filter(Boolean) : [];
                  if (arr.length > 0) return arr.join(', ');
                  return p.department || '—';
                })()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
