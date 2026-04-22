import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketingChannel } from '@/lib/marketing-constants';
import { ChannelAccountsManager } from './ChannelAccountsManager';

const CHANNEL_EMOJI: Record<string, string> = {
  Instagram: '📸', Youtube: '🎬', Facebook: '👥', TikTok: '🎵',
  LinkedIn: '💼', Pinterest: '📌', Website: '🌐', 'Email Marketing': '📧',
  Twitter: '🐦', Threads: '🧵', Spotify: '🎧', Blog: '📝',
  Podcast: '🎙️', Newsletter: '✉️', WhatsApp: '💬', Telegram: '✈️',
};

export function ChannelSettings() {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const toggle = async (id: string, active: boolean) => {
    await supabase.from('marketing_channels').update({ is_active: active } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['marketing-channels'] });
  };

  const addChannel = async () => {
    if (!newName.trim()) return;
    await supabase.from('marketing_channels').insert({ name: newName, sort_order: channels.length } as any);
    queryClient.invalidateQueries({ queryKey: ['marketing-channels'] });
    setShowAdd(false);
    setNewName('');
    toast.success('Canal adicionado');
  };

  if (!isOwner) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Megaphone className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Canais de Marketing</h2>
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground">Seleciona os canais onde o teu negócio está presente. Apenas os ativos aparecem no calendário de conteúdos.</p>
          <div className="space-y-1">
            {channels.map(ch => {
              const emoji = CHANNEL_EMOJI[ch.name] || '📢';
              return (
                <div key={ch.id} className="py-2 px-1 rounded-md hover:bg-muted/30 hq-transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{emoji}</span>
                      <span className="text-sm font-medium text-foreground">{ch.name}</span>
                    </div>
                    <Switch checked={ch.is_active} onCheckedChange={v => toggle(ch.id, v)} />
                  </div>
                  {ch.is_active && <ChannelAccountsManager channelId={ch.id} channelName={ch.name} />}
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar canal
          </Button>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Canal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do canal" onKeyDown={e => e.key === 'Enter' && addChannel()} />
            <Button className="w-full" disabled={!newName.trim()} onClick={addChannel}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
