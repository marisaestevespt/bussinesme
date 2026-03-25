import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KEY = ['team'];

export const MEMBER_STATUSES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'prestador', label: 'Prestador' },
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

export function useTeamData() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  // Members
  const members = useQuery({
    queryKey: [...KEY, 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('full_name');
      return data || [];
    },
  });

  const upsertMember = useMutation({
    mutationFn: async (m: any) => {
      // Clean empty strings to null for nullable/date columns
      const cleaned: any = {};
      for (const [k, v] of Object.entries(m)) {
        cleaned[k] = v === '' ? null : v;
      }
      if (cleaned.id) {
        const { error } = await supabase.from('team_members').update(cleaned).eq('id', cleaned.id);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await supabase.from('team_members').insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar membro'),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Onboarding
  const onboarding = useQuery({
    queryKey: [...KEY, 'onboarding'],
    queryFn: async () => {
      const { data } = await supabase.from('member_onboarding').select('*').order('sort_order');
      return data || [];
    },
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
    queryFn: async () => {
      const { data } = await supabase.from('performance_weekly').select('*').order('week_start', { ascending: false });
      return data || [];
    },
  });

  const upsertPerfWeekly = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('performance_weekly').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('performance_weekly').insert(rec);
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
    queryFn: async () => {
      const { data } = await supabase.from('performance_monthly').select('*').order('year', { ascending: false });
      return data || [];
    },
  });

  const upsertPerfMonthly = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('performance_monthly').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('performance_monthly').insert(rec);
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

  // Feedback
  const feedback = useQuery({
    queryKey: [...KEY, 'feedback'],
    queryFn: async () => {
      const { data } = await supabase.from('feedback_sessions').select('*').order('session_date', { ascending: false });
      return data || [];
    },
  });

  const upsertFeedback = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('feedback_sessions').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('feedback_sessions').insert(rec);
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
    queryFn: async () => {
      const { data } = await supabase.from('member_contracts').select('*').order('start_date', { ascending: false });
      return data || [];
    },
  });

  const upsertContract = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('member_contracts').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('member_contracts').insert(rec);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar contrato'),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Payments
  const payments = useQuery({
    queryKey: [...KEY, 'payments'],
    queryFn: async () => {
      const { data } = await supabase.from('member_payments').select('*').order('year', { ascending: false });
      return data || [];
    },
  });

  const upsertPayment = useMutation({
    mutationFn: async (rec: any) => {
      if (rec.id) {
        const { error } = await supabase.from('member_payments').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        delete rec.id;
        const { error } = await supabase.from('member_payments').insert(rec);
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
