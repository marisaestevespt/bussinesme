import { useState, useEffect, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Check, Pencil, X, FileText, Upload, ExternalLink, Paperclip, ChevronDown } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';

const STATUSES = [
  { value: 'em_desenho', label: 'Em desenho', color: 'bg-warning/15 text-warning' },
  { value: 'ativa', label: 'Ativa', color: 'bg-success/15 text-success' },
  { value: 'pausada', label: 'Pausada', color: 'bg-info/15 text-info' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const DEFAULT_PLATAFORMAS = ['Mailerlite', 'ActiveCampaign', 'Zapier', 'Make', 'Systeme.io'];

type FluxoDoc = { name: string; url: string; type: 'file' | 'text'; content?: string };
type FluxoStep = { nome: string; documentos?: FluxoDoc[] };

type AutoFull = {
  id: string; name: string; status: string; oferta_final: string | null;
  objetivo: string | null; plataforma: string | null; notas: string | null;
  gatilho: string | null; plataformas_envolvidas: string[]; fluxo: (string | FluxoStep)[];
  condicoes: string[]; links: { label: string; url: string }[];
};

/** Normalize legacy string[] fluxo to FluxoStep[] */
const normalizeFluxo = (raw: any): FluxoStep[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) =>
    typeof item === 'string' ? { nome: item, documentos: [] } : { nome: item.nome || '', documentos: Array.isArray(item.documentos) ? item.documentos : [] }
  );
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

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', status: 'em_desenho', oferta_final: '', objetivo: '', plataforma: '', notas: '',
    gatilho: '', plataformas_envolvidas: [] as string[], fluxo: [] as FluxoStep[],
    condicoes: [] as string[], links: [] as { label: string; url: string }[], product_name: '',
  });
  const { products: productsQuery } = useProducts();
  const productsList = productsQuery.data || [];
  const [saving, setSaving] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');

  // Fluxo document dialog state
  const [fluxoDocDialogIdx, setFluxoDocDialogIdx] = useState<number | null>(null);
  const [uploadingFluxoDoc, setUploadingFluxoDoc] = useState(false);
  const [expandedDocIdx, setExpandedDocIdx] = useState<number | null>(null);
  const [editingDocName, setEditingDocName] = useState<{ idx: number; value: string } | null>(null);
  const fluxoFileRef = useRef<HTMLInputElement>(null);
  const [fluxoTextDoc, setFluxoTextDoc] = useState('');
  const [fluxoTextDocName, setFluxoTextDocName] = useState('');
  const [addingTextDoc, setAddingTextDoc] = useState(false);

  const allPlataformas = Array.from(new Set([
    ...DEFAULT_PLATAFORMAS,
    ...(form.plataforma && !DEFAULT_PLATAFORMAS.includes(form.plataforma) ? [form.plataforma] : []),
  ])).sort();

  const syncForm = (data: AutoFull) => {
    setForm({
      name: data.name || '', status: data.status || 'em_desenho',
      oferta_final: data.oferta_final || '', objetivo: data.objetivo || '',
      plataforma: data.plataforma || '', notas: data.notas || '',
      gatilho: data.gatilho || '',
      plataformas_envolvidas: Array.isArray(data.plataformas_envolvidas) ? data.plataformas_envolvidas : [],
      fluxo: normalizeFluxo(data.fluxo),
      condicoes: Array.isArray(data.condicoes) ? data.condicoes : [],
      links: Array.isArray(data.links) ? data.links : [],
      product_name: (data as any).product_name || '',
    });
  };

  useEffect(() => {
    if (item) syncForm(item);
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
    if (error) {
      toast.error('Não consegui guardar a automação. Tenta novamente.');
    } else {
      toast.success('Guardado');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['marketing-automation', id] });
    }
  };

  const cancelEdit = () => {
    if (item) syncForm(item);
    setEditing(false);
  };

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><InlineLoader /></div></AppLayout>
  );

  const st = STATUSES.find(s => s.value === form.status) || STATUSES[0];

  // List helpers for simple lists (plataformas_envolvidas, condicoes)
  const addToList = (key: 'plataformas_envolvidas' | 'condicoes') => {
    setForm(f => ({ ...f, [key]: [...f[key], ''] }));
  };
  const updateListItem = (key: 'plataformas_envolvidas' | 'condicoes', idx: number, val: string) => {
    setForm(f => ({ ...f, [key]: f[key].map((v, i) => i === idx ? val : v) }));
  };
  const removeListItem = (key: 'plataformas_envolvidas' | 'condicoes', idx: number) => {
    setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  };

  // Fluxo helpers
  const addFluxoStep = () => setForm(f => ({ ...f, fluxo: [...f.fluxo, { nome: '', documentos: [] }] }));
  const updateFluxoStep = (idx: number, val: string) => {
    setForm(f => ({ ...f, fluxo: f.fluxo.map((s, i) => i === idx ? { ...s, nome: val } : s) }));
  };
  const removeFluxoStep = (idx: number) => {
    setForm(f => ({ ...f, fluxo: f.fluxo.filter((_, i) => i !== idx) }));
  };

  // Fluxo document helpers
  const fluxoDialogStep = fluxoDocDialogIdx !== null ? form.fluxo[fluxoDocDialogIdx] : null;
  const fluxoDocumentos = fluxoDialogStep?.documentos || [];

  const updateFluxoDocs = (docs: FluxoDoc[]) => {
    if (fluxoDocDialogIdx === null) return;
    setForm(f => ({ ...f, fluxo: f.fluxo.map((s, i) => i === fluxoDocDialogIdx ? { ...s, documentos: docs } : s) }));
  };

  const handleFluxoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || fluxoDocDialogIdx === null) return;
    setUploadingFluxoDoc(true);
    const ext = file.name.split('.').pop();
    const path = `automations/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('commercial-files').upload(path, file);
    if (error) { toast.error('Erro ao carregar ficheiro'); setUploadingFluxoDoc(false); return; }
    const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
    const newDoc: FluxoDoc = { name: file.name, url: urlData.publicUrl, type: 'file' };
    updateFluxoDocs([...fluxoDocumentos, newDoc]);
    setUploadingFluxoDoc(false);
    if (fluxoFileRef.current) fluxoFileRef.current.value = '';
  };

  const addFluxoTextDocument = () => {
    if (!fluxoTextDoc.trim()) return;
    const newDoc: FluxoDoc = { name: fluxoTextDocName.trim() || `Nota ${fluxoDocumentos.length + 1}`, url: '', type: 'text', content: fluxoTextDoc.trim() };
    updateFluxoDocs([...fluxoDocumentos, newDoc]);
    setFluxoTextDoc(''); setFluxoTextDocName(''); setAddingTextDoc(false);
  };

  const renameFluxoDoc = (dIdx: number, newName: string) => {
    updateFluxoDocs(fluxoDocumentos.map((d, i) => i === dIdx ? { ...d, name: newName } : d));
  };

  const removeFluxoDoc = (docIdx: number) => updateFluxoDocs(fluxoDocumentos.filter((_, i) => i !== docIdx));

  const addLink = () => setForm(f => ({ ...f, links: [...f.links, { label: '', url: '' }] }));
  const updateLink = (idx: number, field: 'label' | 'url', val: string) => {
    setForm(f => ({ ...f, links: f.links.map((l, i) => i === idx ? { ...l, [field]: val } : l) }));
  };
  const removeLink = (idx: number) => setForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }));

  /* ---------- Static text helpers ---------- */
  const staticText = (val: string, placeholder: string) =>
    val ? <p className="text-sm text-foreground whitespace-pre-wrap">{val}</p>
        : <p className="text-sm text-muted-foreground italic">{placeholder}</p>;

  const staticList = (items: string[], placeholder: string, numbered = false, bulleted = false) => (
    <Card>
      <CardContent className="p-4 space-y-1">
        {items.length === 0 && <p className="text-sm text-muted-foreground italic">{placeholder}</p>}
        {items.map((val, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {numbered && <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 pt-0.5">{idx + 1}.</span>}
            {bulleted && <span className="text-muted-foreground shrink-0 pt-0.5">•</span>}
            <p className="text-sm text-foreground">{val || '—'}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderEditableList = (
    label: string, key: 'plataformas_envolvidas' | 'condicoes',
    placeholder: string, numbered = false, bulleted = false
  ) => (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        {editing && <Button variant="outline" size="sm" onClick={() => addToList(key)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
      </div>
      {!editing ? staticList(form[key], 'Nenhum item adicionado.', numbered, bulleted) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            {form[key].length === 0 && <EmptyHint>Nenhum item adicionado.</EmptyHint>}
            {form[key].map((val, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                {numbered && <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{idx + 1}.</span>}
                {bulleted && <span className="text-muted-foreground shrink-0">•</span>}
                <Input value={val}
                  onChange={e => updateListItem(key, idx, e.target.value)}
                  className="h-8 text-sm flex-1" placeholder={placeholder} />
                <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => removeListItem(key, idx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <EntityHeroHeader
          icon={parseIcon((item as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('marketing_automations').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['marketing-automation', id] });
          }}
          coverUrl={(item as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('marketing_automations').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['marketing-automation', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`automations/${id}`}
          disabled={!isOwner}
        />
        {/* Hero banner */}
        <div className="w-full rounded-xl py-10 px-8 flex flex-col items-start gap-2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--accent)), transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--secondary)), transparent 50%)' }} />
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium relative" style={{ color: 'hsl(var(--primary-foreground) / 0.6)' }}>Automação</p>
          <div className="relative">
            {editing ? (
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl md:kpi-display-sm mt-1 bg-transparent border-none h-auto p-0 focus-visible:ring-0 text-primary-foreground" />
            ) : (
              <h1 className="text-2xl md:kpi-display-sm mt-1 text-primary-foreground">{form.name}</h1>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackNavigation parentRoute="/hub/marketing/automacoes" parentLabel="Automações" />
              {editing ? (
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 w-auto gap-2"><SelectValue /></SelectTrigger>
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

          {/* Meta fields in highlighted cards */}
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-primary/15 bg-primary/[0.04]">
                <CardContent className="p-4">
                  <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
                  {addingPlatform ? (
                    <div className="flex gap-2 mt-1">
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
                    }}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {allPlataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        <SelectItem value="___add_new___" className="text-primary font-medium">+ Adicionar nova...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
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
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Plataforma</label>
                  <p className="text-sm font-medium mt-2">{form.plataforma || '—'}</p>
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

          <Separator />

          {/* Objetivo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Objetivo</h2>
            {editing ? (
              <Textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                placeholder="Descreve para que serve esta automação e o que pretende alcançar."
                className="min-h-[80px] resize-none" />
            ) : staticText(form.objetivo, 'Sem objetivo definido.')}
          </section>

          <Separator />

          {/* Gatilho */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Gatilho</h2>
            {editing ? (
              <Textarea value={form.gatilho} onChange={e => setForm(f => ({ ...f, gatilho: e.target.value }))}
                placeholder="O que activa esta automação? Ex: subscrição na lista, compra de produto, clique num link."
                className="min-h-[60px] resize-none" />
            ) : staticText(form.gatilho, 'Sem gatilho definido.')}
          </section>

          <Separator />

          {renderEditableList('Plataformas Envolvidas', 'plataformas_envolvidas', 'Ex: Mailerlite, Stripe, WordPress')}
          <Separator />

          {/* Fluxo da Automação — with documents */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Fluxo da Automação</h2>
              {editing && <Button variant="outline" size="sm" onClick={addFluxoStep}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
            </div>
            <Card>
              <CardContent className="p-4 space-y-2">
                {form.fluxo.length === 0 && <EmptyHint>Nenhum passo adicionado.</EmptyHint>}
                {form.fluxo.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    {editing ? (
                      <>
                        <Input value={step.nome}
                          onChange={e => updateFluxoStep(idx, e.target.value)}
                          className="h-8 text-sm flex-1" placeholder="Ex: Email de boas-vindas enviado" />
                        <Button variant="ghost" aria-label="Anexar" size="icon" className="h-7 w-7 shrink-0"
                          title="Documentos"
                          onClick={() => setFluxoDocDialogIdx(idx)}>
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          {(step.documentos?.length || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                              {step.documentos!.length}
                            </span>
                          )}
                        </Button>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={() => removeFluxoStep(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <p className="text-sm text-foreground flex-1">{step.nome || '—'}</p>
                        {(step.documentos?.length || 0) > 0 && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
                            onClick={() => setFluxoDocDialogIdx(idx)}>
                            <Paperclip className="h-3 w-3" />
                            {step.documentos!.length}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <Separator />
          {renderEditableList('Condições e Excepções', 'condicoes', 'Se acontecer X, fazer Y.', false, true)}
          <Separator />

          {/* Links */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Links e Recursos</h2>
              {editing && <Button variant="outline" size="sm" onClick={addLink}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
            </div>
            {!editing ? (
              <Card>
                <CardContent className="p-4 space-y-1">
                  {form.links.length === 0 && <EmptyHint>Nenhum link adicionado.</EmptyHint>}
                  {form.links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm font-medium">{link.label || '—'}</span>
                      {link.url && <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">{link.url}</a>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-2">
                  {form.links.length === 0 && <EmptyHint>Nenhum link adicionado.</EmptyHint>}
                  {form.links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <Input value={link.label} onChange={e => updateLink(idx, 'label', e.target.value)}
                        className="h-8 text-sm w-1/3" placeholder="Nome" />
                      <Input value={link.url} onChange={e => updateLink(idx, 'url', e.target.value)}
                        className="h-8 text-sm flex-1" placeholder="https://..." />
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => removeLink(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          <Separator />

          {/* Notas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            {editing ? (
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Notas adicionais sobre esta automação..."
                className="min-h-[80px] resize-none" />
            ) : staticText(form.notas, 'Sem notas.')}
          </section>
        </div>
      </div>

      {/* Fluxo Documents Dialog */}
      <Dialog open={fluxoDocDialogIdx !== null} onOpenChange={open => {
        if (!open) { setFluxoDocDialogIdx(null); setAddingTextDoc(false); setFluxoTextDoc(''); setFluxoTextDocName(''); setExpandedDocIdx(null); setEditingDocName(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Documentos — {fluxoDialogStep?.nome || `Passo ${(fluxoDocDialogIdx ?? 0) + 1}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {fluxoDocumentos.length > 0 ? (
              <div className="space-y-1">
                {fluxoDocumentos.map((doc, dIdx) => {
                  const isExpanded = expandedDocIdx === dIdx;
                  const isEditingName = editingDocName?.idx === dIdx;
                  return (
                    <div key={dIdx} className="border rounded-md">
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedDocIdx(isExpanded ? null : dIdx)}
                      >
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        {isEditingName ? (
                          <Input
                            value={editingDocName.value}
                            onChange={e => setEditingDocName({ idx: dIdx, value: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameFluxoDoc(dIdx, editingDocName.value); setEditingDocName(null); }
                              if (e.key === 'Escape') setEditingDocName(null);
                            }}
                            onBlur={() => { renameFluxoDoc(dIdx, editingDocName.value); setEditingDocName(null); }}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] shrink-0">{doc.type === 'file' ? 'Ficheiro' : 'Nota'}</Badge>
                        {editing && !isEditingName && (
                          <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); setEditingDocName({ idx: dIdx, value: doc.name }); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {editing && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); removeFluxoDoc(dIdx); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t">
                          {doc.type === 'text' && doc.content && (
                            <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded p-3">{doc.content}</p>
                          )}
                          {doc.type === 'file' && doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />Abrir ficheiro
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyHint>Nenhum documento associado a este passo.</EmptyHint>
            )}

            {editing && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex gap-2">
                  <input ref={fluxoFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFluxoFileUpload} />
                  <Button variant="outline" size="sm" disabled={uploadingFluxoDoc} onClick={() => fluxoFileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploadingFluxoDoc ? 'A carregar...' : 'Carregar ficheiro'}
                  </Button>
                  {!addingTextDoc && (
                    <Button variant="outline" size="sm" onClick={() => setAddingTextDoc(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Adicionar nota de texto
                    </Button>
                  )}
                </div>
                {addingTextDoc && (
                  <div className="space-y-2">
                    <Input
                      value={fluxoTextDocName}
                      onChange={e => setFluxoTextDocName(e.target.value)}
                      placeholder="Nome da nota (ex: Briefing, Checklist...)"
                      className="h-8"
                      autoFocus
                    />
                    <Textarea
                      value={fluxoTextDoc}
                      onChange={e => setFluxoTextDoc(e.target.value)}
                      placeholder="Escreve aqui a nota ou texto que queres associar a este passo..."
                      className="min-h-[120px] resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!fluxoTextDoc.trim()} onClick={addFluxoTextDocument}>
                        <Check className="h-3.5 w-3.5 mr-1" />Adicionar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setAddingTextDoc(false); setFluxoTextDoc(''); setFluxoTextDocName(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
