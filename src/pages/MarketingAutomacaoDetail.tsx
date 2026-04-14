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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';

const STATUSES = [
  { value: 'em_desenho', label: 'Em desenho', color: 'bg-amber-100 text-amber-800' },
  { value: 'ativa', label: 'Ativa', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'pausada', label: 'Pausada', color: 'bg-blue-100 text-blue-800' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const DEFAULT_PLATAFORMAS = ['Mailerlite', 'ActiveCampaign', 'Zapier', 'Make', 'Systeme.io'];

type AutoFull = {
  id: string; name: string; status: string; oferta_final: string | null;
  objetivo: string | null; plataforma: string | null; notas: string | null;
  gatilho: string | null; plataformas_envolvidas: string[]; fluxo: string[];
  condicoes: string[]; links: { label: string; url: string }[];
};

export default function MarketingAutomacaoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: item, isLoading } = useQuery({
    queryKey: ['marketing-automation', id],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_automations').select('*').eq('id', id!).maybeSingle() as any;
      return data as AutoFull | null;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState({
    name: '', status: 'em_desenho', oferta_final: '', objetivo: '', plataforma: '', notas: '',
    gatilho: '', plataformas_envolvidas: [] as string[], fluxo: [] as string[],
    condicoes: [] as string[], links: [] as { label: string; url: string }[], product_name: '',
  });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];
  const [saving, setSaving] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');

  // Dynamic platform list: defaults + current value if custom
  const allPlataformas = Array.from(new Set([
    ...DEFAULT_PLATAFORMAS,
    ...(form.plataforma && !DEFAULT_PLATAFORMAS.includes(form.plataforma) ? [form.plataforma] : []),
  ])).sort();

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || '', status: item.status || 'em_desenho',
        oferta_final: item.oferta_final || '', objetivo: item.objetivo || '',
        plataforma: item.plataforma || '', notas: item.notas || '',
        gatilho: item.gatilho || '',
        plataformas_envolvidas: Array.isArray(item.plataformas_envolvidas) ? item.plataformas_envolvidas : [],
        fluxo: Array.isArray(item.fluxo) ? item.fluxo : [],
        condicoes: Array.isArray(item.condicoes) ? item.condicoes : [],
        links: Array.isArray(item.links) ? item.links : [],
        product_name: (item as any).product_name || '',
      });
    }
  }, [item]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('marketing_automations').update({
      name: form.name, status: form.status,
      oferta_final: form.oferta_final || null, objetivo: form.objetivo || null,
      plataforma: form.plataforma || null, notas: form.notas || null,
      gatilho: form.gatilho || null,
      plataformas_envolvidas: form.plataformas_envolvidas,
      fluxo: form.fluxo, condicoes: form.condicoes, links: form.links,
      product_name: form.product_name || null,
    } as any).eq('id', id!);
    setSaving(false);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['marketing-automation', id] }); }
  };

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>
  );

  const st = STATUSES.find(s => s.value === form.status) || STATUSES[0];

  // List helpers
  const addToList = (key: 'plataformas_envolvidas' | 'fluxo' | 'condicoes') => {
    setForm(f => ({ ...f, [key]: [...f[key], ''] }));
  };
  const updateListItem = (key: 'plataformas_envolvidas' | 'fluxo' | 'condicoes', idx: number, val: string) => {
    setForm(f => ({ ...f, [key]: f[key].map((v, i) => i === idx ? val : v) }));
  };
  const removeListItem = (key: 'plataformas_envolvidas' | 'fluxo' | 'condicoes', idx: number) => {
    setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  };

  const addLink = () => setForm(f => ({ ...f, links: [...f.links, { label: '', url: '' }] }));
  const updateLink = (idx: number, field: 'label' | 'url', val: string) => {
    setForm(f => ({ ...f, links: f.links.map((l, i) => i === idx ? { ...l, [field]: val } : l) }));
  };
  const removeLink = (idx: number) => setForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }));

  const renderEditableList = (
    label: string, key: 'plataformas_envolvidas' | 'fluxo' | 'condicoes',
    placeholder: string, numbered = false
  ) => (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        {isOwner && <Button variant="outline" size="sm" onClick={() => addToList(key)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          {form[key].length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum item adicionado.</p>}
          {form[key].map((val, idx) => (
            <div key={idx} className="flex items-center gap-2 group">
              {numbered && <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{idx + 1}.</span>}
              <Input value={val}
                onChange={e => updateListItem(key, idx, e.target.value)}
                className="h-8 text-sm flex-1" placeholder={placeholder} readOnly={!isOwner} />
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => removeListItem(key, idx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Automação</p>
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
            <BackNavigation parentRoute="/hub/marketing/automacoes" parentLabel="Automações" />
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
              <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
              {addingPlatform ? (
                <div className="flex gap-2">
                  <Input value={newPlatform} onChange={e => setNewPlatform(e.target.value)} placeholder="Nome da plataforma" className="h-9" autoFocus />
                  <Button size="sm" variant="outline" className="h-9" disabled={!newPlatform.trim()} onClick={() => {
                    setForm(f => ({ ...f, plataforma: newPlatform.trim() }));
                    setAddingPlatform(false);
                    setNewPlatform('');
                  }}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => { setAddingPlatform(false); setNewPlatform(''); }}>Cancelar</Button>
                </div>
              ) : (
                <Select value={form.plataforma} onValueChange={v => {
                  if (v === '___add_new___') { setAddingPlatform(true); return; }
                  setForm(f => ({ ...f, plataforma: v }));
                }} disabled={!isOwner}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {allPlataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="___add_new___" className="text-primary font-medium">+ Adicionar nova...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Oferta Final</label>
              <Input value={form.oferta_final} onChange={e => setForm(f => ({ ...f, oferta_final: e.target.value }))}
                className="h-9" placeholder="Produto/Plataforma/Outro Final" readOnly={!isOwner} />
            </div>
          </div>

          <Separator />

          {/* 1. Objetivo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Objetivo</h2>
            <Textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
              placeholder="Descreve para que serve esta automação e o que pretende alcançar."
              className="min-h-[80px] resize-none" readOnly={!isOwner} />
          </section>

          <Separator />

          {/* 2. Gatilho */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Gatilho</h2>
            <Textarea value={form.gatilho} onChange={e => setForm(f => ({ ...f, gatilho: e.target.value }))}
              placeholder="O que activa esta automação? Ex: subscrição na lista, compra de produto, clique num link."
              className="min-h-[60px] resize-none" readOnly={!isOwner} />
          </section>

          <Separator />

          {/* 3. Plataformas Envolvidas */}
          {renderEditableList('Plataformas Envolvidas', 'plataformas_envolvidas', 'Ex: Mailerlite, Stripe, WordPress')}

          <Separator />

          {/* 4. Fluxo da Automação */}
          {renderEditableList('Fluxo da Automação', 'fluxo', 'Ex: Email de boas-vindas enviado', true)}

          <Separator />

          {/* 5. Condições e Excepções */}
          {renderEditableList('Condições e Excepções', 'condicoes', 'Se acontecer X, fazer Y.')}

          <Separator />

          {/* 6. Links e Recursos */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Links e Recursos</h2>
              {isOwner && <Button variant="outline" size="sm" onClick={addLink}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
            </div>
            <Card>
              <CardContent className="p-4 space-y-2">
                {form.links.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum link adicionado.</p>}
                {form.links.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <Input value={link.label} onChange={e => updateLink(idx, 'label', e.target.value)}
                      className="h-8 text-sm w-1/3" placeholder="Nome" readOnly={!isOwner} />
                    <Input value={link.url} onChange={e => updateLink(idx, 'url', e.target.value)}
                      className="h-8 text-sm flex-1" placeholder="https://..." readOnly={!isOwner} />
                    {isOwner && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => removeLink(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* 7. Notas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Notas adicionais sobre esta automação..."
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
