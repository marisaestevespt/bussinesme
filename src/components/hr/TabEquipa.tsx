import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, AlertTriangle, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';
import { useMemberSave } from '@/hooks/useMemberSave';
import type { PrestadorPendingReview } from '@/hooks/useMemberSave';
import { MemberDialog } from '@/components/hr/MemberDialog';
import { MemberDetailSheet } from '@/components/hr/MemberDetailSheet';
import { SupplierReviewDialog } from '@/components/hr/SupplierReviewDialog';
import { DeptBadge, getInitials } from '@/components/hr/team-helpers';

// Members list with active/ex toggle and inline offboarding flow.
export function TabEquipa({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [dialog, setDialog] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [showExMembers, setShowExMembers] = useState(false);
  const [offboardingDialog, setOffboardingDialog] = useState<any>(null);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [settlementValue, setSettlementValue] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const { saveMember, finalizeSupplierForPrestador } = useMemberSave();
  const [supplierReview, setSupplierReview] = useState<PrestadorPendingReview | null>(null);
  const qc = useQueryClient();
  const allMembers = team.members.data || [];
  const activeMembers = allMembers.filter((m: any) => m.status === 'ativo');
  const exMembers = allMembers.filter((m: any) => m.status === 'inativo');

  const offboardingMemberId = offboardingDialog?.profile_id;
  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['offboarding-tasks', offboardingMemberId],
    enabled: !!offboardingMemberId,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, status, deadline, project_id')
        .eq('assigned_to', offboardingMemberId)
        .not('status', 'in', '("done","cancelada")');
      return data || [];
    },
  });

  const otherActiveMembers = activeMembers.filter((m: any) => m.id !== offboardingDialog?.id);

  const handleStartOffboarding = (member: any) => {
    setOffboardingDialog(member);
    setReassignments({});
    setSettlementValue('');
    setSettlementNotes('');
  };

  const confirmMemberOffboarding = async () => {
    if (!offboardingDialog) return;
    const memberId = offboardingDialog.id;

    // Batch task reassignments by target assignee (one UPDATE per group instead of one per task)
    const groups: Record<string, string[]> = {};
    for (const [taskId, newAssignee] of Object.entries(reassignments)) {
      if (newAssignee) {
        (groups[newAssignee] ||= []).push(taskId);
      }
    }
    await Promise.all(
      Object.entries(groups).map(([assignee, ids]) =>
        supabase.from('tasks').update({ assigned_to: assignee }).in('id', ids)
      )
    );

    const updates: any = {
      status: 'inativo',
      inactivated_at: new Date().toISOString(),
    };
    if (settlementValue) {
      updates.settlement_value = Number(settlementValue);
      updates.settlement_date = format(new Date(), 'yyyy-MM-dd');
      updates.settlement_notes = settlementNotes || null;
    }
    await supabase.from('team_members').update(updates).eq('id', memberId);

    if (Number(settlementValue) > 0) {
      await supabase.from('financial_expenses').insert({
        description: `Liquidação final — ${offboardingDialog.full_name}`,
        amount: Number(settlementValue),
        category: 'pessoal',
        status: 'por_pagar',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expense_month: new Date().getMonth() + 1,
        expense_quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        expense_year: new Date().getFullYear(),
      } as any);
    }

    const memberContracts = (team.contracts.data || []).filter((c: any) => c.member_id === memberId && c.status === 'ativo');
    if (memberContracts.length > 0) {
      await supabase
        .from('member_contracts')
        .update({ status: 'terminado' })
        .in('id', memberContracts.map((c: any) => c.id));
    }

    const currentUser = (await supabase.auth.getUser()).data.user;
    if (currentUser) {
      await supabase.from('notifications').insert({
        user_id: currentUser.id,
        title: `Offboarding: ${offboardingDialog.full_name}`,
        message: `Membro ${offboardingDialog.full_name} marcado como inativo. Acessos serão revogados em 7 dias.`,
        type: 'team',
      });
    }

    qc.invalidateQueries({ queryKey: ['team'] });
    toast.success('Membro marcado como inativo. Acessos serão revogados automaticamente em 7 dias.');
    setOffboardingDialog(null);
  };

  const displayMembers = showExMembers ? exMembers : activeMembers;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Equipa</h2>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              className={cn("px-3 py-1.5 transition-colors", !showExMembers ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setShowExMembers(false)}
            >
              Ativos ({activeMembers.length})
            </button>
            <button
              className={cn("px-3 py-1.5 transition-colors", showExMembers ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              onClick={() => setShowExMembers(true)}
            >
              Ex-membros ({exMembers.length})
            </button>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
      </div>
      {displayMembers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          {showExMembers ? 'Sem ex-membros.' : 'Sem membros ativos.'}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayMembers.map(m => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(m)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={(m as any).photo_url || undefined}
                        alt={m.full_name}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="text-xs font-semibold">{getInitials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-sm">{m.full_name}</h3>
                      {m.role_title && <p className="text-xs text-muted-foreground">{m.role_title}</p>}
                    </div>
                  </div>
                  <Badge variant={m.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(m.role_title || '').toLowerCase() === 'owner' ? (
                    <Badge className="text-[10px] gap-1 bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                      <Crown className="h-3 w-3" /> Owner
                    </Badge>
                  ) : (
                    <DeptBadge dept={(m as any).departments?.length ? (m as any).departments : m.department} />
                  )}
                </div>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                {(m as any).inactivated_at && showExMembers && (
                  <p className="text-[10px] text-muted-foreground">Inativo desde: {format(parseISO((m as any).inactivated_at), 'dd/MM/yyyy')}</p>
                )}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setDialog(m); }}>Editar</Button>
                  {m.status === 'inativo' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => {
                      e.stopPropagation();
                      team.upsertMember.mutate({ ...m, status: 'ativo', inactivated_at: null, access_revoked: false } as any);
                      toast.success('Membro reativado');
                    }}>Reativar</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog !== null && (
        <MemberDialog
          open
          onClose={() => setDialog(null)}
          initial={dialog}
          onSave={async (payload: any) => {
            const result = await saveMember(payload);
            if (result?.prestadorPending) setSupplierReview(result.prestadorPending);
          }}
        />
      )}
      {supplierReview && (
        <SupplierReviewDialog
          open
          memberName={supplierReview.memberName}
          initial={supplierReview.draft}
          onCancel={() => {
            toast.info('Podes criar a ficha de fornecedor mais tarde em Fornecedores.');
            setSupplierReview(null);
          }}
          onConfirm={async (draft) => {
            const ok = await finalizeSupplierForPrestador({
              memberId: supplierReview.memberId,
              memberName: supplierReview.memberName,
              contract: supplierReview.contract,
              supplier: draft,
            });
            if (ok) setSupplierReview(null);
          }}
        />
      )}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} onOffboard={(m: any) => { setSelected(null); handleStartOffboarding(m); }} />}

      <Dialog open={!!offboardingDialog} onOpenChange={() => setOffboardingDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Offboarding — {offboardingDialog?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  {pendingTasks.length} tarefa(s) pendente(s) para reatribuir
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                      <span className="flex-1 truncate">{t.name}</span>
                      {t.deadline && <span className="text-[10px] text-muted-foreground shrink-0">{t.deadline}</span>}
                      <Select value={reassignments[t.id] || ''} onValueChange={v => setReassignments(p => ({ ...p, [t.id]: v }))}>
                        <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="Reatribuir a..." /></SelectTrigger>
                        <SelectContent>
                          {otherActiveMembers.map((m: any) => (
                            <SelectItem key={m.id} value={m.profile_id || m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingTasks.length === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                ✓ Sem tarefas pendentes para reatribuir.
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Liquidação Final</h3>
              <p className="text-xs text-muted-foreground">Registar valor de liquidação (será criada uma despesa automaticamente).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Valor (€)</label>
                  <Input type="number" placeholder="0.00" value={settlementValue} onChange={e => setSettlementValue(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas</label>
                  <Input placeholder="Ex: férias não gozadas..." value={settlementNotes} onChange={e => setSettlementNotes(e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p>Ao confirmar:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>O membro será marcado como <strong>inativo</strong></li>
                <li>Os contratos ativos serão terminados</li>
                <li>As tarefas selecionadas serão reatribuídas</li>
                {Number(settlementValue) > 0 && <li>Será criada uma despesa de liquidação de <strong>{Number(settlementValue).toFixed(2)}€</strong></li>}
                <li>Os acessos serão <strong>revogados automaticamente em 7 dias</strong></li>
                <li>O membro ficará na tab <strong>"Ex-membros"</strong> (pode ser reativado)</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOffboardingDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmMemberOffboarding}>Confirmar Offboarding</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}