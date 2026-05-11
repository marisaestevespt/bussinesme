import { useState, useEffect, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Check, Pencil, X, FileText, Upload, ExternalLink, Paperclip, Eye, ChevronDown } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { resolveProductId } from '@/lib/productResolver';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';

const STATUSES = [
  { value: 'em_ideia', label: 'Em ideia', color: 'bg-accent-violet/15 text-accent-violet' },
  { value: 'em_construcao', label: 'Em construção', color: 'bg-warning/15 text-warning' },
  { value: 'ativo', label: 'Ativo', color: 'bg-success/15 text-success' },
  { value: 'pausado', label: 'Pausado', color: 'bg-info/15 text-info' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-muted text-muted-foreground' },
];

const ENTRY_POINTS = ['Landing Page', 'Redes Sociais', 'Email', 'Anúncio', 'Orgânico'];
const PLATAFORMAS = ['Systeme.io', 'Mailerlite', 'ActiveCampaign', 'Stripe', 'Hotmart'];
const TIPOS_FUNIL = [
  { value: 'venda', label: 'Venda' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'captacao', label: 'Captação' },
  { value: 'reactivacao', label: 'Reactivação' },
  { value: 'outro', label: 'Outro' },
];

type EtapaDoc = { name: string; url: string; type: 'file' | 'text'; content?: string };
type Etapa = { nome: string; descricao: string; condicao: string; documentos?: EtapaDoc[] };

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
    const productId = await resolveProductId(form.product_name);
    const { error } = await supabase.from('marketing_funnels').update({
      name: form.name, status: form.status, entry_points: form.entry_points,
      oferta_final: form.oferta_final || null, objetivo: form.objetivo || null,
      plataformas: form.plataformas, tipo_funil: form.tipo_funil || null,
      notas: form.notas || null, etapas: form.etapas, fluxo_resumido: form.fluxo_resumido || null,
      product_name: form.product_name || null,
      product_id: productId,
    } as any).eq('id', id!);
    setSaving(false);
    if (error) { toast.error('Não consegui guardar a funil. Tenta novamente.'); }
    else { toast.success('Guardado'); setEditing(false); qc.invalidateQueries({ queryKey: ['marketing-funnel', id] }); }
  };

  const cancelEdit = () => { if (item) syncForm(item); setEditing(false); };

  // Stage detail dialog (hooks must be before early return)
  const [stageDialogIdx, setStageDialogIdx] = useState<number | null>(null);
  const [uploadingStageDoc, setUploadingStageDoc] = useState(false);
  const [expandedDocIdx, setExpandedDocIdx] = useState<number | null>(null);
  const [editingDocName, setEditingDocName] = useState<{ idx: number; value: string } | null>(null);
  const stageFileRef = useRef<HTMLInputElement>(null);
  const [stageTextDoc, setStageTextDoc] = useState('');
  const [stageTextDocName, setStageTextDocName] = useState('');
  const [addingTextDoc, setAddingTextDoc] = useState(false);

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><InlineLoader /></div></AppLayout>
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
  const addEtapa = () => setForm(f => ({ ...f, etapas: [...f.etapas, { nome: '', descricao: '', condicao: '', documentos: [] }] }));
  const removeEtapa = (idx: number) => setForm(f => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));

  const stageDialogEtapa = stageDialogIdx !== null ? form.etapas[stageDialogIdx] : null;
  const stageDocumentos = stageDialogEtapa?.documentos || [];

  const updateStageDoc = (docs: EtapaDoc[]) => {
    if (stageDialogIdx === null) return;
    setForm(f => ({ ...f, etapas: f.etapas.map((e, i) => i === stageDialogIdx ? { ...e, documentos: docs } : e) }));
  };

  const handleStageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || stageDialogIdx === null) return;
    setUploadingStageDoc(true);
    const ext = file.name.split('.').pop();
    const path = `funnels/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('commercial-files').upload(path, file);
    if (error) { toast.error('Erro ao carregar ficheiro'); setUploadingStageDoc(false); return; }
    const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
    const newDoc: EtapaDoc = { name: file.name, url: urlData.publicUrl, type: 'file' };
    updateStageDoc([...stageDocumentos, newDoc]);
    setUploadingStageDoc(false);
    if (stageFileRef.current) stageFileRef.current.value = '';
  };

  const addTextDocument = () => {
    if (!stageTextDoc.trim()) return;
    const newDoc: EtapaDoc = { name: stageTextDocName.trim() || `Nota ${stageDocumentos.length + 1}`, url: '', type: 'text', content: stageTextDoc.trim() };
    updateStageDoc([...stageDocumentos, newDoc]);
    setStageTextDoc(''); setStageTextDocName(''); setAddingTextDoc(false);
  };

  const renameStageDoc = (dIdx: number, newName: string) => {
    updateStageDoc(stageDocumentos.map((d, i) => i === dIdx ? { ...d, name: newName } : d));
  };

  const removeStageDoc = (docIdx: number) => updateStageDoc(stageDocumentos.filter((_, i) => i !== docIdx));

  const staticText = (val: string, placeholder: string) =>
    val ? <p className="text-sm text-foreground whitespace-pre-wrap">{val}</p>
        : <p className="text-sm text-muted-foreground italic">{placeholder}</p>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <EntityHeroHeader
          icon={parseIcon((item as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('marketing_funnels').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['marketing-funnel', id] });
          }}
          coverUrl={(item as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('marketing_funnels').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['marketing-funnel', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`funnels/${id}`}
          disabled={!isOwner}
        />
        {/* Banner */}
        <div className="w-full rounded-xl py-10 px-8 flex flex-col items-start gap-2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--accent)), transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--secondary)), transparent 50%)' }} />
          <p className="text-[11px] uppercase tracking-[0.2em] font-medium relative" style={{ color: 'hsl(var(--primary-foreground) / 0.6)' }}>Funil</p>
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
              <BackNavigation parentRoute="/hub/marketing/funis" parentLabel="Funis" />
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
              <div className="flex flex-wrap gap-3 items-center">
                {allEntryPoints.map(ep => (
                  <label key={ep} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={form.entry_points.includes(ep)} onCheckedChange={() => toggleMulti('entry_points', ep)} />
                    <span className="text-sm">{ep}</span>
                  </label>
                ))}
                {addingEntry ? (
                  <div className="flex gap-2 items-center">
                    <Input value={newEntry} onChange={e => setNewEntry(e.target.value)} placeholder="Novo ponto de entrada" className="h-8 w-40" autoFocus />
                    <Button size="sm" variant="outline" className="h-8" disabled={!newEntry.trim()} onClick={() => {
                      const val = newEntry.trim();
                      setForm(f => ({ ...f, entry_points: [...f.entry_points, val] }));
                      setNewEntry(''); setAddingEntry(false);
                    }}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingEntry(false); setNewEntry(''); }}>✕</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setAddingEntry(true)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar novo</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.entry_points.length > 0
                  ? form.entry_points.map(ep => <Badge key={ep} variant="outline" className="text-xs">{ep}</Badge>)
                  : <EmptyHint>Nenhum ponto de entrada definido.</EmptyHint>}
              </div>
            )}
          </section>

          {/* Plataformas */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Plataforma(s)</h2>
            {editing ? (
              <div className="flex flex-wrap gap-3 items-center">
                {allPlataformas.map(p => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={form.plataformas.includes(p)} onCheckedChange={() => toggleMulti('plataformas', p)} />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
                {addingPlat ? (
                  <div className="flex gap-2 items-center">
                    <Input value={newPlat} onChange={e => setNewPlat(e.target.value)} placeholder="Nova plataforma" className="h-8 w-40" autoFocus />
                    <Button size="sm" variant="outline" className="h-8" disabled={!newPlat.trim()} onClick={() => {
                      const val = newPlat.trim();
                      setForm(f => ({ ...f, plataformas: [...f.plataformas, val] }));
                      setNewPlat(''); setAddingPlat(false);
                    }}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingPlat(false); setNewPlat(''); }}>✕</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setAddingPlat(true)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar nova</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.plataformas.length > 0
                  ? form.plataformas.map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)
                  : <EmptyHint>Nenhuma plataforma definida.</EmptyHint>}
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
              {form.etapas.map((etapa, idx) => {
                const docCount = etapa.documentos?.length || 0;
                return (
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
                          <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1" onClick={() => setStageDialogIdx(idx)}>
                            <Paperclip className="h-3 w-3" />
                            {docCount > 0 && <span className="text-xs">{docCount}</span>}
                          </Button>
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeEtapa(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold flex-1">{etapa.nome || '—'}</p>
                          {docCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground" onClick={() => setStageDialogIdx(idx)}>
                              <Paperclip className="h-3 w-3" /><span className="text-xs">{docCount} doc{docCount > 1 ? 's' : ''}</span>
                            </Button>
                          )}
                        </>
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
                );
              })}
              {form.etapas.length === 0 && <EmptyHint>Nenhuma etapa adicionada.</EmptyHint>}
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
      {/* Stage Documents Dialog */}
      <Dialog open={stageDialogIdx !== null} onOpenChange={open => { if (!open) { setStageDialogIdx(null); setAddingTextDoc(false); setStageTextDoc(''); setStageTextDocName(''); setExpandedDocIdx(null); setEditingDocName(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Documentos — {stageDialogEtapa?.nome || `Etapa ${(stageDialogIdx ?? 0) + 1}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {stageDocumentos.length > 0 ? (
              <div className="space-y-1">
                {stageDocumentos.map((doc, dIdx) => {
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
                              if (e.key === 'Enter') { renameStageDoc(dIdx, editingDocName.value); setEditingDocName(null); }
                              if (e.key === 'Escape') setEditingDocName(null);
                            }}
                            onBlur={() => { renameStageDoc(dIdx, editingDocName.value); setEditingDocName(null); }}
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
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); removeStageDoc(dIdx); }}>
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
              <EmptyHint>Nenhum documento associado a esta etapa.</EmptyHint>
            )}

            {editing && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex gap-2">
                  <input ref={stageFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleStageFileUpload} />
                  <Button variant="outline" size="sm" disabled={uploadingStageDoc} onClick={() => stageFileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploadingStageDoc ? 'A carregar...' : 'Carregar ficheiro'}
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
                      value={stageTextDocName}
                      onChange={e => setStageTextDocName(e.target.value)}
                      placeholder="Nome da nota (ex: Briefing, Checklist...)"
                      className="h-8"
                      autoFocus
                    />
                    <Textarea
                      value={stageTextDoc}
                      onChange={e => setStageTextDoc(e.target.value)}
                      placeholder="Escreve aqui a nota ou texto que queres associar a esta etapa..."
                      className="min-h-[120px] resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!stageTextDoc.trim()} onClick={addTextDocument}>
                        <Check className="h-3.5 w-3.5 mr-1" />Adicionar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setAddingTextDoc(false); setStageTextDoc(''); setStageTextDocName(''); }}>
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
