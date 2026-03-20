import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { usePlanningRoutines } from '@/hooks/usePlanningRoutines';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  para_criar: { label: 'Para criar', className: 'bg-muted text-muted-foreground' },
  em_progresso: { label: 'Em progresso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 border-green-200' },
  a_rever: { label: 'A rever', className: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export function CommercialProcessos() {
  const navigate = useNavigate();
  const planningRoutines = usePlanningRoutines();

  const sops = useQuery({
    queryKey: ['sops', 'comercial'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').eq('department', 'comercial').order('sop_id');
      return data || [];
    },
  });

  const routinesData = planningRoutines.routines.data || [];

  return (
    <div className="space-y-8">
      {/* SOPs */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Processos (SOPs)</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Produto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sops.data || []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem processos neste departamento</TableCell></TableRow>
              )}
              {(sops.data || []).map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.para_criar;
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/hub/processos/${s.id}`)}>
                    <TableCell className="font-mono text-sm">{s.sop_id}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                    <TableCell>{s.product_name || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      <Separator />

      {/* Rotinas */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Rotinas</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routinesData.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem rotinas configuradas</TableCell></TableRow>
              )}
              {routinesData.map((pr: any) => {
                const assignee = pr.profiles;
                const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                const recLabel = pr.recurrence_type === 'semanal'
                  ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                  : `Mensal — dia ${pr.month_day}${hourLabel}`;
                return (
                  <TableRow key={pr.id}>
                    <TableCell className="font-medium">{pr.title}</TableCell>
                    <TableCell>{recLabel}</TableCell>
                    <TableCell>
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={assignee.avatar_url || ''} />
                            <AvatarFallback className="text-[10px]">{(assignee.full_name || '?')[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{assignee.full_name}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px]">
                        {pr.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={pr.active}
                          onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
