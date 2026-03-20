import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

const sb = (table: string) => supabase.from(table as any) as any;

type Contact = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export function ClientContactsSection({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const key = ['client_contacts', clientId];

  const { data: contacts = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await sb('client_contacts').select('*').eq('client_id', clientId).order('created_at');
      if (error) throw error;
      return (data || []) as Contact[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await sb('client_contacts').insert({ client_id: clientId, name: '', email: '' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<Contact> & { id: string }) => {
      const { error } = await sb('client_contacts').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb('client_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Contactos Adicionais</CardTitle>
        <Button size="sm" variant="outline" onClick={() => add.mutate()}>
          <Plus className="h-3 w-3 mr-1" />Adicionar contacto
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-primary text-primary-foreground px-4 py-2 font-medium text-xs grid grid-cols-[1fr_1fr_120px_1fr_32px] gap-2">
          <span>Nome</span><span>Email</span><span>Telefone</span><span>Notas</span><span></span>
        </div>
        {contacts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Sem contactos adicionais</p>
        ) : contacts.map(c => (
          <div key={c.id} className="px-4 py-2 text-xs grid grid-cols-[1fr_1fr_120px_1fr_32px] gap-2 border-b items-center">
            <Input className="h-7 text-xs" defaultValue={c.name} placeholder="Nome" onBlur={e => update.mutate({ id: c.id, name: e.target.value })} />
            <Input className="h-7 text-xs" defaultValue={c.email} placeholder="Email" onBlur={e => update.mutate({ id: c.id, email: e.target.value })} />
            <Input className="h-7 text-xs" defaultValue={c.phone || ''} placeholder="Telefone" onBlur={e => update.mutate({ id: c.id, phone: e.target.value || null })} />
            <Input className="h-7 text-xs" defaultValue={c.notes || ''} placeholder="Ex: assistente, sócio..." onBlur={e => update.mutate({ id: c.id, notes: e.target.value || null })} />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(c.id)}><X className="h-3 w-3" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
