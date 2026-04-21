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
  Image as ImageIcon, Palette, Link2, Lightbulb,
} from 'lucide-react';
import { CONTENT_TYPE_OPTIONS, FORMAT_OPTIONS, type MarketingChannel } from '@/lib/marketing-constants';
import { BackNavigation } from '@/components/BackNavigation';

const IDEA_CATEGORIES = [
  { value: 'todas', label: 'Todas' },
  { value: 'publicacoes', label: 'Publicações' },
  { value: 'stories', label: 'Stories' },
  { value: 'caixa_perguntas', label: 'Caixa de Perguntas' },
];

type ResourceLink = { id: string; category: string; label: string; url: string; sort_order: number };
type Idea = { id: string; idea: string; channel: string | null; content_type: string | null; format: string | null; category: string; created_by: string | null };

export default function MarketingRecursos() {
  const navigate = useNavigate();
  const { isOwner, user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('todas');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdea, setNewIdea] = useState({ idea: '', channel: '', content_type: '', format: '', category: 'todas' });

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
    await supabase.from('marketing_resource_links').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
  };

  const updateUtilUrl = async (id: string, url: string) => {
    await supabase.from('marketing_resource_links').update({ url } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-resource-links'] });
    setEditingLink(null);
  };

  // ---- Ideas ----
  const createIdea = async () => {
    if (!newIdea.idea.trim()) return;
    await supabase.from('marketing_ideas').insert({
      idea: newIdea.idea,
      channel: newIdea.channel || null,
      content_type: newIdea.content_type || null,
      format: newIdea.format || null,
      category: activeTab === 'todas' ? 'todas' : activeTab,
      created_by: user?.id,
    } as any);
    qc.invalidateQueries({ queryKey: ['marketing-ideas'] });
    setShowNewIdea(false);
    setNewIdea({ idea: '', channel: '', content_type: '', format: '', category: 'todas' });
    toast.success('Ideia adicionada');
  };

  const deleteIdea = async (id: string) => {
    await supabase.from('marketing_ideas').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['marketing-ideas'] });
  };

  const filteredIdeas = activeTab === 'todas' ? ideas : ideas.filter(i => i.category === activeTab);

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
              <a href={link.url} target="_blank" rel="noopener noreferrer"
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
                <div className="space-y-1.5">
                  {uteis.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum link adicionado.</p>
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
                            <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">{u.label}</a>
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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                {IDEA_CATEGORIES.map(c => (
                  <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
                ))}
              </TabsList>

              {IDEA_CATEGORIES.map(cat => (
                <TabsContent key={cat.value} value={cat.value}>
                  {filteredIdeas.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma ideia nesta vista.</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ideia</TableHead>
                            <TableHead className="w-32">Canal</TableHead>
                            <TableHead className="w-36">Tipo de Conteúdo</TableHead>
                            <TableHead className="w-32">Formato</TableHead>
                            {isOwner && <TableHead className="w-10" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredIdeas.map(idea => (
                            <TableRow key={idea.id}>
                              <TableCell className="font-medium">{idea.idea}</TableCell>
                              <TableCell>
                                {idea.channel && <Badge variant="secondary" className="text-xs">{idea.channel}</Badge>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {CONTENT_TYPE_OPTIONS.find(o => o.value === idea.content_type)?.label || idea.content_type}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {FORMAT_OPTIONS.find(o => o.value === idea.format)?.label || idea.format}
                              </TableCell>
                              {isOwner && (
                                <TableCell>
                                  <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => deleteIdea(idea.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>
        </div>
      </div>

      {/* Dialog: Nova Ideia */}
      <Dialog open={showNewIdea} onOpenChange={setShowNewIdea}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Ideia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ideia *</Label>
              <Input value={newIdea.idea} onChange={e => setNewIdea(p => ({ ...p, idea: e.target.value }))} placeholder="Descreve a tua ideia..." />
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
              <Label>Vista</Label>
              <Select value={newIdea.category} onValueChange={v => setNewIdea(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDEA_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newIdea.idea.trim()} onClick={createIdea}>Adicionar Ideia</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
