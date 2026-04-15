import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import type { MarketingChannel } from '@/lib/marketing-constants';

const DIST_COLUMNS = [
  { key: 'segunda', label: 'Seg', headerBg: 'bg-[hsl(351,30%,94%)] dark:bg-[hsl(351,30%,15%)]', headerText: 'text-[hsl(351,40%,45%)] dark:text-[hsl(351,40%,65%)]', cardBorder: 'border-l-[3px] border-[hsl(351,40%,70%)]' },
  { key: 'terca', label: 'Ter', headerBg: 'bg-[hsl(25,35%,93%)] dark:bg-[hsl(25,30%,15%)]', headerText: 'text-[hsl(25,50%,45%)] dark:text-[hsl(25,50%,65%)]', cardBorder: 'border-l-[3px] border-[hsl(25,50%,70%)]' },
  { key: 'quarta', label: 'Qua', headerBg: 'bg-[hsl(33,30%,92%)] dark:bg-[hsl(33,25%,15%)]', headerText: 'text-[hsl(33,40%,42%)] dark:text-[hsl(33,40%,62%)]', cardBorder: 'border-l-[3px] border-[hsl(33,40%,65%)]' },
  { key: 'quinta', label: 'Qui', headerBg: 'bg-[hsl(10,35%,93%)] dark:bg-[hsl(10,30%,15%)]', headerText: 'text-[hsl(10,45%,48%)] dark:text-[hsl(10,45%,65%)]', cardBorder: 'border-l-[3px] border-[hsl(10,45%,70%)]' },
  { key: 'sexta', label: 'Sex', headerBg: 'bg-[hsl(18,30%,92%)] dark:bg-[hsl(18,25%,15%)]', headerText: 'text-[hsl(18,40%,44%)] dark:text-[hsl(18,40%,64%)]', cardBorder: 'border-l-[3px] border-[hsl(18,40%,68%)]' },
  { key: 'sabado', label: 'Sáb', headerBg: 'bg-[hsl(200,30%,93%)] dark:bg-[hsl(200,25%,15%)]', headerText: 'text-[hsl(200,40%,45%)] dark:text-[hsl(200,40%,65%)]', cardBorder: 'border-l-[3px] border-[hsl(200,40%,70%)]' },
  { key: 'domingo', label: 'Dom', headerBg: 'bg-[hsl(160,28%,92%)] dark:bg-[hsl(160,22%,15%)]', headerText: 'text-[hsl(160,35%,40%)] dark:text-[hsl(160,35%,60%)]', cardBorder: 'border-l-[3px] border-[hsl(160,35%,65%)]' },
  { key: 'mensal', label: 'Mensal', headerBg: 'bg-[hsl(270,25%,93%)] dark:bg-[hsl(270,20%,15%)]', headerText: 'text-[hsl(270,30%,48%)] dark:text-[hsl(270,30%,65%)]', cardBorder: 'border-l-[3px] border-[hsl(270,30%,70%)]' },
];

export default function MarketingChannelStrategy() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: channel } = useQuery({
    queryKey: ['marketing-channel', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').eq('id', channelId!).maybeSingle() as { data: MarketingChannel | null };
      return data;
    },
    enabled: !!channelId,
  });

  const { data: detail } = useQuery({
    queryKey: ['strategy-channel-detail', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_details').select('*').eq('channel_id', channelId!).maybeSingle() as any;
      return data as { id: string; positioning: string | null; periodicity: string | null; notes: string | null } | null;
    },
    enabled: !!channelId,
  });

  const { data: formats = [] } = useQuery({
    queryKey: ['strategy-channel-formats', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_formats').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; formato: string; objetivo: string; exemplos: string; sort_order: number }[];
    },
    enabled: !!channelId,
  });

  const { data: frames = [] } = useQuery({
    queryKey: ['strategy-channel-frames', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_frames').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; nome: string; formato: string; frequencia: string; notas: string; sort_order: number }[];
    },
    enabled: !!channelId,
  });

  // Local state
  const [positioning, setPositioning] = useState('');
  const [periodicity, setPeriodicity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (detail) {
      setPositioning(detail.positioning || '');
      setPeriodicity(detail.periodicity || '');
      setNotes(detail.notes || '');
    }
  }, [detail]);

  const saveDetail = async (field: string, value: string) => {
    if (detail) {
      await supabase.from('strategy_channel_details').update({ [field]: value } as any).eq('id', detail.id);
    } else {
      await supabase.from('strategy_channel_details').insert({ channel_id: channelId, [field]: value } as any);
    }
    qc.invalidateQueries({ queryKey: ['strategy-channel-detail', channelId] });
  };

  // Formats CRUD
  const addFormat = async () => {
    await supabase.from('strategy_channel_formats').insert({
      channel_id: channelId, formato: '', objetivo: '', exemplos: '', sort_order: formats.length,
    } as any);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  const updateFormat = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_channel_formats').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  const deleteFormat = async (id: string) => {
    await supabase.from('strategy_channel_formats').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  // Frames CRUD
  const addFrame = async () => {
    await supabase.from('strategy_channel_frames').insert({
      channel_id: channelId, nome: '', formato: '', frequencia: '', notas: '', sort_order: frames.length,
    } as any);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  const updateFrame = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_channel_frames').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  const deleteFrame = async (id: string) => {
    await supabase.from('strategy_channel_frames').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  if (!channel) return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title={channel.name} subtitle="Estratégia por Canal" />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          {/* Callout - Posicionamento do Canal */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <Textarea
                value={positioning}
                onChange={e => setPositioning(e.target.value)}
                onBlur={() => saveDetail('positioning', positioning)}
                placeholder="Define o papel deste canal no teu negócio"
                className="min-h-[60px] resize-none bg-transparent border-none text-base"
                readOnly={!isOwner}
              />
            </CardContent>
          </Card>

          {/* Periodicidade */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Periodicidade</h2>
            <Textarea
              value={periodicity}
              onChange={e => setPeriodicity(e.target.value)}
              onBlur={() => saveDetail('periodicity', periodicity)}
              placeholder="Define a frequência de publicação neste canal"
              className="min-h-[60px] resize-none"
              readOnly={!isOwner}
            />
          </section>

          <Separator />

          {/* Formatos e Funções Validados */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Formatos e Funções Validados</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={addFormat}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Formato</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Objetivo Principal</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Exemplos</th>
                      {isOwner && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {formats.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Nenhum formato definido.</td></tr>
                    )}
                    {formats.map(f => (
                      <tr key={f.id} className="border-b last:border-0 group">
                        <td className="p-2">
                          <Input value={f.formato} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'formato', e.target.value)}
                            placeholder="Ex: Reels" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.objetivo} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'objetivo', e.target.value)}
                            placeholder="Objetivo" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.exemplos} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'exemplos', e.target.value)}
                            placeholder="Exemplos" readOnly={!isOwner} />
                        </td>
                        {isOwner && (
                          <td className="p-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteFormat(f.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Quadros Fixos de Conteúdo */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Quadros Fixos de Conteúdo</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={addFrame}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Nome do Quadro</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Formato</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Frequência</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Notas</th>
                      {isOwner && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {frames.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground italic">Nenhum quadro definido.</td></tr>
                    )}
                    {frames.map(f => (
                      <tr key={f.id} className="border-b last:border-0 group">
                        <td className="p-2">
                          <Input value={f.nome} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'nome', e.target.value)}
                            placeholder="Nome" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.formato} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'formato', e.target.value)}
                            placeholder="Formato" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.frequencia} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'frequencia', e.target.value)}
                            placeholder="Frequência" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.notas} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'notas', e.target.value)}
                            placeholder="Notas" readOnly={!isOwner} />
                        </td>
                        {isOwner && (
                          <td className="p-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteFrame(f.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Notas livres */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            <RichTextEditor
              content={notes}
              onChange={(val) => { setNotes(val); }}
              editable={isOwner}
            />
            {isOwner && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => saveDetail('notes', notes)}>
                Guardar notas
              </Button>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
