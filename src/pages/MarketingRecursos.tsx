import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, Plus, Trash2, Pencil, Check, X, ExternalLink,
  Image as ImageIcon, Palette, Link2, Lightbulb, Settings2, Tag as TagIcon,
} from 'lucide-react';
import { CONTENT_TYPE_OPTIONS, FORMAT_OPTIONS, type MarketingChannel } from '@/lib/marketing-constants';
import { BackNavigation } from '@/components/BackNavigation';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { safeUrl } from '@/lib/url';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type ResourceLink = { id: string; category: string; label: string; url: string; sort_order: number };
type Idea = { id: string; idea: string; description: string | null; channel: string | null; content_type: string | null; format: string | null; tags: string[] | null; created_by: string | null };
type IdeaView = {
  id: string;
  name: string;
  filter_tags: string[] | null;
  filter_channel: string | null;
  filter_content_type: string | null;
  filter_format: string | null;
  sort_order: number;
  is_system: boolean;
};

/** Inline tag editor: adicionar com Enter/vírgula, remover com X. */
function TagsEditor({ value, onChange, placeholder, suggestions = [] }: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState('');
  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) { setInput(''); return; }
    onChange([...value, t]);
    setInput('');
  };
  const removeTag = (t: string) => onChange(value.filter(x => x !== t));
  const remainingSuggestions = suggestions.filter(s => !value.includes(s)).slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 min-h-9">
        {value.map(t => (
          <Badge key={t} variant="secondary" className="text-xs gap-1">
            {t}
            <button type="button" onClick={() => removeTag(t)} aria-label={`Remover ${t}`} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
            else if (e.key === 'Backspace' && !input && value.length) { removeTag(value[value.length - 1]); }
          }}
          onBlur={() => input && addTag(input)}
          placeholder={value.length ? '' : (placeholder || 'Adicionar etiqueta…')}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[11px] text-muted-foreground self-center mr-1">Sugestões:</span>
          {remainingSuggestions.map(s => (
            <button key={s} type="button" onClick={() => addTag(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border hover:bg-muted">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketingRecursos() {
  const navigate = useNavigate();
  const { isOwner, user } = useAuth();
  const qc = useQueryClient();

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdea, setNewIdea] = useState<{ idea: string; description: string; channel: string; content_type: string; format: string; tags: string[] }>({ idea: '', description: '', channel: '', content_type: '', format: '', tags: [] });
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingView, setEditingView] = useState<IdeaView | null>(null);
  const [viewForm, setViewForm] = useState<{ name: string; filter_tags: string[]; filter_channel: string; filter_content_type: string; filter_format: string }>({ name: '', filter_tags: [], filter_channel: '__none__', filter_content_type: '__none__', filter_format: '__none__' });
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editIdeaForm, setEditIdeaForm] = useState<{ idea: string; description: string; channel: string; content_type: string; format: string; tags: string[] }>({ idea: '', description: '', channel: '', content_type: '', format: '', tags: [] });

  // Editable link fields
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState('');

  // Úteis: new link
  const [showAddUtil, setShowAddUtil] = useState(false);
  const [newUtilLabel, setNewUtilLabel] = useState('');
  const [newUtilUrl, setNewUtilUrl] = useState('');

  // ---- Queries ----
  const { data: resourceLinks = [] } = useQuery({
    queryKey: ['marketing-resource-links'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_resource_links').select('*').order('sort_order') as any;
      return (data || []) as ResourceLink[];
    },
  });

  const { data: ideas = [] } = useQuery({
    queryKey: ['marketing-ideas'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_ideas').select('*').order('created_at', { ascending: false }) as any;
      return (data || []) as Idea[];
    },
  });

  const { data: views = [] } = useQuery({
    queryKey: ['marketing-idea-views'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_idea_views' as any).select('*').order('sort_order') as any;
      return (data || []) as IdeaView[];
    },
  });

  const activeView = views.find(v => v.id === activeViewId) || views[0] || null;

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const activeChannels = channels.filter(c => c.is_active);

  // ---- Resource link helpers ----
  const getLink = (cat: string) => resourceLinks.find(l => l.category === cat);

  const upsertLink = async (category: string, url: string, label?: string) => {
    const existing = getLink(category);
    if (existing) {
      await supabase.from('marketing_resource_links').update({ url } as any).eq('id', existing.id);
    } else {
      await supabase.from('marketing_resource_links').insert({ category, url, label: label || category } as any);
    }
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
    setEditingLink(null);
  };

  const uteis = resourceLinks.filter(l => l.category === 'uteis');

  const addUtil = async () => {
    if (!newUtilLabel.trim()) return;
    await supabase.from('marketing_resource_links').insert({
      category: 'uteis', label: newUtilLabel, url: newUtilUrl, sort_order: uteis.length,
    } as any);
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
    setShowAddUtil(false);
    setNewUtilLabel('');
    setNewUtilUrl('');
  };

  const deleteUtil = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('marketing_resource_links').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
  };

  const updateUtilUrl = async (id: string, url: string) => {
    await supabase.from('marketing_resource_links').update({ url } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
    setEditingLink(null);
  };

  // ---- Ideas ----
  // Tag suggestions = união de todas as tags já usadas
  const allTags = Array.from(new Set((ideas || []).flatMap(i => i.tags || []))).sort();

  const createIdea = async () => {
    if (!newIdea.idea.trim()) return;
    await supabase.from('marketing_ideas').insert({
      idea: newIdea.idea,
      description: newIdea.description || null,
      channel: newIdea.channel || null,
      content_type: newIdea.content_type || null,
      format: newIdea.format || null,
      tags: newIdea.tags.length ? newIdea.tags : (activeView?.filter_tags || []),
      created_by: user?.id,
    } as any);
    qc.invalidateQueries({ queryKey: ['marketing-ideas'] });
    setShowNewIdea(false);
    setNewIdea({ idea: '', description: '', channel: '', content_type: '', format: '', tags: [] });
    toast.success('Ideia adicionada');
  };

  const deleteIdea = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('marketing_ideas').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-ideas'] });
  };

  const openIdea = (idea: Idea) => {
    setEditingIdea(idea);
    setEditIdeaForm({
      idea: idea.idea || '',
      description: idea.description || '',
      channel: idea.channel || '',
      content_type: idea.content_type || '',
      format: idea.format || '',
      tags: idea.tags || [],
    });
  };

  const saveIdea = async () => {
    if (!editingIdea) return;
    if (!editIdeaForm.idea.trim()) return;
    await supabase.from('marketing_ideas').update({
      idea: editIdeaForm.idea,
      description: editIdeaForm.description || null,
      channel: editIdeaForm.channel || null,
      content_type: editIdeaForm.content_type || null,
      format: editIdeaForm.format || null,
      tags: editIdeaForm.tags || [],
    } as any).eq('id', editingIdea.id);
    qc.invalidateQueries({ queryKey: ['marketing-ideas'] });
    setEditingIdea(null);
    toast.success('Ideia atualizada');
  };

  const filteredIdeas = !activeView ? ideas : ideas.filter(i => {
    const wanted = activeView.filter_tags || [];
    if (wanted.length > 0) {
      const have = i.tags || [];
      if (!wanted.every(t => have.includes(t))) return false;
    }
    if (activeView.filter_channel && i.channel !== activeView.filter_channel) return false;
    if (activeView.filter_content_type && i.content_type !== activeView.filter_content_type) return false;
    if (activeView.filter_format && i.format !== activeView.filter_format) return false;
    return true;
  });

  // ---- Views CRUD ----
  const openNewView = () => {
    setEditingView(null);
    setViewForm({ name: '', filter_tags: [], filter_channel: '__none__', filter_content_type: '__none__', filter_format: '__none__' });
    setShowViewDialog(true);
  };
  const openEditView = (v: IdeaView) => {
    setEditingView(v);
    setViewForm({
      name: v.name,
      filter_tags: v.filter_tags || [],
      filter_channel: v.filter_channel || '__none__',
      filter_content_type: v.filter_content_type || '__none__',
      filter_format: v.filter_format || '__none__',
    });
    setShowViewDialog(true);
  };
  const saveView = async () => {
    if (!viewForm.name.trim()) return;
    const payload = {
      name: viewForm.name.trim(),
      filter_tags: viewForm.filter_tags.length ? viewForm.filter_tags : null,
      filter_channel: viewForm.filter_channel === '__none__' ? null : viewForm.filter_channel,
      filter_content_type: viewForm.filter_content_type === '__none__' ? null : viewForm.filter_content_type,
      filter_format: viewForm.filter_format === '__none__' ? null : viewForm.filter_format,
    };
    if (editingView) {
      await supabase.from('marketing_idea_views' as any).update(payload).eq('id', editingView.id);
    } else {
      await supabase.from('marketing_idea_views' as any).insert({ ...payload, sort_order: views.length, created_by: user?.id });
    }
    qc.invalidateQueries({ queryKey: ['marketing-idea-views'] });
    setShowViewDialog(false);
    toast.success(editingView ? 'Vista atualizada' : 'Vista criada');
  };
  const deleteView = async (v: IdeaView) => {
    if (!(await confirmDestructive())) return;
    if (v.is_system) { toast.error('Vistas do sistema não podem ser eliminadas'); return; }
    if (!confirm(`Eliminar a vista "${v.name}"?`)) return;
    const { error } = await supabase.from('marketing_idea_views' as any).delete().eq('id', v.id);
    if (error) { toast.error('Sem permissão para eliminar'); return; }
    qc.invalidateQueries({ queryKey: ['marketing-idea-views'] });
    if (activeViewId === v.id) setActiveViewId(null);
  };

  const fotosLink = getLink('fotos');
  const marcaLink = getLink('marca');

  const renderLinkCard = (
    icon: React.ReactNode, title: string, category: string,
    placeholder: string, link: ResourceLink | undefined
  ) => (
    <Card className="flex-1">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {editingLink === category ? (
          <div className="flex items-center gap-1">
            <Input value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)}
              className="h-8 text-xs flex-1" placeholder={placeholder}
              onKeyDown={e => e.key === 'Enter' && upsertLink(category, editLinkUrl)} autoFocus />
            <Button variant="ghost" aria-label="Confirmar" size="icon" className="h-7 w-7" onClick={() => upsertLink(category, editLinkUrl)}><Check className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLink(null)}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            {link?.url ? (
              <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 truncate flex-1">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{link.url}</span>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground italic flex-1">{placeholder}</span>
            )}
            {isOwner && (
              <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => { setEditingLink(category); setEditLinkUrl(link?.url || ''); }}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Recursos" subtitle="Marketing 360" />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* TOP: 3 blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderLinkCard(<ImageIcon className="h-4 w-4 text-muted-foreground" />, 'Pasta de Fotos', 'fotos', 'Link para pasta de fotos no Drive', fotosLink)}
            {renderLinkCard(<Palette className="h-4 w-4 text-muted-foreground" />, 'Marca', 'marca', 'Link para pasta da marca no Drive', marcaLink)}

            {/* Úteis */}
            <Card className="flex-1">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Úteis</h3>
                  </div>
                  {isOwner && (
                    <Button variant="ghost" aria-label="Adicionar" size="icon" className="h-6 w-6" onClick={() => setShowAddUtil(true)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {uteis.length === 0 && (
                    <EmptyHint>Nenhum link adicionado.</EmptyHint>
                  )}
                  {uteis.map(u => (
                    <div key={u.id} className="flex items-center gap-2 group">
                      {editingLink === u.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)}
                            className="h-7 text-xs flex-1" placeholder="https://..."
                            onKeyDown={e => e.key === 'Enter' && updateUtilUrl(u.id, editLinkUrl)} autoFocus />
                          <Button variant="ghost" aria-label="Confirmar" size="icon" className="h-6 w-6" onClick={() => updateUtilUrl(u.id, editLinkUrl)}><Check className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingLink(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <>
                          {u.url ? (
                            <a href={safeUrl(u.url)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">{u.label}</a>
                          ) : (
                            <span className="text-xs text-muted-foreground flex-1">{u.label}</span>
                          )}
                          {isOwner && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                              <Button variant="ghost" aria-label="Editar" size="icon" className="h-5 w-5"
                                onClick={() => { setEditingLink(u.id); setEditLinkUrl(u.url || ''); }}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-5 w-5" onClick={() => deleteUtil(u.id)}>
                                <Trash2 className="h-2.5 w-2.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {showAddUtil && (
                  <div className="space-y-2 pt-2 border-t">
                    <Input value={newUtilLabel} onChange={e => setNewUtilLabel(e.target.value)} className="h-7 text-xs" placeholder="Nome do link" />
                    <Input value={newUtilUrl} onChange={e => setNewUtilUrl(e.target.value)} className="h-7 text-xs" placeholder="https://..." />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={addUtil} disabled={!newUtilLabel.trim()}>Adicionar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddUtil(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* BANCO DE IDEIAS */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Banco de Ideias</h2>
              </div>
              <Button size="sm" onClick={() => setShowNewIdea(true)}>
                <Plus className="h-4 w-4 mr-1" />Nova Ideia
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {views.map(v => (
                <div key={v.id} className="group relative">
                  <button
                    onClick={() => setActiveViewId(v.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm border transition-colors',
                      (activeView?.id === v.id)
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    )}
                  >
                    {v.name}
                  </button>
                  {!v.is_system && (
                    <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                      <Button variant="secondary" size="icon" aria-label="Editar vista" className="h-5 w-5 rounded-full shadow" onClick={() => openEditView(v)}>
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button variant="secondary" size="icon" aria-label="Eliminar vista" className="h-5 w-5 rounded-full shadow" onClick={() => deleteView(v)}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={openNewView} className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" />Nova vista
              </Button>
            </div>

            {activeView && ((activeView.filter_tags && activeView.filter_tags.length) || activeView.filter_channel || activeView.filter_content_type || activeView.filter_format) && (
              <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground flex-wrap">
                <span>Filtros:</span>
                {(activeView.filter_tags || []).map(t => (
                  <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
                ))}
                {activeView.filter_channel && <Badge variant="outline" className="text-xs">canal: {activeView.filter_channel}</Badge>}
                {activeView.filter_content_type && <Badge variant="outline" className="text-xs">tipo: {CONTENT_TYPE_OPTIONS.find(o => o.value === activeView.filter_content_type)?.label || activeView.filter_content_type}</Badge>}
                {activeView.filter_format && <Badge variant="outline" className="text-xs">formato: {FORMAT_OPTIONS.find(o => o.value === activeView.filter_format)?.label || activeView.filter_format}</Badge>}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ideia</TableHead>
                    <TableHead className="w-32">Canal</TableHead>
                    <TableHead className="w-36">Tipo de Conteúdo</TableHead>
                    <TableHead className="w-32">Formato</TableHead>
                    <TableHead className="w-48">Etiquetas</TableHead>
                    {isOwner && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIdeas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isOwner ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma ideia nesta vista.
                      </TableCell>
                    </TableRow>
                  ) : filteredIdeas.map(idea => (
                    <TableRow key={idea.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openIdea(idea)}>
                      <TableCell className="font-medium align-top">
                        <div className="whitespace-pre-wrap break-words">{idea.idea}</div>
                        {idea.description && (
                          <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">{idea.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {idea.channel && <Badge variant="secondary" className="text-xs">{idea.channel}</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {CONTENT_TYPE_OPTIONS.find(o => o.value === idea.content_type)?.label || idea.content_type}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {FORMAT_OPTIONS.find(o => o.value === idea.format)?.label || idea.format}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {(idea.tags && idea.tags.length > 0)
                            ? idea.tags.map(t => (
                                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                              ))
                            : '—'}
                        </div>
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>

      {/* Dialog: Nova/Editar Vista */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingView ? 'Editar vista' : 'Nova vista'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={viewForm.name} onChange={e => setViewForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex.: Reels Instagram" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={viewForm.category} onValueChange={v => setViewForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDEA_CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal (opcional)</Label>
              <Select value={viewForm.filter_channel} onValueChange={v => setViewForm(p => ({ ...p, filter_channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Todos —</SelectItem>
                  {activeChannels.map(ch => <SelectItem key={ch.id} value={ch.name}>{ch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Conteúdo (opcional)</Label>
              <Select value={viewForm.filter_content_type} onValueChange={v => setViewForm(p => ({ ...p, filter_content_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Todos —</SelectItem>
                  {CONTENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato (opcional)</Label>
              <Select value={viewForm.filter_format} onValueChange={v => setViewForm(p => ({ ...p, filter_format: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Todos —</SelectItem>
                  {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowViewDialog(false)}>Cancelar</Button>
              <Button onClick={saveView} disabled={!viewForm.name.trim()}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Ideia */}
      <Dialog open={showNewIdea} onOpenChange={setShowNewIdea}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Ideia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ideia *</Label>
              <Textarea value={newIdea.idea} onChange={e => setNewIdea(p => ({ ...p, idea: e.target.value }))} placeholder="Título ou ideia em poucas linhas..." rows={3} className="resize-y" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={newIdea.description} onChange={e => setNewIdea(p => ({ ...p, description: e.target.value }))} placeholder="Detalhes, contexto, referências..." rows={6} className="resize-y" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={newIdea.channel} onValueChange={v => setNewIdea(p => ({ ...p, channel: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar canal" /></SelectTrigger>
                <SelectContent>
                  {activeChannels.map(ch => (
                    <SelectItem key={ch.id} value={ch.name}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Conteúdo</Label>
              <Select value={newIdea.content_type} onValueChange={v => setNewIdea(p => ({ ...p, content_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato Ideal</Label>
              <Select value={newIdea.format} onValueChange={v => setNewIdea(p => ({ ...p, format: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newIdea.category} onValueChange={v => setNewIdea(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDEA_CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newIdea.idea.trim()} onClick={createIdea}>Adicionar Ideia</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver/Editar Ideia */}
      <Dialog open={!!editingIdea} onOpenChange={(o) => !o && setEditingIdea(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ideia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ideia *</Label>
              <Textarea value={editIdeaForm.idea} onChange={e => setEditIdeaForm(p => ({ ...p, idea: e.target.value }))} rows={3} className="resize-y" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editIdeaForm.description} onChange={e => setEditIdeaForm(p => ({ ...p, description: e.target.value }))} rows={8} className="resize-y" placeholder="Detalhes, contexto, referências..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select value={editIdeaForm.channel} onValueChange={v => setEditIdeaForm(p => ({ ...p, channel: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {activeChannels.map(ch => <SelectItem key={ch.id} value={ch.name}>{ch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editIdeaForm.category} onValueChange={v => setEditIdeaForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IDEA_CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Conteúdo</Label>
                <Select value={editIdeaForm.content_type} onValueChange={v => setEditIdeaForm(p => ({ ...p, content_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Formato</Label>
                <Select value={editIdeaForm.format} onValueChange={v => setEditIdeaForm(p => ({ ...p, format: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              {isOwner && editingIdea && (
                <Button variant="ghost" className="text-destructive" onClick={() => { deleteIdea(editingIdea.id); setEditingIdea(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" />Eliminar
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" onClick={() => setEditingIdea(null)}>Cancelar</Button>
                <Button onClick={saveIdea} disabled={!editIdeaForm.idea.trim()}>Guardar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
