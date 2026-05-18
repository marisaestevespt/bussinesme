import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Handshake, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Responsibility {
  id: string;
  project_id: string;
  description: string;
  party: 'cliente' | 'equipa' | 'partilhada';
  notes: string | null;
  sort_order: number;
}

const PARTY_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  cliente: { label: 'Cliente', icon: User, className: 'bg-info/15 text-info' },
  equipa: { label: 'Equipa', icon: Users, className: 'bg-primary/15 text-primary' },
  partilhada: { label: 'Partilhada', icon: Handshake, className: 'bg-warning/15 text-warning' },
};

export function ProjectResponsibilities({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [newDesc, setNewDesc] = useState('');
  const [newParty, setNewParty] = useState<'cliente' | 'equipa' | 'partilhada'>('equipa');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['project-responsibilities', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_responsibilities' as any)
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as Responsibility[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!newDesc.trim()) return;
      const { error } = await supabase.from('project_responsibilities' as any).insert({
        project_id: projectId,
        description: newDesc.trim(),
        party: newParty,
        sort_order: items.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNewDesc(''); qc.invalidateQueries({ queryKey: ['project-responsibilities', projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('project_responsibilities' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-responsibilities', projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePartyMut = useMutation({
    mutationFn: async ({ id, party }: { id: string; party: string }) => {
      const { error } = await supabase.from('project_responsibilities' as any).update({ party } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-responsibilities', projectId] }),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Responsabilidades acordadas no início da avença. Visíveis para o cliente no portal.</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">Sem responsabilidades definidas.</div>
      ) : (
        <div className="space-y-2">
          {items.map(r => {
            const meta = PARTY_META[r.party];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Select value={r.party} onValueChange={v => updatePartyMut.mutate({ id: r.id, party: v })}>
                  <SelectTrigger className="w-36 h-8">
                    <SelectValue>
                      <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {meta.label}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARTY_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="flex-1 text-sm">{r.description}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMut.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Select value={newParty} onValueChange={v => setNewParty(v as any)}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PARTY_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Ex: Enviar conteúdo até dia 25 de cada mês"
          onKeyDown={e => { if (e.key === 'Enter') addMut.mutate(); }}
          className="flex-1 h-9"
        />
        <Button size="sm" onClick={() => addMut.mutate()} disabled={!newDesc.trim() || addMut.isPending} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
    </div>
  );
}