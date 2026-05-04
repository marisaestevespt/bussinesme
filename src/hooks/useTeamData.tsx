import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';

type TeamMember = Tables<'team_members'>;
type PerformanceWeekly = Tables<'performance_weekly'>;
type PerformanceMonthly = Tables<'performance_monthly'>;
type FeedbackSession = Tables<'feedback_sessions'>;
type MemberContract = Tables<'member_contracts'>;
type MemberPayment = Tables<'member_payments'>;

const KEY = ['team'];

export const MEMBER_STATUSES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

export const MEMBER_TYPES = [
  { value: 'colaborador_fixo', label: 'Colaborador Fixo' },
  { value: 'prestador_servicos', label: 'Prestador de Serviços' },
  { value: 'socio', label: 'Sócio' },
];

export const CONTRACT_TYPES = [
  { value: 'contrato_trabalho', label: 'Contrato de Trabalho' },
  { value: 'contrato_prestacao', label: 'Contrato de Prestação de Serviços' },
  { value: 'acordo', label: 'Acordo' },
  { value: 'outro', label: 'Outro' },
];

export const CONTRACT_STATUSES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'terminado', label: 'Terminado' },
  { value: 'em_renovacao', label: 'Em renovação' },
];

export const PAYMENT_TYPES = [
  { value: 'salario', label: 'Salário' },
  { value: 'prestacao', label: 'Prestação de Serviços' },
  { value: 'bonus', label: 'Bónus' },
  { value: 'outro', label: 'Outro' },
];

export const PAYMENT_STATUSES = [
  { value: 'por_pagar', label: 'Por Pagar' },
  { value: 'pago', label: 'Pago' },
];

export const WORK_AREAS = [
  { value: 'interno', label: 'Trabalho Interno', description: 'Tarefas internas do negócio (ex: marketing, contabilidade, operações)' },
  { value: 'cliente_administrativo', label: 'Cliente — Administrativo', description: 'Gestão administrativa de clientes (onboarding, documentos, comunicação)' },
  { value: 'cliente_servico', label: 'Cliente — Entrega / Serviço', description: 'Trabalho direto com o cliente (prestar o serviço, sessões, entregas)' },
  { value: 'cliente_comercial', label: 'Cliente — Comercial', description: 'Angariação, vendas, renovações e relacionamento comercial' },
];

export const FEEDBACK_TYPES = [
  { value: 'feedback_formal', label: 'Feedback Formal' },
  { value: 'checkin_rapido', label: 'Check-in Rápido' },
  { value: 'avaliacao_periodo', label: 'Avaliação de Período' },
  { value: 'outro', label: 'Outro' },
];

export const PERFORMANCE_STATUSES = [
  { value: 'dentro_esperado', label: 'Dentro do esperado' },
  { value: 'abaixo_esperado', label: 'Abaixo do esperado' },
  { value: 'acima_esperado', label: 'Acima do esperado' },
];

export function labelFor(list: { value: string; label: string }[], val: string) {
  return list.find(i => i.value === val)?.label || val;
}

function cleanRecord<T extends Record<string, unknown>>(m: T): T {
  const cleaned = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(m)) {
    cleaned[k] = v === '' ? null : v;
  }
  return cleaned as T;
}

/**
 * Options to control which datasets are loaded.
 * Defaults to true for everything (back-compat), but pages that only need
 * a subset (e.g. just members) should pass `{ members: true }` etc.
 */
export interface UseTeamDataOptions {
  members?: boolean;
  onboarding?: boolean;
  perfWeekly?: boolean;
  perfMonthly?: boolean;
  feedback?: boolean;
  contracts?: boolean;
  payments?: boolean;
  /** Limit window for time-bounded datasets (feedback/payments). Defaults to current + last year. */
  yearFrom?: number;
}

export function useTeamData(options: UseTeamDataOptions = {}) {
  const opts = {
    members: options.members ?? true,
    onboarding: options.onboarding ?? true,
    perfWeekly: options.perfWeekly ?? true,
    perfMonthly: options.perfMonthly ?? true,
    feedback: options.feedback ?? true,
    contracts: options.contracts ?? true,
    payments: options.payments ?? true,
    yearFrom: options.yearFrom ?? (new Date().getFullYear() - 1),
  };
  const qc = useQueryClient();
  // Force active queries to refetch immediately (not just mark stale)
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY, refetchType: 'active' });

  // Members
  const members = useQuery({
    queryKey: [...KEY, 'members'],
    enabled: opts.members,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('full_name');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertMember = useMutation({
    mutationFn: async (m: Partial<TeamMember> & { full_name: string }) => {
      const cleaned = cleanRecord(m as Record<string, unknown>);
      if (cleaned.id) {
        const { error } = await supabase.from('team_members').update(cleaned as TablesUpdate<'team_members'>).eq('id', cleaned.id as string);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await supabase.from('team_members').insert(cleaned as TablesInsert<'team_members'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar membro'),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { data: snap } = await supabase.from('team_members').select('full_name, email').eq('id', id).maybeSingle();
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
      logAudit('deleted', 'team_member', id, { name: snap?.full_name, email: snap?.email });
    },
    onSuccess: invalidate,
  });

  // Onboarding
  const onboarding = useQuery({
    queryKey: [...KEY, 'onboarding'],
    enabled: opts.onboarding,
    queryFn: async () => {
      const { data } = await supabase.from('member_onboarding').select('*').order('sort_order');
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const addOnboardingItem = useMutation({
    mutationFn: async (rec: { member_id: string; task: string }) => {
      const { error } = await supabase.from('member_onboarding').insert(rec);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleOnboardingItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('member_onboarding').update({ completed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteOnboardingItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_onboarding').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Performance Weekly
  const perfWeekly = useQuery({
    queryKey: [...KEY, 'perf_weekly'],
    enabled: opts.perfWeekly,
    queryFn: async () => {
      const { data } = await supabase.from('performance_weekly').select('*').order('week_start', { ascending: false }).limit(200);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertPerfWeekly = useMutation({
    mutationFn: async (rec: Partial<PerformanceWeekly> & { member_id: string; week_start: string }) => {
      if (rec.id) {
        const { error } = await supabase.from('performance_weekly').update(rec as TablesUpdate<'performance_weekly'>).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('performance_weekly').insert(rec as TablesInsert<'performance_weekly'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar performance'),
  });

  const deletePerfWeekly = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('performance_weekly').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Performance Monthly
  const perfMonthly = useQuery({
    queryKey: [...KEY, 'perf_monthly'],
    enabled: opts.perfMonthly,
    queryFn: async () => {
      const { data } = await supabase.from('performance_monthly').select('*').order('year', { ascending: false }).limit(200);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertPerfMonthly = useMutation({
    mutationFn: async (rec: Partial<PerformanceMonthly> & { member_id: string; month: number; year: number }) => {
      if (rec.id) {
        const { error } = await supabase.from('performance_monthly').update(rec as TablesUpdate<'performance_monthly'>).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('performance_monthly').insert(rec as TablesInsert<'performance_monthly'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar performance'),
  });

  const deletePerfMonthly = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('performance_monthly').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Feedback (limited to recent years to avoid hitting row limits)
  const feedback = useQuery({
    queryKey: [...KEY, 'feedback', opts.yearFrom],
    enabled: opts.feedback,
    queryFn: async () => {
      const fromDate = `${opts.yearFrom}-01-01`;
      const { data } = await supabase.from('feedback_sessions')
        .select('*')
        .gte('session_date', fromDate)
        .order('session_date', { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertFeedback = useMutation({
    mutationFn: async (rec: Partial<FeedbackSession> & { member_id: string }) => {
      if (rec.id) {
        const { error } = await supabase.from('feedback_sessions').update(rec as TablesUpdate<'feedback_sessions'>).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('feedback_sessions').insert(rec as TablesInsert<'feedback_sessions'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar feedback'),
  });

  const deleteFeedback = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feedback_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Contracts
  const contracts = useQuery({
    queryKey: [...KEY, 'contracts'],
    enabled: opts.contracts,
    queryFn: async () => {
      const { data } = await supabase.from('member_contracts').select('*').order('start_date', { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertContract = useMutation({
    mutationFn: async (rec: Partial<MemberContract> & { member_id: string }) => {
      if (rec.id) {
        const { error } = await supabase.from('member_contracts').update(rec as TablesUpdate<'member_contracts'>).eq('id', rec.id);
        if (error) throw error;

        // If contract has an end_date, prune unpaid payments/payroll AFTER that date.
        // Paid entries are never touched.
        if (rec.end_date) {
          const end = new Date(rec.end_date);
          const endY = end.getFullYear();
          const endM = end.getMonth() + 1;
          const { data: allUnpaid } = await supabase
            .from('member_payments')
            .select('id, month, year')
            .eq('member_id', rec.member_id)
            .eq('status', 'por_pagar');
          const toDelete = (allUnpaid || [])
            .filter(p => p.year > endY || (p.year === endY && p.month > endM))
            .map(p => p.id);
          if (toDelete.length > 0) {
            await supabase.from('member_payments').delete().in('id', toDelete);
          }
          const { data: memberRow } = await supabase.from('team_members').select('full_name').eq('id', rec.member_id).maybeSingle();
          if (memberRow?.full_name) {
            const { data: allUnpaidPay } = await supabase
              .from('financial_payroll')
              .select('id, month, year')
              .eq('collaborator_name', memberRow.full_name)
              .eq('status', 'por_pagar');
            const payDel = (allUnpaidPay || [])
              .filter(p => p.year > endY || (p.year === endY && p.month > endM))
              .map(p => p.id);
            if (payDel.length > 0) {
              await supabase.from('financial_payroll').delete().in('id', payDel);
            }
          }
        }

        // Update unpaid future payments with the new monthly value
        const newVal = Number(rec.monthly_value) || 0;
        if (newVal > 0) {
          const now = new Date();
          const curMonth = now.getMonth() + 1;
          const curYear = now.getFullYear();

          // Update member_payments still unpaid from current month onwards
          const { data: unpaid } = await supabase
            .from('member_payments')
            .select('id, month, year')
            .eq('member_id', rec.member_id)
            .eq('status', 'por_pagar');

          if (unpaid && unpaid.length > 0) {
            const futureIds = unpaid
              .filter(p => p.year > curYear || (p.year === curYear && p.month >= curMonth))
              .map(p => p.id);

            if (futureIds.length > 0) {
              await supabase
                .from('member_payments')
                .update({ gross_value: newVal, net_value: newVal })
                .in('id', futureIds);
            }
          }

          // Update financial_payroll still unpaid from current month onwards
          const { data: memberData } = await supabase.from('team_members').select('full_name').eq('id', rec.member_id).maybeSingle();
          if (memberData?.full_name) {
            const { data: unpaidPayroll } = await supabase
              .from('financial_payroll')
              .select('id, month, year')
              .eq('collaborator_name', memberData.full_name)
              .eq('status', 'por_pagar');

            if (unpaidPayroll && unpaidPayroll.length > 0) {
              const futurePayrollIds = unpaidPayroll
                .filter(p => p.year > curYear || (p.year === curYear && p.month >= curMonth))
                .map(p => p.id);

              if (futurePayrollIds.length > 0) {
                await supabase
                  .from('financial_payroll')
                  .update({ gross_salary: newVal, net_salary: newVal, total_cost: newVal })
                  .in('id', futurePayrollIds);
              }
            }
          }
        }
      } else {
        delete rec.id;
        const { error, data: newContract } = await supabase.from('member_contracts').insert(rec as TablesInsert<'member_contracts'>).select().single();
        if (error) throw error;

        // Auto-generate payroll for new contracts
        const monthlyVal = Number(rec.monthly_value) || 0;
        if (monthlyVal > 0 && rec.start_date) {
          const startDate = new Date(rec.start_date);
          let numMonths = 12; // default
          if (rec.end_date) {
            const endDate = new Date(rec.end_date);
            numMonths = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1);
          }
          // Get member name
          const { data: memberData } = await supabase.from('team_members').select('full_name').eq('id', rec.member_id).maybeSingle();
          const name = memberData?.full_name || 'Membro';

          const payrollEntries = [];
          const paymentEntries = [];
          for (let i = 0; i < numMonths; i++) {
            const payMonth = ((startDate.getMonth() + i) % 12) + 1;
            const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
            payrollEntries.push({
              collaborator_name: name,
              month: payMonth, year: payYear,
              gross_salary: monthlyVal, net_salary: monthlyVal, total_cost: monthlyVal,
              status: 'por_pagar',
              withholding_rate: 0, withholding_value: 0, ss_employee: 0, ss_employer: 0,
            });
            paymentEntries.push({
              member_id: rec.member_id, month: payMonth, year: payYear,
              gross_value: monthlyVal, net_value: monthlyVal,
              payment_type: rec.contract_type === 'contrato_prestacao' ? 'prestacao' as const : 'salario' as const,
              status: 'por_pagar',
            });
          }
          await Promise.all([
            supabase.from('financial_payroll').insert(payrollEntries),
            supabase.from('member_payments').insert(paymentEntries),
          ]);
        }
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Contrato guardado e pagamentos gerados');
    },
    onError: () => toast.error('Erro ao guardar contrato'),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Payments (limited to recent years to avoid hitting row limits)
  const payments = useQuery({
    queryKey: [...KEY, 'payments', opts.yearFrom],
    enabled: opts.payments,
    queryFn: async () => {
      const { data } = await supabase.from('member_payments')
        .select('*')
        .gte('year', opts.yearFrom)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const upsertPayment = useMutation({
    mutationFn: async (rec: Partial<MemberPayment> & { member_id: string }) => {
      if (rec.id) {
        const { error } = await supabase.from('member_payments').update(rec as TablesUpdate<'member_payments'>).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('member_payments').insert(rec as TablesInsert<'member_payments'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar pagamento'),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    members, upsertMember, deleteMember,
    onboarding, addOnboardingItem, toggleOnboardingItem, deleteOnboardingItem,
    perfWeekly, upsertPerfWeekly, deletePerfWeekly,
    perfMonthly, upsertPerfMonthly, deletePerfMonthly,
    feedback, upsertFeedback, deleteFeedback,
    contracts, upsertContract, deleteContract,
    payments, upsertPayment, deletePayment,
    invalidate,
  };
}
