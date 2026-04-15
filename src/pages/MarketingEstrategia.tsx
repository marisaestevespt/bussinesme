import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil,
} from 'lucide-react';
import type { MarketingChannel } from '@/lib/marketing-constants';
import { BackNavigation } from '@/components/BackNavigation';
import { useEffect } from 'react';

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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const METRIC_SUGGESTIONS = [
  { key: 'followers', label: 'Seguidores' },
  { key: 'followers_growth', label: 'Crescimento de Seguidores' },
  { key: 'engagement_rate', label: 'Taxa de Engagement (%)' },
  { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'clicks', label: 'Cliques' },
  { key: 'leads', label: 'Leads Gerados' },
  { key: 'subscribers', label: 'Subscritores' },
  { key: 'views', label: 'Visualizações' },
  { key: 'conversions', label: 'Conversões' },
  { key: 'traffic', label: 'Tráfego do Site' },
  { key: 'custom', label: 'Personalizado' },
];

interface MarketingGoal {
  id: string;
  year: number;
  month: number;
  channel_id: string | null;
  metric_key: string;
  metric_label: string;
  target_value: number;
  current_value: number;
  notes: string | null;
  sort_order: number;
}

export default function MarketingEstrategia() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  // ---- Data queries ----
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

  // ---- Marketing Goals ----
  const now = new Date();
  const [goalMonth, setGoalMonth] = useState(now.getMonth() + 1);
  const [goalYear, setGoalYear] = useState(now.getFullYear());
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MarketingGoal | null>(null);
  const [goalForm, setGoalForm] = useState({ channel_id: '', metric_key: 'followers', metric_label: 'Seguidores', target_value: '', current_value: '', notes: '' });

  const { data: marketingGoals = [] } = useQuery({
    queryKey: ['marketing-goals', goalYear, goalMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_goals')
        .select('*')
        .eq('year', goalYear)
        .eq('month', goalMonth)
        .order('sort_order') as any;
      return (data || []) as MarketingGoal[];
    },
  });

  const prevMonth = () => {
    if (goalMonth === 1) { setGoalMonth(12); setGoalYear(y => y - 1); }
    else setGoalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (goalMonth === 12) { setGoalMonth(1); setGoalYear(y => y + 1); }
    else setGoalMonth(m => m + 1);
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalForm({ channel_id: '', metric_key: 'followers', metric_label: 'Seguidores', target_value: '', current_value: '', notes: '' });
    setGoalDialogOpen(true);
  };

  const openEditGoal = (g: MarketingGoal) => {
    setEditingGoal(g);
    setGoalForm({
      channel_id: g.channel_id || '',
      metric_key: g.metric_key,
      metric_label: g.metric_label,
      target_value: String(g.target_value || ''),
      current_value: String(g.current_value || ''),
      notes: g.notes || '',
    });
    setGoalDialogOpen(true);
  };

  const saveGoal = async () => {
    const payload = {
      year: goalYear,
      month: goalMonth,
      channel_id: goalForm.channel_id || null,
      metric_key: goalForm.metric_key,
      metric_label: goalForm.metric_label,
      target_value: Number(goalForm.target_value) || 0,
      current_value: Number(goalForm.current_value) || 0,
      notes: goalForm.notes || null,
      sort_order: editingGoal ? editingGoal.sort_order : marketingGoals.length,
    };
    if (editingGoal) {
      await supabase.from('marketing_goals').update(payload as any).eq('id', editingGoal.id);
    } else {
      await supabase.from('marketing_goals').insert(payload as any);
    }
    qc.invalidateQueries({ queryKey: ['marketing-goals', goalYear, goalMonth] });
    setGoalDialogOpen(false);
    toast.success('Meta guardada');
  };

  const deleteGoal = async (id: string) => {
    await supabase.from('marketing_goals').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-goals', goalYear, goalMonth] });
    toast.success('Meta removida');
  };

  const updateCurrentValue = async (id: string, value: string) => {
    await supabase.from('marketing_goals').update({ current_value: Number(value) || 0 } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-goals', goalYear, goalMonth] });
  };

  // ---- Helpers ----
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

  // ---- Foco ----
  const [foco, setFoco] = useState('');
  useEffect(() => { setFoco(getSetting('foco')); }, [settings]);

  // ---- Posicionamento ----
  const [posicionamento, setPosicionamento] = useState('');
  useEffect(() => { setPosicionamento(getSetting('posicionamento')); }, [settings]);

  // ---- Editorial Lines ----
  const addEditorialLine = async () => {
    const order = editorialLines.length;
    await supabase.from('strategy_editorial_lines').insert({ pilar: '', descricao: '', tipos_conteudo: '', sort_order: order } as any);
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

  // ---- Distribution Cards ----
  const addDistCard = async (columnKey: string) => {
    const colCards = distCards.filter(c => c.column_key === columnKey);
    await supabase.from('strategy_distribution_cards').insert({
      column_key: columnKey, title: '', channel: '', description: '', sort_order: colCards.length,
    } as any);
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

  const getChannelName = (channelId: string | null) => {
    if (!channelId) return null;
    return channels.find(c => c.id === channelId)?.name || null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Estratégia" subtitle="Marketing 360" />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECÇÃO 1: Foco + Linha Editorial + Posicionamento + Links */}
          {/* ══════════════════════════════════════════════════════════════ */}

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Foco Estratégico</h2>
            <Textarea
              value={foco}
              onChange={e => setFoco(e.target.value)}
              onBlur={() => upsertSetting('foco', foco)}
              placeholder="Define aqui o foco estratégico do teu marketing"
              className="min-h-[80px] resize-none"
              readOnly={!isOwner}
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linha Editorial */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Linha Editorial</h2>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={addEditorialLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Pilar</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Tipos de Conteúdo</th>
                        {isOwner && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {editorialLines.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Nenhum pilar definido.</td></tr>
                      )}
                      {editorialLines.map(line => (
                        <tr key={line.id} className="border-b last:border-0 group">
                          <td className="p-2">
                            <Input value={line.pilar} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                              onChange={e => updateEditorialLine(line.id, 'pilar', e.target.value)} placeholder="Ex: Educação" readOnly={!isOwner} />
                          </td>
                          <td className="p-2">
                            <Input value={line.descricao} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                              onChange={e => updateEditorialLine(line.id, 'descricao', e.target.value)} placeholder="Descrição do pilar" readOnly={!isOwner} />
                          </td>
                          <td className="p-2">
                            <Input value={line.tipos_conteudo} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                              onChange={e => updateEditorialLine(line.id, 'tipos_conteudo', e.target.value)} placeholder="Tipos de conteúdo" readOnly={!isOwner} />
                          </td>
                          {isOwner && (
                            <td className="p-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                onClick={() => deleteEditorialLine(line.id)}>
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

            {/* Posicionamento */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Posicionamento da Marca</h2>
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    value={posicionamento}
                    onChange={e => setPosicionamento(e.target.value)}
                    onBlur={() => upsertSetting('posicionamento', posicionamento)}
                    placeholder="Define aqui o posicionamento da tua marca"
                    className="min-h-[100px] resize-none"
                    readOnly={!isOwner}
                  />
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Links rápidos */}
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/hub/marketing/estrategia/publico-alvo"
              className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">🎯</span>
              <div>
                <span className="text-sm font-medium text-foreground">Público-Alvo</span>
                <p className="text-xs text-muted-foreground">Personas, dores e jornada</p>
              </div>
            </Link>
            <Link to="/hub/marketing/gestao-marca"
              className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">🎨</span>
              <div>
                <span className="text-sm font-medium text-foreground">Gestão de Marca</span>
                <p className="text-xs text-muted-foreground">Identidade e branding</p>
              </div>
            </Link>
            <Link to="/hub/marketing/banco-ideias"
              className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all">
              <span className="text-xl">💡</span>
              <div>
                <span className="text-sm font-medium text-foreground">Banco de Ideias</span>
                <p className="text-xs text-muted-foreground">Conteúdos e inspiração</p>
              </div>
            </Link>
          </div>

          <Separator />

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECÇÃO 2: Metas de Marketing (mensuráveis) */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Metas de Marketing</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center">
                  {MONTH_NAMES[goalMonth - 1]} {goalYear}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {isOwner && (
                  <Button variant="outline" size="sm" className="ml-2" onClick={openNewGoal}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Nova Meta
                  </Button>
                )}
              </div>
            </div>

            {marketingGoals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm italic">
                  Nenhuma meta definida para este mês.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketingGoals.map(g => {
                  const channelName = getChannelName(g.channel_id);
                  const pct = g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0;
                  const achieved = pct >= 100;
                  return (
                    <Card key={g.id} className="group relative">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{g.metric_label}</p>
                            {channelName && (
                              <Badge variant="secondary" className="text-[10px] mt-1">
                                {CHANNEL_EMOJI[channelName] || '📢'} {channelName}
                              </Badge>
                            )}
                            {!channelName && (
                              <Badge variant="outline" className="text-[10px] mt-1">Geral</Badge>
                            )}
                          </div>
                          {isOwner && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGoal(g)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGoal(g.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Progress */}
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-foreground">{g.current_value}</span>
                            <span className="text-sm text-muted-foreground">/ {g.target_value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', achieved ? 'bg-emerald-500' : 'bg-primary')}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn('text-xs font-medium', achieved ? 'text-emerald-600' : pct >= 75 ? 'text-primary' : 'text-muted-foreground')}>
                              {pct}%
                            </span>
                            {achieved && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Atingida ✓</Badge>}
                          </div>
                        </div>

                        {/* Quick update current value */}
                        {isOwner && (
                          <div className="pt-1 border-t">
                            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Valor atual</label>
                            <Input
                              type="number"
                              className="h-7 text-sm mt-1"
                              defaultValue={g.current_value}
                              onBlur={e => updateCurrentValue(g.id, e.target.value)}
                            />
                          </div>
                        )}

                        {g.notes && <p className="text-xs text-muted-foreground">{g.notes}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECÇÃO 3: Estratégia por Canal */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Estratégia por Canal</h2>
            {activeChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum canal ativo. Ativa canais nas Definições.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeChannels.map(ch => {
                  const emoji = CHANNEL_EMOJI[ch.name] || '📢';
                  return (
                    <Link key={ch.id} to={`/hub/marketing/estrategia/canal/${ch.id}`}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all text-center">
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-sm font-medium text-foreground">{ch.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECÇÃO 4: Distribuição de Conteúdo */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Distribuição de Conteúdo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {DIST_COLUMNS.map(col => {
                const colCards = distCards.filter(c => c.column_key === col.key);
                return (
                  <div key={col.key} className="flex flex-col">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center pb-2 border-b mb-2">
                      {col.label}
                    </div>
                    <div className="space-y-2 flex-1 min-h-[120px]">
                      {colCards.map(card => (
                        <Card key={card.id} className="group relative">
                          <CardContent className="p-2.5 space-y-1.5">
                            <Input value={card.title} className="h-7 text-xs font-medium border-transparent hover:border-input focus:border-input p-1"
                              onChange={e => updateDistCard(card.id, 'title', e.target.value)} placeholder="Nome" readOnly={!isOwner} />
                            {card.channel && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{card.channel}</Badge>}
                            {isOwner && (
                              <Input value={card.channel || ''} className="h-6 text-[10px] border-transparent hover:border-input focus:border-input p-1"
                                onChange={e => updateDistCard(card.id, 'channel', e.target.value)} placeholder="Canal" />
                            )}
                            <Input value={card.description || ''} className="h-6 text-[10px] border-transparent hover:border-input focus:border-input p-1"
                              onChange={e => updateDistCard(card.id, 'description', e.target.value)} placeholder="Descrição" readOnly={!isOwner} />
                            {isOwner && (
                              <Button variant="ghost" size="icon"
                                className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100"
                                onClick={() => deleteDistCard(card.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {isOwner && (
                      <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground"
                        onClick={() => addDistCard(col.key)}>
                        <Plus className="h-3 w-3 mr-1" />Adicionar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* ── Goal Dialog ── */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta de Marketing'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Canal (opcional)</Label>
              <Select value={goalForm.channel_id} onValueChange={v => setGoalForm(f => ({ ...f, channel_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Geral (sem canal)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Geral (sem canal)</SelectItem>
                  {activeChannels.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>{CHANNEL_EMOJI[ch.name] || '📢'} {ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Métrica</Label>
              <Select value={goalForm.metric_key} onValueChange={v => {
                const suggestion = METRIC_SUGGESTIONS.find(s => s.key === v);
                setGoalForm(f => ({ ...f, metric_key: v, metric_label: suggestion?.label || f.metric_label }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_SUGGESTIONS.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {goalForm.metric_key === 'custom' && (
              <div>
                <Label className="text-xs">Nome da métrica</Label>
                <Input className="mt-1" value={goalForm.metric_label} onChange={e => setGoalForm(f => ({ ...f, metric_label: e.target.value }))} placeholder="Nome personalizado" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor alvo</Label>
                <Input type="number" className="mt-1" value={goalForm.target_value} onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Valor atual</Label>
                <Input type="number" className="mt-1" value={goalForm.current_value} onChange={e => setGoalForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea className="mt-1" rows={2} value={goalForm.notes} onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} placeholder="Contexto ou estratégia para atingir esta meta..." />
            </div>

            <Button className="w-full" onClick={saveGoal}>
              {editingGoal ? 'Guardar alterações' : 'Criar Meta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
