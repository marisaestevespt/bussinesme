import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { resolveProductId } from '@/lib/productResolver';
import { logAudit } from '@/lib/auditLog';
import { requireConfirm, confirmDestructive, ConfirmCancelledError } from '@/lib/confirmDestructive';
import { confirmNoClientDuplicates } from '@/lib/clientDuplicateCheck';

export type Client = Tables<'clients'>;
export type ClientHistory = Tables<'client_history'>;
export type ClientActivity = Tables<'client_activities'>;
export type ClientOnboarding = Tables<'client_onboarding'>;
export type ClientOffboarding = Tables<'client_offboarding'>;

// Re-export from canonical source. Existing imports keep working.
export { CLIENT_STATUS_OPTIONS } from '@/lib/clientStatus';

export function useClients() {
  const qc = useQueryClient();

  const clientsQuery = useInfiniteQuery<InfinitePageResult<Client>>({
    queryKey: ['clients'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase.from('clients').select('id,client_id,full_name,email,status,current_product,current_product_id,start_date,end_of_cycle,conversion_date,dp,whatsapp,birthday,nif,fiscal_address,payment_method,observations,drive_folder_url,documents,whatsapp_group_url,created_at,updated_at,created_by,client_files,portal_deactivation_date,final_settlement_amount,final_settlement_notes,final_settlement_status,is_legacy,legacy_product_description,renegotiation_status,renegotiation_reason,renegotiation_started_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
      if (error) throw error;
      return { data: (data || []) as Client[], count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });

  const clients = {
    ...clientsQuery,
    data: flattenInfiniteData(clientsQuery.data?.pages),
    totalCount: getInfiniteCount(clientsQuery.data?.pages),
  };

  const upsertClient = useMutation({
    mutationFn: async (client: Partial<Client> & { full_name: string }) => {
      // Auto-resolve current_product_id from current_product name when not explicitly provided.
      // The DB trigger keeps current_product (text) in sync from the FK, so the FK is the source of truth.
      if (client.current_product !== undefined && client.current_product_id === undefined) {
        client.current_product_id = await resolveProductId(client.current_product);
      }
      if (client.id) {
        const { error } = await supabase.from('clients').update(client as TablesUpdate<'clients'>).eq('id', client.id);
        if (error) throw error;
      } else {
        // Aviso suave: NIF/email já existem noutro cliente?
        const ok = await confirmNoClientDuplicates({ nif: client.nif as string | null | undefined, email: client.email as string | null | undefined });
        if (!ok) throw new ConfirmCancelledError();
        const { id, ...rest } = client;
        const { error } = await supabase.from('clients').insert(rest as TablesInsert<'clients'>);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
    onError: () => toast.error('Erro ao guardar cliente'),
  });

  /**
   * Reactiva um cliente terminado: volta a status='ativo' e regista entrada no histórico.
   */
  const reactivateClient = useMutation({
    mutationFn: async (clientId: string) => {
      const ok = await confirmDestructive({
        title: 'Reactivar cliente?',
        description: 'O cliente volta ao estado "ativo" e fica disponível em listas, portal e relatórios. Será adicionada uma entrada ao histórico.',
        confirmText: 'Reactivar',
        cancelText: 'Cancelar',
      });
      if (!ok) throw new ConfirmCancelledError();
      const { error } = await supabase.from('clients').update({
        status: 'ativo',
        portal_deactivation_date: null,
      } as TablesUpdate<'clients'>).eq('id', clientId);
      if (error) throw error;
      await supabase.from('client_history').insert({
        client_id: clientId,
        entry_date: new Date().toISOString().slice(0, 10),
        milestone: 'Reactivação',
        observations: 'Cliente reactivado a partir do estado terminado.',
      } as TablesInsert<'client_history'>);
      logAudit('updated', 'client', clientId, { action: 'reactivated' });
    },
    onSuccess: (_d, clientId) => {
      toast.success('Cliente reactivado');
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', clientId] });
      qc.invalidateQueries({ queryKey: ['client_history', clientId] });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { data: snap } = await supabase.from('clients').select('full_name, client_id').eq('id', id).maybeSingle();
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      logAudit('deleted', 'client', id, { name: snap?.full_name, client_id: snap?.client_id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const duplicateClient = useMutation({
    mutationFn: async (source: Client) => {
      const { id, client_id, created_at, updated_at, ...rest } = source;
      const { error } = await supabase.from('clients').insert({ ...rest, full_name: `${source.full_name} (cópia)`, client_id: undefined } as TablesInsert<'clients'>);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Ficha duplicada'); },
  });

  return { clients, upsertClient, deleteClient, duplicateClient, reactivateClient };
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!id,
  });
}

export function useClientHistory(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_history', clientId];

  const history = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from('client_history').select('*').eq('client_id', clientId).order('entry_date', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientHistory[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: TablesInsert<'client_history'>) => {
      const { error } = await supabase.from('client_history').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'client_history'> & { id: string }) => {
      const { error } = await supabase.from('client_history').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('client_history').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { history, addEntry, updateEntry, deleteEntry };
}

export function useClientActivities(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_activities', clientId];

  const activities = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from('client_activities').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientActivity[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: TablesInsert<'client_activities'>) => {
      const { error } = await supabase.from('client_activities').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'client_activities'> & { id: string }) => {
      const { error } = await supabase.from('client_activities').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('client_activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { activities, addEntry, updateEntry, deleteEntry };
}

export function useClientOnboarding(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_onboarding', clientId];

  const onboarding = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from('client_onboarding').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientOnboarding[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: TablesInsert<'client_onboarding'>) => {
      const { error } = await supabase.from('client_onboarding').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'client_onboarding'> & { id: string }) => {
      const { error } = await supabase.from('client_onboarding').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('client_onboarding').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { onboarding, addEntry, updateEntry, deleteEntry };
}

export function useClientOffboarding(clientId: string | undefined) {
  const qc = useQueryClient();
  const key = ['client_offboarding', clientId];

  const offboarding = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from('client_offboarding').select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientOffboarding[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: TablesInsert<'client_offboarding'>) => {
      const { error } = await supabase.from('client_offboarding').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'client_offboarding'> & { id: string }) => {
      const { error } = await supabase.from('client_offboarding').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('client_offboarding').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { offboarding, addEntry, updateEntry, deleteEntry };
}
