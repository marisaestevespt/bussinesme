import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { computeFiscalDeadlines, getDeadlineStatus, type FiscalConfig, type FiscalDeadline } from '@/lib/fiscalDeadlines';
import { CalendarCheck, CheckSquare, Info, AlertTriangle, Clock, ListPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const ML = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  currentYear: number;
}

export function FinContabilidade({ currentYear }: Props) {
  const { settings } = useBusinessSettings();
  const { user } = useAuth();
  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const qc = useQueryClient();

  const s = settings as any;
  const fiscalConfig: FiscalConfig = {
    taxIvaRegime: s?.tax_iva_regime || 'trimestral',
    taxIrsRegime: s?.tax_irs_regime || 'simplificado',
    ssExempt: s?.ss_exempt ?? false,
    ivaExempt: s?.iva_exempt ?? false,
    hasAccountant: s?.has_accountant ?? false,
  };

  const isContabOrganizada = fiscalConfig.taxIrsRegime === 'contabilidade_organizada';
  const hasAccountant = s?.has_accountant ?? false;
  const accountantMemberId = s?.accountant_member_id || null;

  // Get the accountant's profile. has_accountant is kept in sync with accountant_member_id by a DB trigger.
  const { data: accountantMember } = useQuery({
    queryKey: ['accountant-member', accountantMemberId],
    enabled: !!accountantMemberId,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, profile_id').eq('id', accountantMemberId).maybeSingle();
      return data;
    },
  });

  const deadlines = useMemo(() => {
    return computeFiscalDeadlines(currentYear, fiscalConfig)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentYear, fiscalConfig]);

  // Fiscal deadline completions
  const { data: completions = [] } = useQuery({
    queryKey: ['fiscal-deadline-completions', currentYear],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_deadline_completions' as any).select('*').eq('year', currentYear);
      return (data || []) as unknown as { id: string; deadline_key: string; year: number; completed_by: string }[];
    },
  });

  const completedKeys = useMemo(
    () => new Set(completions.map(c => c.deadline_key)),
    [completions],
  );

  const toggleDeadlineCompletion = useMutation({
    mutationFn: async (dl: FiscalDeadline) => {
      if (!user) throw new Error('Not authenticated');
      const existing = completions.find(c => c.deadline_key === dl.key);
      if (existing) {
        await supabase.from('fiscal_deadline_completions' as any).delete().eq('id', existing.id);
      } else {
        await supabase.from('fiscal_deadline_completions' as any).insert({ deadline_key: dl.key, year: currentYear, completed_by: user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-deadline-completions', currentYear] });
    },
    onError: () => toast.error('Erro ao atualizar estado'),
  });

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const handleCreateTask = async (dl: FiscalDeadline) => {
    if (!user) return;
    setCreatingTask(dl.key);
    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('name', dl.name)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.info('Já existe uma tarefa com este nome.');
        return;
      }

      // Assignment: declarations go to the accountant if linked; payments and everything else → owner.
      let assignedTo = user.id;
      if (dl.deadline_type === 'declaracao' && hasAccountant && accountantMember?.profile_id) {
        assignedTo = accountantMember.profile_id;
      }

      await supabase.from('tasks').insert({
        name: dl.name,
        status: 'por_comecar',
        priority: 'alta',
        deadline: dl.date,
        department: 'contabilidade',
        created_by: user.id,
        assigned_to: assignedTo,
        tag: 'Fiscal',
      });
      toast.success('Tarefa criada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar tarefa');
    } finally {
      setCreatingTask(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Prazos Fiscais ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Prazos Fiscais — {currentYear}</h2>
        </div>

        {isContabOrganizada ? (
          <Card className="border-warning/30 bg-warning/15/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-4 flex gap-2">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Em contabilidade organizada, os prazos fiscais são geridos pelo teu contabilista.</p>
            </CardContent>
          </Card>
        ) : deadlines.length === 0 ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sem prazos fiscais activos. Configura o regime fiscal nas Definições.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Limite</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Atribuído a</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadlines.map(dl => {
                    const isCompleted = completedKeys.has(dl.key);
                    const status = isCompleted ? 'done' : getDeadlineStatus(dl.date, todayStr);
                    const assigneeName = hasAccountant && accountantMember?.full_name
                      ? accountantMember.full_name
                      : 'Owner';
                    return (
                      <TableRow key={dl.key} className={isCompleted ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{dl.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {dl.deadline_type === 'pagamento' ? 'Pagamento' : 'Declaração'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(dl.date + 'T00:00:00').toLocaleDateString('pt-PT')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => toggleDeadlineCompletion.mutate(dl)}
                            />
                            {status === 'done' && <Badge className="bg-success/10 text-success gap-1"><CheckSquare className="h-3 w-3" /> Concluído</Badge>}
                            {status === 'overdue' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Em atraso</Badge>}
                            {status === 'soon' && <Badge className="bg-warning/15 text-warning dark:bg-amber-900/30 dark:text-amber-400 gap-1"><Clock className="h-3 w-3" /> Próximo</Badge>}
                            {status === 'upcoming' && <Badge variant="secondary" className="gap-1">Por vir</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{assigneeName}</TableCell>
                        <TableCell className="text-right">
                          {!isCompleted && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={creatingTask === dl.key}
                              onClick={() => handleCreateTask(dl)}
                              title="Criar tarefa"
                              aria-label="Criar tarefa"
                              className="h-8 w-8"
                            >
                              <ListPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
