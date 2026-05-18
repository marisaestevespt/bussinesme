import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Compass, Eye, Heart, Grid2x2, Plus, X, Pencil, Save, ExternalLink, Sparkles, Target } from 'lucide-react';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type SwotItem = { id: string; quadrant: string; content: string; sort_order: number };

const SWOT_QUADRANTS = [
  { key: 'forcas', label: 'Forças', hint: 'O que fazemos bem, vantagens internas', color: 'text-success', bg: 'bg-success/5', border: 'border-success/30' },
  { key: 'fraquezas', label: 'Fraquezas', hint: 'Onde temos lacunas, limitações internas', color: 'text-destructive', bg: 'bg-destructive/5', border: 'border-destructive/30' },
  { key: 'oportunidades', label: 'Oportunidades', hint: 'Tendências externas a aproveitar', color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/30' },
  { key: 'ameacas', label: 'Ameaças', hint: 'Riscos externos a antecipar', color: 'text-warning', bg: 'bg-warning/5', border: 'border-warning/30' },
] as const;

function EditableTextBlock({
  label, icon: Icon, value, placeholder, onSave, rows = 4,
}: {
  label: string; icon: any; value: string; placeholder: string; onSave: (v: string) => void; rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" /> {label}
        </p>
        {!editing && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDraft(value || ''); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={rows} placeholder={placeholder} className="text-sm leading-relaxed resize-none" autoFocus />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => { setDraft(value || ''); setEditing(true); }}
          className="min-h-[96px] rounded-md border border-dashed border-transparent hover:border-border hover:bg-muted/30 hq-transition px-3 py-2.5 cursor-text"
        >
          {value
            ? <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{value}</p>
            : <p className="text-sm italic text-muted-foreground">{placeholder}</p>}
        </div>
      )}
    </div>
  );
}

export function StrategicSection() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ===== Identidade =====
  const settingsQuery = useQuery({
    queryKey: ['strategic', 'identity'],
    queryFn: async () => {
      const { data } = await supabase.from('business_settings').select('id, mission, vision, values_list').limit(1).maybeSingle();
      return data;
    },
  });
  const settings = settingsQuery.data as any;
  // values_list pode ter dois formatos: string[] (legado) ou {name, description}[] (novo, vindo da Marca)
  const valuesList: Array<{ name: string; description?: string }> = useMemo(() => {
    const raw = Array.isArray(settings?.values_list) ? settings.values_list : [];
    return raw.map((v: any) =>
      typeof v === 'string' ? { name: v } : { name: v?.name || '', description: v?.description }
    ).filter(v => v.name);
  }, [settings]);
  const [newValue, setNewValue] = useState('');

  const saveSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!settings?.id) return;
      const { error } = await supabase.from('business_settings').update(patch as any).eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategic', 'identity'] });
      qc.invalidateQueries({ queryKey: ['brand', 'identity'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  // ===== SWOT =====
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
    mutationFn: async (id: string) => {
      await requireConfirm(); await supabase.from('brand_swot_items').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic', 'swot'] }),
  });

  // ===== Diretrizes =====
  const dirQuery = useQuery({
    queryKey: ['strategic', 'directives'],
    queryFn: async () => {
      const { data } = await supabase.from('strategic_directives').select('*').order('sort_order').order('created_at');
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
      const { error } = await supabase.from('strategic_directives').insert({
        title: d.title, description: d.description || null, horizon: d.horizon || '3_anos',
        area: d.area || null, status: d.status || 'ativa', sort_order: directives.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }); setShowNewDirective(false); setDirDraft({ title: '', description: '', horizon: '3_anos', status: 'ativa' }); toast.success('Diretriz adicionada'); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });
  const updateDirective = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Directive> }) => {
      const { error } = await supabase.from('strategic_directives').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }); setEditDirId(null); },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });
  const deleteDirective = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm(); await supabase.from('strategic_directives').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategic', 'directives'] }),
  });

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Estratégia</h2>
            <p className="text-xs text-muted-foreground">Longo prazo · 3-5 anos · onde queremos chegar</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/hub/marketing/gestao-marca')}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir Gestão de Marca
        </Button>
      </div>

      {/* === IDENTIDADE — full width === */}
      <Card className="hq-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" /> Identidade
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">sync com Gestão de Marca</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <EditableTextBlock
              label="Missão"
              icon={Target}
              value={settings?.mission || ''}
              placeholder="O que fazemos hoje, para quem, e porquê. Ex: Ajudamos negócios criativos a organizar a sua operação para crescerem com leveza."
              onSave={v => saveSettings.mutate({ mission: v })}
              rows={5}
            />
            <EditableTextBlock
              label="Visão"
              icon={Eye}
              value={settings?.vision || ''}
              placeholder="Onde queremos chegar nos próximos 3-5 anos. Ex: Ser a referência em gestão integrada para criativos em Portugal."
              onSave={v => saveSettings.mutate({ vision: v })}
              rows={5}
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Heart className="h-3.5 w-3.5" /> Valores
              </p>
              <div className="min-h-[96px] rounded-md border border-dashed border-border bg-muted/20 p-3">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {valuesList.length === 0 && (
                    <p className="text-sm italic text-muted-foreground">Adiciona os valores que guiam a equipa. Ex: Transparência, Excelência, Empatia.</p>
                  )}
                  {valuesList.map((v, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="gap-1.5 px-2.5 py-1 text-sm group"
                      title={v.description || undefined}
                    >
                      {v.name}
                      <button
                        onClick={() => saveSettings.mutate({ values_list: valuesList.filter((_, i) => i !== idx) })}
                        className="opacity-50 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="Novo valor…"
                    className="h-9"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newValue.trim()) {
                        saveSettings.mutate({ values_list: [...valuesList, { name: newValue.trim() }] });
                        setNewValue('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newValue.trim()) {
                        saveSettings.mutate({ values_list: [...valuesList, { name: newValue.trim() }] });
                        setNewValue('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === SWOT — full width 2x2 grande === */}
      <Card className="hq-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid2x2 className="h-5 w-5 text-primary" /> Análise SWOT
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">sync com Gestão de Marca</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SWOT_QUADRANTS.map(q => {
              const items = swotItems.filter(i => i.quadrant === q.key);
              const isAdding = addingSwot === q.key;
              return (
                <div key={q.key} className={`rounded-xl border ${q.border} ${q.bg} p-4 min-h-[200px] flex flex-col`}>
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className={`text-sm font-bold uppercase tracking-wide ${q.color}`}>{q.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">{q.hint}</p>

                  <div className="space-y-1.5 flex-1">
                    {items.length === 0 && !isAdding && (
                      <p className="text-xs italic text-muted-foreground py-2">Sem itens ainda.</p>
                    )}
                    {items.map(it => (
                      <div key={it.id} className="group flex items-start gap-2 text-sm leading-snug bg-background/70 rounded-md px-2.5 py-2 border border-border/50">
                        <span className="flex-1">{it.content}</span>
                        <button onClick={() => removeSwot.mutate(it.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    {isAdding ? (
                      <div className="space-y-2">
                        <Textarea
                          value={swotDraft}
                          onChange={e => setSwotDraft(e.target.value)}
                          rows={2}
                          autoFocus
                          className="text-sm resize-none bg-background"
                          placeholder={`Adicionar ${q.label.toLowerCase()}…`}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && swotDraft.trim()) {
                              addSwot.mutate({ quadrant: q.key, content: swotDraft.trim() });
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => swotDraft.trim() && addSwot.mutate({ quadrant: q.key, content: swotDraft.trim() })}>
                            <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAddingSwot(null); setSwotDraft(''); }}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setAddingSwot(q.key)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* === DIRETRIZES — full width === */}
      <Card className="hq-card">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Diretrizes Plurianuais
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">3-5 anos</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowNewDirective(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova diretriz
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNewDirective && (
            <div className="rounded-xl border-2 border-dashed border-primary/40 p-4 space-y-3 bg-primary/5">
              <Input
                value={dirDraft.title || ''}
                onChange={e => setDirDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="Título da diretriz (ex: Internacionalizar para mercados europeus)"
                className="h-10 text-sm"
                autoFocus
              />
              <Textarea
                value={dirDraft.description || ''}
                onChange={e => setDirDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="Descrição — porquê, como, que impacto esperado…"
                rows={3}
                className="text-sm leading-relaxed resize-none"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Select value={dirDraft.horizon} onValueChange={(v: any) => setDirDraft(d => ({ ...d, horizon: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Horizonte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3_anos">Horizonte 3 anos</SelectItem>
                    <SelectItem value="5_anos">Horizonte 5 anos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dirDraft.status} onValueChange={(v: any) => setDirDraft(d => ({ ...d, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={dirDraft.area || ''}
                  onChange={e => setDirDraft(d => ({ ...d, area: e.target.value }))}
                  placeholder="Área (opcional)"
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => dirDraft.title?.trim() && addDirective.mutate(dirDraft)}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Adicionar diretriz
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewDirective(false); setDirDraft({ title: '', description: '', horizon: '3_anos', status: 'ativa' }); }}>Cancelar</Button>
              </div>
            </div>
          )}

          {directives.length === 0 && !showNewDirective && (
            <div className="rounded-xl border border-dashed border-border py-12 px-4 text-center">
              <Target className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground/80 mb-1">Sem diretrizes ainda</p>
              <p className="text-xs text-muted-foreground mb-4">Define até onde queres chegar nos próximos 3-5 anos.</p>
              <Button variant="outline" size="sm" onClick={() => setShowNewDirective(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar primeira diretriz
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {directives.map(d => {
              const isEdit = editDirId === d.id;
              if (isEdit) {
                return (
                  <div key={d.id} className="md:col-span-2 rounded-xl border-2 border-primary/40 p-4 space-y-3 bg-primary/5">
                    <Input value={editDir.title ?? d.title} onChange={e => setEditDir(p => ({ ...p, title: e.target.value }))} className="h-10 text-sm" />
                    <Textarea value={editDir.description ?? d.description ?? ''} onChange={e => setEditDir(p => ({ ...p, description: e.target.value }))} rows={3} className="text-sm leading-relaxed resize-none" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={editDir.horizon ?? d.horizon} onValueChange={(v: any) => setEditDir(p => ({ ...p, horizon: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3_anos">Horizonte 3 anos</SelectItem>
                          <SelectItem value="5_anos">Horizonte 5 anos</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editDir.status ?? d.status} onValueChange={(v: any) => setEditDir(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={editDir.area ?? d.area ?? ''} onChange={e => setEditDir(p => ({ ...p, area: e.target.value }))} placeholder="Área" className="h-9" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateDirective.mutate({ id: d.id, patch: editDir })}><Save className="h-3.5 w-3.5 mr-1.5" />Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditDirId(null); setEditDir({}); }}>Cancelar</Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={d.id} className="rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm hq-transition p-4 group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-semibold leading-tight flex-1">{d.title}</h4>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditDirId(d.id); setEditDir({}); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => deleteDirective.mutate(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3 whitespace-pre-wrap">{d.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{d.horizon === '3_anos' ? '3 anos' : '5 anos'}</Badge>
                    {d.area && <Badge variant="secondary" className="text-[10px]">{d.area}</Badge>}
                    <span className={`text-[10px] uppercase tracking-wide font-medium ml-1 ${
                      d.status === 'ativa' ? 'text-success' :
                      d.status === 'em_revisao' ? 'text-warning' :
                      d.status === 'concluida' ? 'text-primary' : 'text-muted-foreground'
                    }`}>{STATUS_LABEL[d.status]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}