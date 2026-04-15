import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import type { MarketingChannel } from '@/lib/marketing-constants';
import { BackNavigation } from '@/components/BackNavigation';

const DIST_COLUMNS = [
  { key: 'segunda', label: 'Segunda-Feira' },
  { key: 'terca', label: 'Terça-Feira' },
  { key: 'quarta', label: 'Quarta-Feira' },
  { key: 'quinta', label: 'Quinta-Feira' },
  { key: 'sexta', label: 'Sexta-Feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
  { key: 'mensal', label: 'Mensal' },
];

const CHANNEL_EMOJI: Record<string, string> = {
  'Instagram': '📸', 'Youtube': '🎬', 'Facebook': '👥', 'TikTok': '🎵',
  'LinkedIn': '💼', 'Pinterest': '📌', 'Website': '🌐', 'Email Marketing': '📧',
};

export default function MarketingEstrategia() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['strategy-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_settings').select('*') as any;
      return (data || []) as { id: string; key: string; value: string | null }[];
    },
  });

  const { data: editorialLines = [] } = useQuery({
    queryKey: ['strategy-editorial-lines'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_editorial_lines').select('*').order('sort_order') as any;
      return (data || []) as { id: string; pilar: string; descricao: string; tipos_conteudo: string; sort_order: number }[];
    },
  });

  const { data: distCards = [] } = useQuery({
    queryKey: ['strategy-distribution-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_distribution_cards').select('*').order('sort_order') as any;
      return (data || []) as { id: string; column_key: string; title: string; channel: string | null; description: string | null; sort_order: number }[];
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value || '';

  const upsertSetting = async (key: string, value: string) => {
    const existing = settings.find(s => s.key === key);
    if (existing) {
      await supabase.from('strategy_settings').update({ value } as any).eq('id', existing.id);
    } else {
      await supabase.from('strategy_settings').insert({ key, value } as any);
    }
    qc.invalidateQueries({ queryKey: ['strategy-settings'] });
  };

  const [foco, setFoco] = useState('');
  useEffect(() => { setFoco(getSetting('foco')); }, [settings]);

  const [posicionamento, setPosicionamento] = useState('');
  useEffect(() => { setPosicionamento(getSetting('posicionamento')); }, [settings]);

  const addEditorialLine = async () => {
    await supabase.from('strategy_editorial_lines').insert({ pilar: '', descricao: '', tipos_conteudo: '', sort_order: editorialLines.length } as any);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };
  const updateEditorialLine = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_editorial_lines').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };
  const deleteEditorialLine = async (id: string) => {
    await supabase.from('strategy_editorial_lines').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };

  const addDistCard = async (columnKey: string) => {
    const colCards = distCards.filter(c => c.column_key === columnKey);
    await supabase.from('strategy_distribution_cards').insert({ column_key: columnKey, title: '', channel: '', description: '', sort_order: colCards.length } as any);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };
  const updateDistCard = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_distribution_cards').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };
  const deleteDistCard = async (id: string) => {
    await supabase.from('strategy_distribution_cards').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };

  const activeChannels = channels.filter(c => c.is_active);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Estratégia" subtitle="Marketing 360" />
        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* Foco */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Foco Estratégico</h2>
            <Textarea value={foco} onChange={e => setFoco(e.target.value)} onBlur={() => upsertSetting('foco', foco)}
              placeholder="Define aqui o foco estratégico do teu marketing" className="min-h-[80px] resize-none" readOnly={!isOwner} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linha Editorial */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Linha Editorial</h2>
                {isOwner && <Button variant="outline" size="sm" onClick={addEditorialLine}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Pilar</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Tipos de Conteúdo</th>
                      {isOwner && <th className="w-10" />}
                    </tr></thead>
                    <tbody>
                      {editorialLines.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Nenhum pilar definido.</td></tr>}
                      {editorialLines.map(line => (
                        <tr key={line.id} className="border-b last:border-0 group">
                          <td className="p-2"><Input value={line.pilar} className="h-8 text-sm border-transparent hover:border-input focus:border-input" onChange={e => updateEditorialLine(line.id, 'pilar', e.target.value)} placeholder="Ex: Educação" readOnly={!isOwner} /></td>
                          <td className="p-2"><Input value={line.descricao} className="h-8 text-sm border-transparent hover:border-input focus:border-input" onChange={e => updateEditorialLine(line.id, 'descricao', e.target.value)} placeholder="Descrição do pilar" readOnly={!isOwner} /></td>
                          <td className="p-2"><Input value={line.tipos_conteudo} className="h-8 text-sm border-transparent hover:border-input focus:border-input" onChange={e => updateEditorialLine(line.id, 'tipos_conteudo', e.target.value)} placeholder="Tipos de conteúdo" readOnly={!isOwner} /></td>
                          {isOwner && <td className="p-2"><Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteEditorialLine(line.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>

            {/* Posicionamento */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Posicionamento da Marca</h2>
              <Card><CardContent className="p-4">
                <Textarea value={posicionamento} onChange={e => setPosicionamento(e.target.value)} onBlur={() => upsertSetting('posicionamento', posicionamento)}
                  placeholder="Define aqui o posicionamento da tua marca" className="min-h-[100px] resize-none" readOnly={!isOwner} />
              </CardContent></Card>
            </section>
          </div>

          {/* Links rápidos */}
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/hub/marketing/estrategia/publico-alvo" className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">🎯</span>
              <div><span className="text-sm font-medium text-foreground">Público-Alvo</span><p className="text-xs text-muted-foreground">Personas, dores e jornada</p></div>
            </Link>
            <Link to="/hub/marketing/gestao-marca" className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">🎨</span>
              <div><span className="text-sm font-medium text-foreground">Gestão de Marca</span><p className="text-xs text-muted-foreground">Identidade e branding</p></div>
            </Link>
            <Link to="/hub/marketing/banco-ideias" className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">💡</span>
              <div><span className="text-sm font-medium text-foreground">Banco de Ideias</span><p className="text-xs text-muted-foreground">Conteúdos e inspiração</p></div>
            </Link>
          </div>

          <Separator />

          {/* Estratégia por Canal */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Estratégia por Canal</h2>
            {activeChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum canal ativo. Ativa canais nas Definições.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeChannels.map(ch => (
                  <Link key={ch.id} to={`/hub/marketing/estrategia/canal/${ch.id}`}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all text-center">
                    <span className="text-2xl">{CHANNEL_EMOJI[ch.name] || '📢'}</span>
                    <span className="text-sm font-medium text-foreground">{ch.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Distribuição de Conteúdo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Distribuição de Conteúdo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {DIST_COLUMNS.map(col => {
                const colCards = distCards.filter(c => c.column_key === col.key);
                return (
                  <div key={col.key} className="flex flex-col">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center pb-2 border-b mb-2">{col.label}</div>
                    <div className="space-y-2 flex-1 min-h-[120px]">
                      {colCards.map(card => (
                        <Card key={card.id} className="group relative">
                          <CardContent className="p-2.5 space-y-1.5">
                            <Input value={card.title} className="h-7 text-xs font-medium border-transparent hover:border-input focus:border-input p-1" onChange={e => updateDistCard(card.id, 'title', e.target.value)} placeholder="Nome" readOnly={!isOwner} />
                            {card.channel && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{card.channel}</Badge>}
                            {isOwner && <Input value={card.channel || ''} className="h-6 text-[10px] border-transparent hover:border-input focus:border-input p-1" onChange={e => updateDistCard(card.id, 'channel', e.target.value)} placeholder="Canal" />}
                            <Input value={card.description || ''} className="h-6 text-[10px] border-transparent hover:border-input focus:border-input p-1" onChange={e => updateDistCard(card.id, 'description', e.target.value)} placeholder="Descrição" readOnly={!isOwner} />
                            {isOwner && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deleteDistCard(card.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {isOwner && <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground" onClick={() => addDistCard(col.key)}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
