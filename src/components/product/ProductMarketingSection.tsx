import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ExternalLink, X, FileText, Pencil, Megaphone, Workflow, Zap, Target, Newspaper, ArrowLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { ProductTabHeader } from './_shared';
import { EntityTabs, EntityTabsList, EntityTabsTrigger, EntityTabsContent } from '@/components/layout/entity/EntityTabs';

interface MarketingPage {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  url?: string;
  responsible_id?: string;
  // Legacy fields (still readable from old payloads, no longer surfaced in UI)
  headline?: string;
  subheadline?: string;
  cta?: string;
  copy?: string;
  sections?: { title: string; notes: string; done: boolean }[];
  inspirations?: { label: string; url: string }[];
  notes?: string;
}

const PAGE_TYPES = ['Vendas', 'Obrigado', 'Upsell', 'Checkout', 'Captura (Opt-in)', 'Webinar', 'Aplicação', 'Outra'];
const PAGE_STATUSES = [
  { value: 'ideia', label: 'Ideia' },
  { value: 'a_escrever', label: 'A escrever' },
  { value: 'em_design', label: 'Em design' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'publicado', label: 'Publicado' },
];

interface Props {
  productContents: Array<Record<string, unknown>>;
  funnels: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
  trafficAds: Array<Record<string, unknown>>;
  isOwner: boolean;
  productName: string;
  salesPage: Record<string, unknown>;
  salesPageUrl: string;
  onUpdateSalesPage: (next: Record<string, unknown>) => void;
  onUpdateSalesPageUrl: (url: string) => void;
  onAddFunnel: () => void;
  onAddAutomation: () => void;
  onAddTrafficAd: () => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductMarketingSection({
  productContents, funnels, automations, trafficAds, isOwner,
  salesPage, salesPageUrl, onUpdateSalesPage, onUpdateSalesPageUrl,
  onAddFunnel, onAddAutomation, onAddTrafficAd, onDeleteRow,
}: Props) {
  const navigate = useNavigate();
  const sp = salesPage || {};

  // Team members (for "Responsável de fase")
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-basic'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name').order('full_name');
      return (data || []) as { id: string; full_name: string }[];
    },
  });

  // Migration: legacy single-page → array
  let pages: MarketingPage[] = Array.isArray((sp as any).pages) ? ((sp as any).pages as MarketingPage[]) : [];
  if (pages.length === 0 && ((sp as any).copy || (sp as any).headline || (sp as any).cta)) {
    pages = [{
      id: 'legacy',
      name: 'Página de Vendas',
      type: 'Vendas',
      status: 'a_escrever',
      url: salesPageUrl || '',
      headline: (sp as any).headline,
      subheadline: (sp as any).subheadline,
      cta: (sp as any).cta,
      copy: (sp as any).copy,
      sections: Array.isArray((sp as any).sections) ? (sp as any).sections : [],
      inspirations: Array.isArray((sp as any).inspirations) ? (sp as any).inspirations : [],
      notes: (sp as any).notes,
    }];
  }

  const setPages = (next: MarketingPage[]) => onUpdateSalesPage({ ...sp, pages: next });

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = pages.find(p => p.id === editingId) || null;

  const updateEditing = (patch: Partial<MarketingPage>) => {
    if (!editing) return;
    setPages(pages.map(p => p.id === editing.id ? { ...p, ...patch } : p));
  };

  const addPage = () => {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now());
    const newPage: MarketingPage = { id, name: 'Nova página', type: 'Vendas', status: 'ideia', sections: [], inspirations: [] };
    setPages([...pages, newPage]);
    setEditingId(id);
  };

  const removePage = (id: string) => setPages(pages.filter(p => p.id !== id));

  const statusBadge = (s?: string) => {
    const lbl = PAGE_STATUSES.find(x => x.value === s)?.label || s || '—';
    return <Badge variant="outline" className="text-xs">{lbl}</Badge>;
  };

  const editingInspirations = editing?.inspirations || [];

  // ── Full-page edit view (replaces the previous dialog) ──────────────
  if (editing) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar às páginas
          </Button>
          {isOwner && editing.id !== 'legacy' && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
              onClick={() => { removePage(editing.id); setEditingId(null); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar página
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <Input
            value={editing.name || ''}
            onChange={(e) => updateEditing({ name: e.target.value })}
            placeholder="Nome da página"
            className="h-10 text-lg font-semibold border-0 shadow-none focus-visible:ring-1 px-2"
            readOnly={!isOwner}
          />
        </div>

        {/* Campos principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={editing.type || ''} onValueChange={(v) => updateEditing({ type: v })} disabled={!isOwner}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {PAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={editing.status || ''} onValueChange={(v) => updateEditing({ status: v })} disabled={!isOwner}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {PAGE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">URL final</Label>
            <div className="flex items-center gap-1">
              <Input
                value={editing.url || ''}
                onChange={(e) => updateEditing({ url: e.target.value })}
                placeholder="https://..."
                className="h-9"
                readOnly={!isOwner}
              />
              {editing.url && (
                <a href={editing.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Responsável de fase
            </Label>
            <Select
              value={editing.responsible_id || 'none'}
              onValueChange={(v) => updateEditing({ responsible_id: v === 'none' ? undefined : v })}
              disabled={!isOwner}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Escolher membro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Copy + secções unificadas (Notion-like) */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Conteúdo da página</Label>
          <p className="text-xs text-muted-foreground">
            Escreve como no Notion: usa títulos para nomear cada secção e o separador horizontal (—) para dividir secções.
          </p>
          <RichTextEditor
            content={editing.copy || ''}
            onChange={(v) => updateEditing({ copy: v })}
            editable={isOwner}
            minHeight={420}
            placeholder="Começa a escrever a página… usa Título 2 para cada secção e insere um separador entre elas."
          />
        </div>

        {/* Inspirations */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Inspirações / Referências</Label>
          {editingInspirations.length === 0 && (
            <EmptyHint>Sem inspirações adicionadas.</EmptyHint>
          )}
          {editingInspirations.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={item.label}
                onChange={(e) => {
                  const next = [...editingInspirations];
                  next[i] = { ...next[i], label: e.target.value };
                  updateEditing({ inspirations: next });
                }}
                placeholder="Nome"
                className="h-8 text-sm w-1/3"
                readOnly={!isOwner}
              />
              <Input
                value={item.url}
                onChange={(e) => {
                  const next = [...editingInspirations];
                  next[i] = { ...next[i], url: e.target.value };
                  updateEditing({ inspirations: next });
                }}
                placeholder="https://..."
                className="h-8 text-sm flex-1"
                readOnly={!isOwner}
              />
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </a>
              )}
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => updateEditing({ inspirations: editingInspirations.filter((_, j) => j !== i) })}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {isOwner && (
            <Button variant="outline" size="sm"
              onClick={() => updateEditing({ inspirations: [...editingInspirations, { label: '', url: '' }] })}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar inspiração
            </Button>
          )}
        </div>

        {/* Notas internas */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Notas internas</Label>
          <Textarea
            value={editing.notes || ''}
            onChange={(e) => updateEditing({ notes: e.target.value })}
            placeholder="Pendências, ideias, testes A/B..."
            className="min-h-[100px] text-sm"
            readOnly={!isOwner}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      <ProductTabHeader
        icon={Megaphone}
        title="Marketing"
        description="Páginas, conteúdos, funis, automações e tráfego pago associados a este produto. Tudo o que vende, num só sítio."
      />
      <EntityTabs defaultValue="paginas" className="space-y-6">
        <EntityTabsList className="w-full justify-start flex-wrap">
          <EntityTabsTrigger value="paginas"><FileText className="h-3.5 w-3.5 mr-1.5 inline" />Páginas</EntityTabsTrigger>
          <EntityTabsTrigger value="conteudos"><Newspaper className="h-3.5 w-3.5 mr-1.5 inline" />Conteúdos</EntityTabsTrigger>
          <EntityTabsTrigger value="funis"><Workflow className="h-3.5 w-3.5 mr-1.5 inline" />Funis</EntityTabsTrigger>
          <EntityTabsTrigger value="automacoes"><Zap className="h-3.5 w-3.5 mr-1.5 inline" />Automações</EntityTabsTrigger>
          <EntityTabsTrigger value="trafego"><Target className="h-3.5 w-3.5 mr-1.5 inline" />Tráfego Pago</EntityTabsTrigger>
        </EntityTabsList>

        <EntityTabsContent value="paginas" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Páginas</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={addPage}>
              <Plus className="h-3 w-3 mr-1" /> Nova página
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <EmptyHint>Sem páginas. Cria a primeira (vendas, obrigado, upsell, checkout...).</EmptyHint>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pages.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditingId(p.id)}
                  className="group text-left border rounded-lg p-3 hover:border-primary hover:shadow-sm transition-all bg-card"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm truncate">{p.name || 'Sem nome'}</span>
                    </div>
                    {isOwner && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removePage(p.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.type && <Badge variant="secondary" className="text-xs">{p.type}</Badge>}
                    {statusBadge(p.status)}
                  </div>
                  {p.url && (
                    <div className="mt-2 text-xs text-muted-foreground truncate">{p.url}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Big editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[90vw] h-[92vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              <Input
                value={editing?.name || ''}
                onChange={(e) => updateEditing({ name: e.target.value })}
                placeholder="Nome da página"
                className="h-9 text-base font-semibold border-0 shadow-none focus-visible:ring-1 px-2"
                readOnly={!isOwner}
              />
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={editing.type || ''} onValueChange={(v) => updateEditing({ type: v })} disabled={!isOwner}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {PAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={editing.status || ''} onValueChange={(v) => updateEditing({ status: v })} disabled={!isOwner}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {PAGE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">URL</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={editing.url || ''}
                      onChange={(e) => updateEditing({ url: e.target.value })}
                      placeholder="https://..."
                      className="h-9"
                      readOnly={!isOwner}
                    />
                    {editing.url && (
                      <a href={editing.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Headline</Label>
                  <Input
                    value={editing.headline || ''}
                    onChange={(e) => updateEditing({ headline: e.target.value })}
                    placeholder="Título principal"
                    className="h-9"
                    readOnly={!isOwner}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">CTA Principal</Label>
                  <Input
                    value={editing.cta || ''}
                    onChange={(e) => updateEditing({ cta: e.target.value })}
                    placeholder="Ex: Quero candidatar-me"
                    className="h-9"
                    readOnly={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sub-headline</Label>
                <Textarea
                  value={editing.subheadline || ''}
                  onChange={(e) => updateEditing({ subheadline: e.target.value })}
                  placeholder="Frase de apoio"
                  className="min-h-[60px] text-sm"
                  readOnly={!isOwner}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Copy completo</Label>
                <RichTextEditor
                  content={editing.copy || ''}
                  onChange={(v) => updateEditing({ copy: v })}
                  editable={isOwner}
                />
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Secções da página</Label>
                {editingSections.length === 0 && (
                  <EmptyHint>Sem secções definidas.</EmptyHint>
                )}
                {editingSections.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start border rounded-md p-2">
                    <input
                      type="checkbox"
                      checked={!!s.done}
                      onChange={(e) => {
                        const next = [...editingSections];
                        next[i] = { ...next[i], done: e.target.checked };
                        updateEditing({ sections: next });
                      }}
                      disabled={!isOwner}
                      className="mt-2 shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <Input
                        value={s.title}
                        onChange={(e) => {
                          const next = [...editingSections];
                          next[i] = { ...next[i], title: e.target.value };
                          updateEditing({ sections: next });
                        }}
                        placeholder="Nome da secção (Hero, Benefícios, FAQ...)"
                        className="h-8 text-sm"
                        readOnly={!isOwner}
                      />
                      <Textarea
                        value={s.notes}
                        onChange={(e) => {
                          const next = [...editingSections];
                          next[i] = { ...next[i], notes: e.target.value };
                          updateEditing({ sections: next });
                        }}
                        placeholder="Notas / copy desta secção"
                        className="min-h-[50px] text-xs"
                        readOnly={!isOwner}
                      />
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => updateEditing({ sections: editingSections.filter((_, j) => j !== i) })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateEditing({ sections: [...editingSections, { title: '', notes: '', done: false }] })}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar secção
                  </Button>
                )}
              </div>

              {/* Inspirations */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Inspirações / Referências</Label>
                {editingInspirations.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={item.label}
                      onChange={(e) => {
                        const next = [...editingInspirations];
                        next[i] = { ...next[i], label: e.target.value };
                        updateEditing({ inspirations: next });
                      }}
                      placeholder="Nome"
                      className="h-8 text-sm w-1/3"
                      readOnly={!isOwner}
                    />
                    <Input
                      value={item.url}
                      onChange={(e) => {
                        const next = [...editingInspirations];
                        next[i] = { ...next[i], url: e.target.value };
                        updateEditing({ inspirations: next });
                      }}
                      placeholder="https://..."
                      className="h-8 text-sm flex-1"
                      readOnly={!isOwner}
                    />
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    )}
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => updateEditing({ inspirations: editingInspirations.filter((_, j) => j !== i) })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateEditing({ inspirations: [...editingInspirations, { label: '', url: '' }] })}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar inspiração
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notas internas</Label>
                <Textarea
                  value={editing.notes || ''}
                  onChange={(e) => updateEditing({ notes: e.target.value })}
                  placeholder="Pendências, ideias, testes A/B..."
                  className="min-h-[80px] text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </EntityTabsContent>

        <EntityTabsContent value="conteudos" className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Conteúdos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Conteúdos do calendário de conteúdos associados a este produto.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productContents.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem conteúdos associados a este produto</TableCell></TableRow>
              )}
              {productContents.map((c) => (
                <TableRow key={c.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/conteudos/${c.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((c.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{c.title as string}</TableCell>
                  <TableCell className="text-sm">{(c.format as string) || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.scheduled_at ? format(new Date(c.scheduled_at as string), 'dd/MM/yyyy') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </EntityTabsContent>

        <EntityTabsContent value="funis" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Funis</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddFunnel}>
              <Plus className="h-3 w-3 mr-1" /> Novo Funil
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atualização</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem funis</TableCell></TableRow>
              )}
              {funnels.map((f) => (
                <TableRow key={f.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/funis/${f.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((f.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{f.name as string}</TableCell>
                  <TableCell className="text-sm">{(f.tipo_funil as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(f.objetivo as string) || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(f.updated_at as string), 'dd/MM/yyyy')}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('marketing_funnels', f.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </EntityTabsContent>

        <EntityTabsContent value="automacoes" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Automações</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddAutomation}>
              <Plus className="h-3 w-3 mr-1" /> Nova Automação
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atualização</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem automações</TableCell></TableRow>
              )}
              {automations.map((a) => (
                <TableRow key={a.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/automacoes/${a.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((a.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{a.name as string}</TableCell>
                  <TableCell className="text-sm">{(a.plataforma as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(a.objetivo as string) || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(a.updated_at as string), 'dd/MM/yyyy')}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('marketing_automations', a.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </EntityTabsContent>

        <EntityTabsContent value="trafego" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tráfego Pago</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddTrafficAd}>
              <Plus className="h-3 w-3 mr-1" /> Novo Criativo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Início</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Link</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trafficAds.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Sem criativos</TableCell></TableRow>
              )}
              {trafficAds.map((ad) => (
                <TableRow key={ad.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/trafego-pago/criativo/${ad.id}`)}>
                  <TableCell className="text-sm">{ad.start_date ? format(new Date(ad.start_date as string), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="font-medium">{ad.name as string}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{((ad.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="text-sm">{(ad.formato as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(ad.objetivo as string) || '—'}</TableCell>
                  <TableCell>{ad.link ? <a href={ad.link as string} target="_blank" rel="noopener noreferrer" className="text-primary text-xs" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a> : '—'}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('traffic_creatives', ad.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </EntityTabsContent>
      </EntityTabs>
    </div>
  );
}
