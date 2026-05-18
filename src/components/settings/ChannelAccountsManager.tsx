import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export interface ChannelAccount {
  id: string;
  channel_id: string;
  handle: string;
  url: string | null;
  label: string | null;
  sort_order: number;
}

interface Props {
  channelId: string;
  channelName: string;
}

export function ChannelAccountsManager({ channelId, channelName }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ handle: '', url: '', label: '' });

  const { data: accounts = [] } = useQuery({
    queryKey: ['marketing-channel-accounts', channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_channel_accounts' as any)
        .select('*')
        .eq('channel_id', channelId)
        .order('sort_order');
      return (data || []) as unknown as ChannelAccount[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['marketing-channel-accounts', channelId] });
    qc.invalidateQueries({ queryKey: ['marketing-channel-accounts-all'] });
  };

  const addAccount = async () => {
    if (!draft.handle.trim()) return;
    const handle = draft.handle.trim().startsWith('@') ? draft.handle.trim() : `@${draft.handle.trim()}`;
    const { error } = await supabase.from('marketing_channel_accounts' as any).insert({
      channel_id: channelId,
      handle,
      url: draft.url.trim() || null,
      label: draft.label.trim() || null,
      sort_order: accounts.length,
    } as any);
    if (error) { toast.error('Não consegui adicionar a conta. Tenta novamente.'); return; }
    setDraft({ handle: '', url: '', label: '' });
    setAdding(false);
    refresh();
    toast.success('Conta adicionada');
  };

  const updateAccount = async (id: string, patch: Partial<ChannelAccount>) => {
    await supabase.from('marketing_channel_accounts' as any).update(patch as any).eq('id', id);
    refresh();
  };

  const removeAccount = async (id: string) => {
    if (!(await confirmDestructive())) return;
    const { error } = await supabase.from('marketing_channel_accounts' as any).delete().eq('id', id);
    if (error) { toast.error('Não consegui eliminar a conta.'); return; }
    refresh();
    toast.success('Conta removida');
  };

  return (
    <div className="ml-7 mt-1 space-y-2">
      {accounts.map(acc => (
        <div key={acc.id} className="flex items-center gap-2 group">
          <Input
            value={acc.handle}
            onChange={e => updateAccount(acc.id, { handle: e.target.value })}
            className="h-7 text-xs flex-[1.2] min-w-0"
            placeholder="@handle"
          />
          <Input
            value={acc.label || ''}
            onChange={e => updateAccount(acc.id, { label: e.target.value })}
            className="h-7 text-xs flex-[1] min-w-0"
            placeholder="Etiqueta (ex: Principal)"
          />
          <Input
            value={acc.url || ''}
            onChange={e => updateAccount(acc.id, { url: e.target.value })}
            className="h-7 text-xs flex-[2] min-w-0"
            placeholder="https://..."
          />
          {acc.url && (
            <a href={acc.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Abrir link">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar conta"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={() => removeAccount(acc.id)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft.handle}
            onChange={e => setDraft(d => ({ ...d, handle: e.target.value }))}
            className="h-7 text-xs flex-[1.2] min-w-0"
            placeholder="@handle"
          />
          <Input
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            className="h-7 text-xs flex-[1] min-w-0"
            placeholder="Etiqueta"
          />
          <Input
            value={draft.url}
            onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
            className="h-7 text-xs flex-[2] min-w-0"
            placeholder="https://..."
            onKeyDown={e => e.key === 'Enter' && addAccount()}
          />
          <Button size="sm" className="h-7 text-xs" onClick={addAccount}>Adicionar</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setDraft({ handle: '', url: '', label: '' }); }}>Cancelar</Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-muted-foreground gap-1 px-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3 w-3" />Adicionar conta {channelName}
        </Button>
      )}
    </div>
  );
}