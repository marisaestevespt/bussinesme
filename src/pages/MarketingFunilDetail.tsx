import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Check, Pencil, X } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';

const STATUSES = [
  { value: 'em_ideia', label: 'Em ideia', color: 'bg-violet-100 text-violet-800' },
  { value: 'em_construcao', label: 'Em construção', color: 'bg-amber-100 text-amber-800' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'pausado', label: 'Pausado', color: 'bg-blue-100 text-blue-800' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const ENTRY_POINTS = ['Landing Page', 'Redes Sociais', 'Email', 'Anúncio', 'Orgânico', 'Outro'];
const PLATAFORMAS = ['Systeme.io', 'Mailerlite', 'ActiveCampaign', 'Stripe', 'Hotmart', 'Outro'];
const TIPOS_FUNIL = [
  { value: 'venda', label: 'Venda' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'captacao', label: 'Captação' },
  { value: 'reactivacao', label: 'Reactivação' },
  { value: 'outro', label: 'Outro' },
];

type Etapa = { nome: string; descricao: string; condicao: string };

type FunnelFull = {
  id: string; name: string; status: string; entry_points: string[];
  oferta_final: string | null; objetivo: string | null; plataformas: string[];
  tipo_funil: string | null; notas: string | null; etapas: Etapa[];
  fluxo_resumido: string | null; product_name?: string | null;
};

export default function MarketingFunilDetail() {
  const { id } = useParams<{ id: string }>();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: item, isLoading } = useQuery({
    queryKey: ['marketing-funnel', id],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_funnels').select('*').eq('id', id!).maybeSingle() as any;
      return data as FunnelFull | null;
    },
    enabled: !!id,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', status: 'em_ideia', entry_points: [] as string[], oferta_final: '',
    objetivo: '', plataformas: [] as string[], tipo_funil: '', notas: '',
    etapas: [] as Etapa[], fluxo_resumido: '', product_name: '',
  });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState('');
  const [addingEntry, setAddingEntry] = useState(false);
  const [newPlat, setNewPlat] = useState('');
  const [addingPlat, setAddingPlat] = useState(false);

  const syncForm = (data: FunnelFull) => {
    setForm({
      name: data.name || '', status: data.status || 'em_ideia',
      entry_points: Array.isArray(data.entry_points) ? data.entry_points : [],
      oferta_final: data.oferta_final || '', objetivo: data.objetivo || '',
      plataformas: Array.isArray(data.plataformas) ? data.plataformas : [],
      tipo_funil: data.tipo_funil || '', notas: data.notas || '',
      etapas: Array.isArray(data.etapas) ? data.etapas : [],
      fluxo_resumido: data.fluxo_resumido || '',
      product_name: data.product_name || '',
    });
  };

  useEffect(() => { if (item) syncForm(item); }, [item]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('marketing_funnels').update({
      name: form.name, status: form.status, entry_points: form.entry_points,
      oferta_final: form.oferta_final || null, objetivo: form.objetivo || null,
      plataformas: form.plataformas, tipo_funil: form.tipo_funil || null,
      notas: form.notas || null, etapas: form.etapas, fluxo_resumido: form.fluxo_resumido || null,
      product_name: form.product_name || null,
    } as any).eq('id', id!);
    setSaving(false);
    if (error) { toast.error('Erro ao guardar'); }
    else { toast.success('Guardado'); setEditing(false); qc.invalidateQueries({ queryKey: ['marketing-funnel', id] }); }
  };

  const cancelEdit = () => { if (item) syncForm(item); setEditing(false); };

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>
  );

  const st = STATUSES.find(s => s.value === form.status) || STATUSES[0];
  const tf = TIPOS_FUNIL.find(t => t.value === form.tipo_funil);

  // Dynamic lists: defaults + any custom values already in form
  const allEntryPoints = Array.from(new Set([...ENTRY_POINTS, ...form.entry_points]));
  const allPlataformas = Array.from(new Set([...PLATAFORMAS, ...form.plataformas]));

  const toggleMulti = (key: 'entry_points' | 'plataformas', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }));
  };

  const updateEtapa = (idx: number, field: keyof Etapa, val: string) => {
    setForm(f => ({ ...f, etapas: f.etapas.map((e, i) => i === idx ? { ...e, [field]: val } : e) }));
  };
  const addEtapa = () => setForm(f => ({ ...f, etapas: [...f.etapas, { nome: '', descricao: '', condicao: '' }] }));
  const removeEtapa = (idx: number) => setForm(f => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));

  const staticText = (val: string, placeholder: string) =>
    val ? <p className="text-sm text-foreground whitespace-pre-wrap">{val}</p>
        : <p className="text-sm text-muted-foreground italic">{placeholder}</p>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Banner */}
        <div className="w-full rounded-xl py-10 px-8 flex flex-col items-start gap-2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--accent)), transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--secondary)), transparent 50%)' }} />
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium relative" style={{ color: 'hsl(var(--primary-foreground) / 0.6)' }}>Funil</p>
          <div className="relative">
            {editing ? (
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-none h-auto p-0 focus-visible:ring-0"
                style={{ color: 'hsl(var(--primary-foreground))' }} />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>{form.name}</h1>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackNavigation parentRoute="/hub/marketing/funis" parentLabel="Funis" />
              {editing ? (
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 w-auto gap-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
              )}
            </div>
            {isOwner && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Editar
              </Button>
            )}
            {isOwner && editing && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5 mr-1" />Cancelar
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            )}
          </div>

          {/* Meta fields */}
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-xs font-medium text-muted-foreground">Tipo de Funil</label>
                  <Select value={form.tipo_funil} onValueChange={v => setForm(f => ({ ...f, tipo_funil: v }))}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{TIPOS_FUNIL.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-xs font-medium text-muted-foreground">Produto</label>
                  <Select value={form.product_name || '___none___'} onValueChange={v => setForm(f => ({ ...f, product_name: v === '___none___' ? '' : v }))}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="___none___">Nenhum</SelectItem>
                      {productsList.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-xs font-medium text-muted-foreground">Oferta Final</label>
                  <Input value={form.oferta_final} onChange={e => setForm(f => ({ ...f, oferta_final: e.target.value }))}
                    className="h-9 mt-1" placeholder="Produto/Plataforma/Outro Final" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo de Funil</label>
                  <p className="text-sm font-medium mt-2">{tf ? tf.label : '—'}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produto</label>
                  <p className="text-sm font-medium mt-2">{form.product_name || '—'}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Oferta Final</label>
                  <p className="text-sm font-medium mt-2">{form.oferta_final || '—'}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Entry Points */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Ponto(s) de Entrada</h2>
            {editing ? (
              <div className="flex flex-wrap gap-3">
                {ENTRY_POINTS.map(ep => (
                  <label key={ep} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={form.entry_points.includes(ep)} onCheckedChange={() => toggleMulti('entry_points', ep)} />
                    <span className="text-sm">{ep}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {form.entry_points.length > 0
                  ? form.entry_points.map(ep => <Badge key={ep} variant="outline" className="text-xs">{ep}</Badge>)
                  : <p className="text-sm text-muted-foreground italic">Nenhum ponto de entrada definido.</p>}
              </div>
            )}
          </section>

          {/* Plataformas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Plataforma(s)</h2>
            {editing ? (
              <div className="flex flex-wrap gap-3">
                {PLATAFORMAS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={form.plataformas.includes(p)} onCheckedChange={() => toggleMulti('plataformas', p)} />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {form.plataformas.length > 0
                  ? form.plataformas.map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)
                  : <p className="text-sm text-muted-foreground italic">Nenhuma plataforma definida.</p>}
              </div>
            )}
          </section>

          <Separator />

          {/* Objetivo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Objetivo</h2>
            {editing ? (
              <Textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                placeholder="Descreve o objetivo principal deste funil."
                className="min-h-[80px] resize-none" />
            ) : staticText(form.objetivo, 'Sem objetivo definido.')}
          </section>

          <Separator />

          {/* Etapas do Funil */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Etapas do Funil</h2>
              {editing && <Button variant="outline" size="sm" onClick={addEtapa}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar Etapa</Button>}
            </div>
            <div className="space-y-4">
              {form.etapas.map((etapa, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">// {idx + 1} →</span>
                      {editing ? (
                        <>
                          <Input value={etapa.nome}
                            onChange={e => updateEtapa(idx, 'nome', e.target.value)}
                            placeholder="Nome da etapa"
                            className="h-8 text-sm font-semibold flex-1" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeEtapa(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm font-semibold">{etapa.nome || '—'}</p>
                      )}
                    </div>
                    {editing ? (
                      <Textarea value={etapa.descricao}
                        onChange={e => updateEtapa(idx, 'descricao', e.target.value)}
                        placeholder="Descreve o que acontece nesta etapa..."
                        className="min-h-[60px] resize-none text-sm" />
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{etapa.descricao || ''}</p>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground italic mt-1 shrink-0">Condição:</span>
                      {editing ? (
                        <Input value={etapa.condicao}
                          onChange={e => updateEtapa(idx, 'condicao', e.target.value)}
                          placeholder="Condição para avançar"
                          className="h-7 text-xs flex-1" />
                      ) : (
                        <p className="text-xs text-foreground">{etapa.condicao || '—'}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {form.etapas.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">Nenhuma etapa adicionada.</p>}
            </div>
          </section>

          <Separator />

          {/* Fluxo Resumido */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Fluxo Resumido</h2>
            {editing ? (
              <Textarea value={form.fluxo_resumido} onChange={e => setForm(f => ({ ...f, fluxo_resumido: e.target.value }))}
                placeholder="Resume aqui o fluxo completo do funil de forma simplificada."
                className="min-h-[80px] resize-none" />
            ) : staticText(form.fluxo_resumido, 'Sem fluxo resumido.')}
          </section>

          <Separator />

          {/* Notas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            {editing ? (
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Notas adicionais sobre este funil..."
                className="min-h-[80px] resize-none" />
            ) : staticText(form.notas, 'Sem notas.')}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
