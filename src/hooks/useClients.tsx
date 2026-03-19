import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Client = {
  id: string;
  client_id: string;
  status: string;
  start_date: string | null;
  end_of_cycle: string | null;
  current_product: string | null;
  dp: string | null;
  payment_method: string | null;
  full_name: string;
  nif: string | null;
  fiscal_address: string | null;
  birthday: string | null;
  observations: string | null;
  email: string | null;
  whatsapp: string | null;
  documents: string | null;
  drive_folder_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientHistory = {
  id: string;
  client_id: string;
  entry_date: string;
  milestone: string;
  observations: string | null;
  created_at: string;
};

export type ClientActivity = {
  id: string;
  client_id: string;
  phase: string | null;
  activity: string;
  responsible: string | null;
  rule: string | null;
  sort_order: number;
  created_at: string;
};

export type ClientOnboarding = {
  id: string;
  client_id: string;
  phase: string | null;
  activity: string;
  responsible: string | null;
  rule: string | null;
  completed: boolean;
  documents_links: string | null;
  sort_order: number;
  created_at: string;
};

export const CLIENT_STATUS_OPTIONS = [
  { value: 'em_onboarding', label: 'Em onboarding' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'altura_renovacao', label: 'Altura de renovação' },
  { value: 'terminado', label: 'Terminado' },
] as const;

const sb = () => supabase.from('clients' as any) as any;
const sbHistory = () => supabase.from('client_history' as any) as any;
const sbActivities = () => supabase.from('client_activities' as any) as any;
const sbOnboarding = () => supabase.from('client_onboarding' as any) as any;
const sbOffboarding = () => supabase.from('client_offboarding' as any) as any;

export function useClients() {
  const qc = useQueryClient();

  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await sb().select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Client[];
    },
  });

  const upsertClient = useMutation({
    mutationFn: async (client: Partial<Client> & { full_name: string }) => {
      if (client.id) {
        const { error } = await sb().update(client).eq('id', client.id);
        if (error) throw error;
      } else {
        const { id, ...rest } = client;
        const { error } = await sb().insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
    onError: () => toast.error('Erro ao guardar cliente'),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const duplicateClient = useMutation({
    mutationFn: async (source: Client) => {
      const { id, client_id, created_at, updated_at, ...rest } = source;
      const { error } = await sb().insert({ ...rest, full_name: `${source.full_name} (cópia)`, client_id: null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Ficha duplicada'); },
  });

  return { clients, upsertClient, deleteClient, duplicateClient };
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await sb().select('*').eq('id', id).maybeSingle();
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
      const { data, error } = await sbHistory().select('*').eq('client_id', clientId).order('entry_date', { ascending: false });
      if (error) throw error;
      return (data || []) as ClientHistory[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Partial<ClientHistory> & { client_id: string }) => {
      const { error } = await sbHistory().insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ClientHistory> & { id: string }) => {
      const { error } = await sbHistory().update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbHistory().delete().eq('id', id);
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
      const { data, error } = await sbActivities().select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientActivity[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Partial<ClientActivity> & { client_id: string }) => {
      const { error } = await sbActivities().insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ClientActivity> & { id: string }) => {
      const { error } = await sbActivities().update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbActivities().delete().eq('id', id);
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
      const { data, error } = await sbOnboarding().select('*').eq('client_id', clientId).order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientOnboarding[];
    },
    enabled: !!clientId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Partial<ClientOnboarding> & { client_id: string }) => {
      const { error } = await sbOnboarding().insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ClientOnboarding> & { id: string }) => {
      const { error } = await sbOnboarding().update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbOnboarding().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { onboarding, addEntry, updateEntry, deleteEntry };
}
