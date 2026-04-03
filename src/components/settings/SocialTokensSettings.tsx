import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link2, RefreshCw, CheckCircle2, AlertCircle, Loader2, HelpCircle, Eye, EyeOff, Unplug, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const PLATFORM_SETUP_GUIDE: Record<string, string[]> = {
  instagram: [
    '1. Vai a developers.facebook.com e faz login',
    '2. Clica "My Apps" > "Create App" > tipo "Business"',
    '3. Adiciona o produto "Instagram Graph API"',
    '4. Em "Tools" > "Graph API Explorer", seleciona a tua app e página',
    '5. Adiciona permissões: pages_show_list, instagram_basic, instagram_manage_insights',
    '6. Clica "Generate Access Token" (token curto ~1h)',
    '7. Para token longo (~60 dias): usa o endpoint /oauth/access_token com grant_type=fb_exchange_token',
    '8. Para o User ID: no Explorer faz GET /me/accounts?fields=instagram_business_account',
  ],
  youtube: [
    '1. Vai a console.cloud.google.com',
    '2. Cria um projeto ou usa um existente',
    '3. Em "APIs & Services" > "Library", ativa "YouTube Data API v3"',
    '4. Em "Credentials" > "Create Credentials" > "API Key"',
    '5. O Channel ID encontras em youtube.com > Settings > Advanced Settings',
  ],
  facebook: [
    '1. Vai a developers.facebook.com e cria uma app (tipo "Business")',
    '2. Adiciona o produto "Facebook Login"',
    '3. Em "Tools" > "Graph API Explorer", seleciona a tua página',
    '4. Adiciona permissão pages_read_engagement e gera o token',
    '5. O Page ID encontras na secção "About" da tua página Facebook',
  ],
};

const PLATFORM_INFO: Record<string, { label: string; emoji: string; fields: { key: string; label: string; placeholder: string; help?: string }[] }> = {
  instagram: {
    label: 'Instagram',
    emoji: '📸',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxxxxx...', help: 'Token de longa duração da Meta Graph API.' },
      { key: 'ig_user_id', label: 'Instagram User ID', placeholder: '17841400000000', help: 'ID numérico da conta Instagram Business.' },
    ],
  },
  youtube: {
    label: 'YouTube',
    emoji: '🎬',
    fields: [
      { key: 'access_token', label: 'API Key', placeholder: 'AIzaSyxxxxxxx...', help: 'Chave de API do Google Cloud.' },
      { key: 'channel_id', label: 'Channel ID', placeholder: 'UCxxxxxxx...', help: 'ID do canal YouTube.' },
    ],
  },
  facebook: {
    label: 'Facebook',
    emoji: '👥',
    fields: [
      { key: 'access_token', label: 'Page Access Token', placeholder: 'EAAxxxxxxx...', help: 'Token de acesso da página Facebook.' },
      { key: 'page_id', label: 'Page ID', placeholder: '100xxxxxxx', help: 'ID numérico da página Facebook.' },
    ],
  },
};
const CHANNEL_PLATFORM_MAP: Record<string, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  facebook: 'facebook',
};

interface ChannelToken {
  id: string;
  channel_id: string;
  platform: string;
  access_token: string;
  token_metadata: any;
  last_synced_at: string | null;
}

export function SocialTokensSettings() {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [editChannel, setEditChannel] = useState<{ id: string; name: string; platform: string } | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as any[];
    },
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ['channel-social-tokens'],
    queryFn: async () => {
      const { data } = await supabase.from('channel_social_tokens').select('*');
      return (data || []) as ChannelToken[];
    },
  });

  const tokenMap = new Map(tokens.map(t => [t.channel_id, t]));

  const supportedChannels = channels.filter(ch => {
    const platform = CHANNEL_PLATFORM_MAP[ch.name?.toLowerCase()];
    return !!platform;
  });

  const openEdit = (channel: any) => {
    const platform = CHANNEL_PLATFORM_MAP[channel.name.toLowerCase()];
    const existing = tokenMap.get(channel.id);
    const meta = existing?.token_metadata || {};
    const data: Record<string, string> = { access_token: existing?.access_token || '' };
    const info = PLATFORM_INFO[platform];
    if (info) {
      info.fields.forEach(f => {
        if (f.key !== 'access_token') data[f.key] = meta[f.key] || '';
      });
    }
    setFormData(data);
    setEditChannel({ id: channel.id, name: channel.name, platform });
  };

  const saveToken = async () => {
    if (!editChannel) return;
    const { access_token, ...rest } = formData;
    const payload = {
      channel_id: editChannel.id,
      platform: editChannel.platform,
      access_token: access_token || '',
      token_metadata: rest,
    };
    const existing = tokenMap.get(editChannel.id);
    if (existing) {
      await supabase.from('channel_social_tokens').update(payload as any).eq('id', existing.id);
    } else {
      await supabase.from('channel_social_tokens').insert(payload as any);
    }
    queryClient.invalidateQueries({ queryKey: ['channel-social-tokens'] });
    setEditChannel(null);
    toast.success('Token guardado com sucesso');
  };

  const removeToken = async (channelId: string) => {
    await supabase.from('channel_social_tokens').delete().eq('channel_id', channelId);
    queryClient.invalidateQueries({ queryKey: ['channel-social-tokens'] });
    toast.success('Token removido');
  };

  const syncChannel = async (channelId: string) => {
    setSyncing(channelId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-social-metrics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ channel_id: channelId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao sincronizar');

      const channelResult = result.results?.[0];
      if (channelResult?.status === 'error') {
        toast.error(`Erro: ${channelResult.error}`);
      } else {
        toast.success('Métricas atualizadas com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['channel-social-tokens'] });
        queryClient.invalidateQueries({ queryKey: ['channel-monthly-metrics'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar métricas');
    } finally {
      setSyncing(null);
    }
  };

  const syncAll = async () => {
    setSyncing('all');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-social-metrics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao sincronizar');

      const errors = result.results?.filter((r: any) => r.status === 'error') || [];
      if (errors.length > 0) {
        toast.error(`${errors.length} canal(is) com erro`);
      } else {
        toast.success('Todas as métricas atualizadas!');
      }
      queryClient.invalidateQueries({ queryKey: ['channel-social-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['channel-monthly-metrics'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(null);
    }
  };

  if (!isOwner) return null;

  const configuredCount = supportedChannels.filter(ch => tokenMap.has(ch.id) && tokenMap.get(ch.id)!.access_token).length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Link2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight uppercase">Integração com Redes Sociais</h2>
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Conecta as APIs das tuas redes sociais para importar métricas automaticamente.
            </p>
            {configuredCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={syncAll}
                disabled={syncing === 'all'}
              >
                {syncing === 'all' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Sincronizar tudo
              </Button>
            )}
          </div>

          {supportedChannels.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Ativa canais como Instagram, YouTube ou Facebook em Marketing para começar.
            </p>
          )}

          <div className="space-y-1">
            {supportedChannels.map(ch => {
              const platform = CHANNEL_PLATFORM_MAP[ch.name.toLowerCase()];
              const info = PLATFORM_INFO[platform];
              const token = tokenMap.get(ch.id);
              const isConfigured = !!token?.access_token;
              const isSyncing = syncing === ch.id;

              return (
                <div key={ch.id} className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{info?.emoji || '📢'}</span>
                    <span className="text-sm font-medium text-foreground">{ch.name}</span>
                    {isConfigured ? (
                      <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Não configurado
                      </Badge>
                    )}
                    {token?.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Última sync: {format(new Date(token.last_synced_at), "d MMM HH:mm", { locale: pt })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isConfigured && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => syncChannel(ch.id)} disabled={!!syncing} className="h-7 px-2 text-xs">
                          {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeToken(ch.id)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                          <Unplug className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEdit(ch)} className="h-7 px-3 text-xs">
                      {isConfigured ? 'Editar' : 'Configurar'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editChannel} onOpenChange={v => !v && setEditChannel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editChannel && PLATFORM_INFO[editChannel.platform]?.emoji} Configurar {editChannel?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editChannel && PLATFORM_INFO[editChannel.platform]?.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  {field.label}
                  {field.help && (
                    <span title={field.help}>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type={field.key === 'access_token' && !showTokens[field.key] ? 'password' : 'text'}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="pr-8 font-mono text-xs"
                  />
                  {field.key === 'access_token' && (
                    <button
                      type="button"
                      onClick={() => setShowTokens(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showTokens[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                {field.help && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{field.help}</p>
                )}
              </div>
            ))}

            {/* Setup guide */}
            {editChannel && PLATFORM_SETUP_GUIDE[editChannel.platform] && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                  <ChevronDown className="h-3 w-3 transition-transform [[data-state=open]_&]:rotate-180" />
                  Como obter estas credenciais?
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-md bg-muted/50 p-3 space-y-1">
                    {PLATFORM_SETUP_GUIDE[editChannel.platform].map((step, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{step}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Button className="w-full" onClick={saveToken} disabled={!formData.access_token?.trim()}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
