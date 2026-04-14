import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react';
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
  fluxo_resumido: string | null;
};

export default function MarketingFunilDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const [form, setForm] = useState({
    name: '', status: 'em_ideia', entry_points: [] as string[], oferta_final: '',
    objetivo: '', plataformas: [] as string[], tipo_funil: '', notas: '',
    etapas: [] as Etapa[], fluxo_resumido: '', product_name: '',
  });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || '', status: item.status || 'em_ideia',
        entry_points: Array.isArray(item.entry_points) ? item.entry_points : [],
        oferta_final: item.oferta_final || '', objetivo: item.objetivo || '',
        plataformas: Array.isArray(item.plataformas) ? item.plataformas : [],
        tipo_funil: item.tipo_funil || '', notas: item.notas || '',
        etapas: Array.isArray(item.etapas) ? item.etapas : [],
        fluxo_resumido: item.fluxo_resumido || '',
        product_name: (item as any).product_name || '',
      });
    }
  }, [item]);

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
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['marketing-funnel', id] }); }
  };

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>
  );

  const st = STATUSES.find(s => s.value === form.status) || STATUSES[0];

  const toggleMulti = (key: 'entry_points' | 'plataformas', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }));
  };

  const updateEtapa = (idx: number, field: keyof Etapa, val: string) => {
    setForm(f => ({
      ...f,
      etapas: f.etapas.map((e, i) => i === idx ? { ...e, [field]: val } : e),
    }));
  };

  const addEtapa = () => {
    setForm(f => ({ ...f, etapas: [...f.etapas, { nome: '', descricao: '', condicao: '' }] }));
  };

  const removeEtapa = (idx: number) => {
    setForm(f => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Funil</p>
          <div className="flex items-center gap-3">
            {isOwner ? (
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-none text-center h-auto p-0"
                style={{ color: 'hsl(var(--primary-foreground))' }} />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>{form.name}</h1>
            )}
            <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing/funis" parentLabel="Funis" />
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} disabled={!isOwner}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Funil</label>
              <Select value={form.tipo_funil} onValueChange={v => setForm(f => ({ ...f, tipo_funil: v }))} disabled={!isOwner}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{TIPOS_FUNIL.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Oferta Final</label>
              <Input value={form.oferta_final} onChange={e => setForm(f => ({ ...f, oferta_final: e.target.value }))}
                className="h-9" placeholder="Produto associado" readOnly={!isOwner} />
            </div>
          </div>

          {/* Multi-select: Entry Points */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Ponto(s) de Entrada</label>
            <div className="flex flex-wrap gap-2">
              {ENTRY_POINTS.map(ep => (
                <label key={ep} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={form.entry_points.includes(ep)}
                    onCheckedChange={() => isOwner && toggleMulti('entry_points', ep)} disabled={!isOwner} />
                  <span className="text-sm">{ep}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Multi-select: Plataformas */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Plataforma(s)</label>
            <div className="flex flex-wrap gap-2">
              {PLATAFORMAS.map(p => (
                <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={form.plataformas.includes(p)}
                    onCheckedChange={() => isOwner && toggleMulti('plataformas', p)} disabled={!isOwner} />
                  <span className="text-sm">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Objetivo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Objetivo</h2>
            <Card className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <Textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                  placeholder="Descreve o objetivo principal deste funil."
                  className="min-h-[80px] resize-none border-none shadow-none p-0 focus-visible:ring-0" readOnly={!isOwner} />
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Etapas do Funil */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Etapas do Funil</h2>
              {isOwner && <Button variant="outline" size="sm" onClick={addEtapa}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar Etapa</Button>}
            </div>
            <div className="space-y-4">
              {form.etapas.map((etapa, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">// {idx + 1} →</span>
                      <Input value={etapa.nome}
                        onChange={e => updateEtapa(idx, 'nome', e.target.value)}
                        placeholder="Nome da etapa"
                        className="h-8 text-sm font-semibold flex-1 border-none shadow-none p-0 focus-visible:ring-0"
                        readOnly={!isOwner} />
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeEtapa(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Textarea value={etapa.descricao}
                      onChange={e => updateEtapa(idx, 'descricao', e.target.value)}
                      placeholder="Descreve o que acontece nesta etapa..."
                      className="min-h-[60px] resize-none text-sm" readOnly={!isOwner} />
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground italic mt-1 shrink-0">Condição necessária para avançar:</span>
                      <Input value={etapa.condicao}
                        onChange={e => updateEtapa(idx, 'condicao', e.target.value)}
                        placeholder="XXX"
                        className="h-7 text-xs flex-1" readOnly={!isOwner} />
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
            <Card className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <Textarea value={form.fluxo_resumido} onChange={e => setForm(f => ({ ...f, fluxo_resumido: e.target.value }))}
                  placeholder="Resume aqui o fluxo completo do funil de forma simplificada."
                  className="min-h-[80px] resize-none border-none shadow-none p-0 focus-visible:ring-0" readOnly={!isOwner} />
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Notas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Notas adicionais sobre este funil..."
              className="min-h-[80px] resize-none" readOnly={!isOwner} />
          </section>

          {isOwner && (
            <div className="flex justify-end pt-4">
              <Button onClick={save} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
