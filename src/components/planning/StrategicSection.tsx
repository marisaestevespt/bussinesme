import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Compass, Eye, Heart, Grid2x2, Plus, X, Pencil, Save, Trash2, ExternalLink, Sparkles, Target } from 'lucide-react';

type Directive = {
  id: string;
  title: string;
  description: string | null;
  horizon: '3_anos' | '5_anos';
  area: string | null;
  status: 'ativa' | 'em_revisao' | 'concluida' | 'arquivada';
  sort_order: number;
};

type SwotItem = { id: string; quadrant: string; content: string; sort_order: number };

const SWOT_QUADRANTS = [
  { key: 'forcas', label: 'Forças', color: 'text-success', bg: 'bg-success/10' },
  { key: 'fraquezas', label: 'Fraquezas', color: 'text-destructive', bg: 'bg-destructive/10' },
  { key: 'oportunidades', label: 'Oportunidades', color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'ameacas', label: 'Ameaças', color: 'text-warning', bg: 'bg-warning/10' },
] as const;

const STATUS_LABEL: Record<Directive['status'], string> = {
  ativa: 'Ativa',
  em_revisao: 'Em revisão',
  concluida: 'Concluída',
  arquivada: 'Arquivada',
};

export function StrategicSection() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ===== Identidade (business_settings) =====
  const settingsQuery = useQuery({
    queryKey: ['strategic', 'identity'],
    queryFn: async () => {
      const { data } = await supabase.from('business_settings').select('id, mission, vision, values_list').limit(1).maybeSingle();
      return data;
    },
  });
  const settings = settingsQuery.data as any;
  const valuesList: string[] = useMemo(() => Array.isArray(settings?.values_list) ? settings.values_list : [], [settings]);

  const [editingMission, setEditingMission] = useState(false);
  const [editingVision, setEditingVision] = useState(false);
  const [missionDraft, setMissionDraft] = useState('');
  const [visionDraft, setVisionDraft] = useState('');
  const [newValue, setNewValue] = useState('');

  const saveSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!settings?.id) return;
      const { error } = await supabase.from('business_settings').update(patch as any).eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic', 'identity'] }),
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  // ===== SWOT (brand_swot_items) =====
  const swotQuery = useQuery({
    queryKey: ['strategic', 'swot'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_swot_items').select('*').order('sort_order') as { data: SwotItem[] | null };
      return data || [];
    },
  });
  const swotItems = swotQuery.data || [];
  const [addingSwot, setAddingSwot] = useState<string | null>(null);
  const [swotDraft, setSwotDraft] = useState('');

  const addSwot = useMutation({
    mutationFn: async ({ quadrant, content }: { quadrant: string; content: string }) => {
      const order = swotItems.filter(i => i.quadrant === quadrant).length;
      const { error } = await supabase.from('brand_swot_items').insert({ quadrant, content, sort_order: order } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategic', 'swot'] }); setAddingSwot(null); setSwotDraft(''); },
  });
  const removeSwot = useMutation({
    mutationFn: async (id: string) => { await supabase.from('brand_swot_items').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic', 'swot'] }),
  });

  // ===== Diretrizes (strategic_directives) =====
  const dirQuery = useQuery({
    queryKey: ['strategic', 'directives'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('strategic_directives').select('*').order('sort_order').order('created_at');
      return (data || []) as Directive[];
    },
  });
  const directives = dirQuery.data || [];

  const [showNewDirective, setShowNewDirective] = useState(false);
  const [dirDraft, setDirDraft] = useState<Partial<Directive>>({ title: '', description: '', horizon: '3_anos', status: 'ativa' });
  const [editDirId, setEditDirId] = useState<string | null>(null);
  const [editDir, setEditDir] = useState<Partial<Directive>>({});

  const addDirective = useMutation({
    mutationFn: async (d: Partial<Directive>) => {
      const { error } = await (supabase as any).from('strategic_directives').insert({
        title: d.title,
        description: d.description || null,
        horizon: d.horizon || '3_anos',
        area: d.area || null,
        status: d.status || 'ativa',
        sort_order: directives.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }); setShowNewDirective(false); setDirDraft({ title: '', description: '', horizon: '3_anos', status: 'ativa' }); toast.success('Diretriz adicionada'); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });
  const updateDirective = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Directive> }) => {
      const { error } = await (supabase as any).from('strategic_directives').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }); setEditDirId(null); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });
  const deleteDirective = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).from('strategic_directives').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Estratégia</h2>
          <Badge variant="outline" className="text-[10px] font-normal">Longo prazo · 3-5 anos</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/hub/marketing/gestao-marca')}>
          <ExternalLink className="h-3 w-3 mr-1" /> Gestão de Marca
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === IDENTIDADE === */}
        <Card className="hq-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" /> Identidade
              <Badge variant="outline" className="ml-auto text-[10px] font-normal">sync com Marca</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Missão */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3 w-3" /> Missão
                </p>
                {!editingMission && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setMissionDraft(settings?.mission || ''); setEditingMission(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingMission ? (
                <div className="space-y-2">
                  <Textarea value={missionDraft} onChange={e => setMissionDraft(e.target.value)} rows={2} placeholder="O que fazemos hoje, para quem, e porquê…" className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => saveSettings.mutate({ mission: missionDraft }, { onSuccess: () => setEditingMission(false) })}>
                      <Save className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingMission(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-snug">{settings?.mission || <span className="italic text-muted-foreground">Por definir.</span>}</p>
              )}
            </div>

            {/* Visão */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3 w-3" /> Visão
                </p>
                {!editingVision && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setVisionDraft(settings?.vision || ''); setEditingVision(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingVision ? (
                <div className="space-y-2">
                  <Textarea value={visionDraft} onChange={e => setVisionDraft(e.target.value)} rows={2} placeholder="Onde queremos chegar nos próximos 3-5 anos…" className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => saveSettings.mutate({ vision: visionDraft }, { onSuccess: () => setEditingVision(false) })}>
                      <Save className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingVision(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-snug">{settings?.vision || <span className="italic text-muted-foreground">Por definir.</span>}</p>
              )}
            </div>

            {/* Valores */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Heart className="h-3 w-3" /> Valores
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {valuesList.length === 0 && <span className="text-xs italic text-muted-foreground">Adiciona valores que guiam a equipa.</span>}
                {valuesList.map((v, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 group">
                    {v}
                    <button
                      onClick={() => saveSettings.mutate({ values_list: valuesList.filter((_, i) => i !== idx) })}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="Ex: Transparência"
                  className="h-7 text-xs"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newValue.trim()) {
                      saveSettings.mutate({ values_list: [...valuesList, newValue.trim()] });
                      setNewValue('');
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => {
                    if (newValue.trim()) {
                      saveSettings.mutate({ values_list: [...valuesList, newValue.trim()] });
                      setNewValue('');
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === SWOT === */}
        <Card className="hq-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Grid2x2 className="h-4 w-4 text-primary" /> Análise SWOT
              <Badge variant="outline" className="ml-auto text-[10px] font-normal">sync com Marca</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {SWOT_QUADRANTS.map(q => {
                const items = swotItems.filter(i => i.quadrant === q.key);
                const isAdding = addingSwot === q.key;
                return (
                  <div key={q.key} className={`rounded-lg border p-2 ${q.bg}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${q.color} mb-1.5`}>{q.label}</p>
                    <div className="space-y-1 mb-1.5">
                      {items.length === 0 && !isAdding && <p className="text-[10px] italic text-muted-foreground">Vazio</p>}
                      {items.slice(0, 4).map(it => (
                        <div key={it.id} className="group flex items-start gap-1 text-[11px] leading-tight bg-background/60 rounded px-1.5 py-1">
                          <span className="flex-1">{it.content}</span>
                          <button onClick={() => removeSwot.mutate(it.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      {items.length > 4 && <p className="text-[10px] text-muted-foreground italic">+{items.length - 4} mais…</p>}
                    </div>
                    {isAdding ? (
                      <div className="space-y-1">
                        <Textarea
                          value={swotDraft}
                          onChange={e => setSwotDraft(e.target.value)}
                          rows={2}
                          autoFocus
                          className="text-[11px] min-h-0 py-1"
                          placeholder="Adicionar…"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-5 text-[10px] px-1.5" onClick={() => swotDraft.trim() && addSwot.mutate({ quadrant: q.key, content: swotDraft.trim() })}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => { setAddingSwot(null); setSwotDraft(''); }}>X</Button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingSwot(q.key)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Plus className="h-2.5 w-2.5" /> Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* === DIRETRIZES === */}
        <Card className="hq-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Diretrizes 3-5 anos
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowNewDirective(true)}>
              <Plus className="h-3 w-3 mr-1" /> Nova
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {showNewDirective && (
              <div className="rounded-lg border border-dashed p-2 space-y-2 bg-muted/30">
                <Input
                  value={dirDraft.title || ''}
                  onChange={e => setDirDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="Título da diretriz"
                  className="h-7 text-xs"
                  autoFocus
                />
                <Textarea
                  value={dirDraft.description || ''}
                  onChange={e => setDirDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  rows={2}
                  className="text-xs"
                />
                <div className="flex gap-1">
                  <Select value={dirDraft.horizon} onValueChange={(v: any) => setDirDraft(d => ({ ...d, horizon: v }))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3_anos">3 anos</SelectItem>
                      <SelectItem value="5_anos">5 anos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={dirDraft.area || ''}
                    onChange={e => setDirDraft(d => ({ ...d, area: e.target.value }))}
                    placeholder="Área (opcional)"
                    className="h-7 text-xs flex-1"
                  />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-[11px]" onClick={() => dirDraft.title?.trim() && addDirective.mutate(dirDraft)}>Adicionar</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setShowNewDirective(false); setDirDraft({ title: '', description: '', horizon: '3_anos', status: 'ativa' }); }}>Cancelar</Button>
                </div>
              </div>
            )}

            {directives.length === 0 && !showNewDirective && (
              <p className="text-xs italic text-muted-foreground py-4 text-center">
                Define até onde queres chegar nos próximos 3-5 anos.
              </p>
            )}

            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {directives.map(d => {
                const isEdit = editDirId === d.id;
                return (
                  <div key={d.id} className="rounded-lg border bg-background/50 p-2 group">
                    {isEdit ? (
                      <div className="space-y-1.5">
                        <Input value={editDir.title ?? d.title} onChange={e => setEditDir(p => ({ ...p, title: e.target.value }))} className="h-7 text-xs" />
                        <Textarea value={editDir.description ?? d.description ?? ''} onChange={e => setEditDir(p => ({ ...p, description: e.target.value }))} rows={2} className="text-xs" />
                        <div className="grid grid-cols-3 gap-1">
                          <Select value={editDir.horizon ?? d.horizon} onValueChange={(v: any) => setEditDir(p => ({ ...p, horizon: v }))}>
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3_anos">3 anos</SelectItem>
                              <SelectItem value="5_anos">5 anos</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={editDir.status ?? d.status} onValueChange={(v: any) => setEditDir(p => ({ ...p, status: v }))}>
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input value={editDir.area ?? d.area ?? ''} onChange={e => setEditDir(p => ({ ...p, area: e.target.value }))} placeholder="Área" className="h-7 text-[11px]" />
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-[11px]" onClick={() => updateDirective.mutate({ id: d.id, patch: editDir })}>Guardar</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setEditDirId(null); setEditDir({}); }}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-tight">{d.title}</p>
                            {d.description && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{d.description}</p>}
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">{d.horizon === '3_anos' ? '3 anos' : '5 anos'}</Badge>
                              {d.area && <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4">{d.area}</Badge>}
                              <span className={`text-[9px] uppercase tracking-wide ${
                                d.status === 'ativa' ? 'text-success' :
                                d.status === 'em_revisao' ? 'text-warning' :
                                d.status === 'concluida' ? 'text-primary' : 'text-muted-foreground'
                              }`}>{STATUS_LABEL[d.status]}</span>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditDirId(d.id); setEditDir({}); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => deleteDirective.mutate(d.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}