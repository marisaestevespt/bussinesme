import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Check, X, Plus, ExternalLink, FolderOpen, Zap,
  Trash2, Upload, FileText, Image as ImageIcon, ChevronLeft,
} from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';

// ── Types ──

interface BrandCompetitor {
  id: string;
  name: string;
  type: string;
  instagram: string | null;
  website: string | null;
  produtos: string | null;
  precos: string | null;
  plataformas: string | null;
  posicionamento: string | null;
  comunicacao: string | null;
  sort_order: number;
}

interface BrandLink {
  id: string;
  type: string;
  label: string;
  url: string;
  sort_order: number;
}

interface KanbanItem {
  id: string;
  group_key: string;
  title: string;
  content: string | null;
  sort_order: number;
}

interface VisualCard {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
}

interface VisualFile {
  id: string;
  card_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

// ── Constants ──

const KANBAN_GROUPS = [
  { key: 'marca_pessoal', label: 'Marca Pessoal', headerBg: 'bg-[hsl(351,30%,94%)] dark:bg-[hsl(351,30%,15%)]', headerText: 'text-[hsl(351,40%,45%)] dark:text-[hsl(351,40%,65%)]', dotBg: '', addColor: 'text-[hsl(351,35%,55%)]' },
  { key: 'mercado', label: 'Mercado', headerBg: 'bg-[hsl(25,35%,93%)] dark:bg-[hsl(25,30%,15%)]', headerText: 'text-[hsl(25,50%,45%)] dark:text-[hsl(25,50%,65%)]', dotBg: '', addColor: 'text-[hsl(25,45%,55%)]' },
  { key: 'posicionamento', label: 'Posicionamento', headerBg: 'bg-[hsl(33,30%,92%)] dark:bg-[hsl(33,25%,15%)]', headerText: 'text-[hsl(33,40%,42%)] dark:text-[hsl(33,40%,62%)]', dotBg: '', addColor: 'text-[hsl(33,35%,52%)]' },
  { key: 'identidade', label: 'Identidade', headerBg: 'bg-[hsl(10,35%,93%)] dark:bg-[hsl(10,30%,15%)]', headerText: 'text-[hsl(10,45%,48%)] dark:text-[hsl(10,45%,65%)]', dotBg: '', addColor: 'text-[hsl(10,40%,55%)]' },
  { key: 'impacto', label: 'Impacto', headerBg: 'bg-[hsl(18,30%,92%)] dark:bg-[hsl(18,25%,15%)]', headerText: 'text-[hsl(18,40%,44%)] dark:text-[hsl(18,40%,64%)]', dotBg: '', addColor: 'text-[hsl(18,35%,54%)]' },
];

// ── Page ──

export default function GestaoMarcaPage() {
  const navigate = useNavigate();
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  // Proposta única de valor
  const [editingPuv, setEditingPuv] = useState(false);
  const [tempPuv, setTempPuv] = useState('');

  // Links
  const [showAddLink, setShowAddLink] = useState<'folder' | 'shortcut' | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Kanban detail
  const [selectedKanban, setSelectedKanban] = useState<KanbanItem | null>(null);
  const [kanbanContent, setKanbanContent] = useState('');

  // Add kanban item
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  // Visual card detail
  const [selectedVisual, setSelectedVisual] = useState<VisualCard | null>(null);
  const [visualDesc, setVisualDesc] = useState('');
  const [editingVisualDesc, setEditingVisualDesc] = useState(false);
  const [uploadingVisual, setUploadingVisual] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showAddVisualCard, setShowAddVisualCard] = useState(false);
  const [newVisualTitle, setNewVisualTitle] = useState('');
  const [addingVisualLink, setAddingVisualLink] = useState(false);
  const [visualLinkLabel, setVisualLinkLabel] = useState('');
  const [visualLinkUrl, setVisualLinkUrl] = useState('');

  // Competitors
  const [editingCompetitor, setEditingCompetitor] = useState<BrandCompetitor | null>(null);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [compForm, setCompForm] = useState({ name: '', type: 'direta', instagram: '', website: '', produtos: '', precos: '', plataformas: '', posicionamento: '', comunicacao: '' });

  // SWOT
  const [newSwot, setNewSwot] = useState<{ quadrant: string; text: string } | null>(null);

  // Diferenciais
  const [newDifferential, setNewDifferential] = useState('');

  // ── Queries ──

  const { data: brandLinks = [] } = useQuery({
    queryKey: ['brand-links'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_links').select('*').order('sort_order') as { data: BrandLink[] | null };
      return data || [];
    },
  });

  const { data: kanbanItems = [] } = useQuery({
    queryKey: ['brand-kanban-items'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_kanban_items').select('*').order('sort_order') as { data: KanbanItem[] | null };
      return data || [];
    },
  });

  const { data: visualCards = [] } = useQuery({
    queryKey: ['brand-visual-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_visual_cards').select('*').order('sort_order') as { data: VisualCard[] | null };
      return data || [];
    },
  });

  const { data: visualFiles = [] } = useQuery({
    queryKey: ['brand-visual-files', selectedVisual?.id],
    enabled: !!selectedVisual,
    queryFn: async () => {
      const { data } = await supabase.from('brand_visual_files').select('*').eq('card_id', selectedVisual!.id).order('created_at') as { data: VisualFile[] | null };
      return data || [];
    },
  });

  const { data: competitors = [] } = useQuery({
    queryKey: ['brand-competitors'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_competitors').select('*').order('sort_order') as { data: BrandCompetitor[] | null };
      return data || [];
    },
  });

  const { data: swotItems = [] } = useQuery({
    queryKey: ['brand-swot'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_swot_items').select('*').order('sort_order') as { data: { id: string; quadrant: string; content: string; sort_order: number }[] | null };
      return data || [];
    },
  });

  const { data: differentials = [] } = useQuery({
    queryKey: ['brand-differentials'],
    queryFn: async () => {
      const { data } = await supabase.from('brand_differentials').select('*').order('sort_order') as { data: { id: string; content: string; sort_order: number }[] | null };
      return data || [];
    },
  });

  const folders = brandLinks.filter(l => l.type === 'folder');
  const shortcuts = brandLinks.filter(l => l.type === 'shortcut');

  // ── PUV ──

  const puv = (settings as any)?.proposta_unica_valor || '';

  const savePuv = async () => {
    if (!settings) return;
    const { error } = await supabase.from('business_settings').update({ proposta_unica_valor: tempPuv } as any).eq('id', settings.id);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); refetchSettings(); setEditingPuv(false); }
  };

  // ── Links mutations ──

  const addLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim() || !showAddLink) return;
    const { error } = await supabase.from('brand_links').insert({ type: showAddLink, label: linkLabel, url: linkUrl, sort_order: brandLinks.length } as any);
    if (error) toast.error('Erro ao adicionar');
    else { toast.success('Link adicionado'); queryClient.invalidateQueries({ queryKey: ['brand-links'] }); }
    setShowAddLink(null);
    setLinkLabel('');
    setLinkUrl('');
  };

  const deleteLink = async (id: string) => {
    await supabase.from('brand_links').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-links'] });
  };

  // ── Kanban mutations ──

  const saveKanbanContent = async () => {
    if (!selectedKanban) return;
    const { error } = await supabase.from('brand_kanban_items').update({ content: kanbanContent } as any).eq('id', selectedKanban.id);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] }); }
  };

  const addKanbanItem = async () => {
    if (!newItemTitle.trim() || !addingToGroup) return;
    const groupItems = kanbanItems.filter(i => i.group_key === addingToGroup);
    const { error } = await supabase.from('brand_kanban_items').insert({
      group_key: addingToGroup,
      title: newItemTitle,
      sort_order: groupItems.length,
    } as any);
    if (error) toast.error('Erro ao adicionar');
    else { toast.success('Item adicionado'); queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] }); }
    setAddingToGroup(null);
    setNewItemTitle('');
  };

  const deleteKanbanItem = async (id: string) => {
    await supabase.from('brand_kanban_items').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] });
    toast.success('Item removido');
  };

  // ── Visual card mutations ──

  const saveVisualDesc = async () => {
    if (!selectedVisual) return;
    const { error } = await supabase.from('brand_visual_cards').update({ description: visualDesc } as any).eq('id', selectedVisual.id);
    if (error) toast.error('Erro ao guardar');
    else {
      toast.success('Guardado');
      queryClient.invalidateQueries({ queryKey: ['brand-visual-cards'] });
      setSelectedVisual(prev => prev ? { ...prev, description: visualDesc } : null);
      setEditingVisualDesc(false);
    }
  };

  const uploadVisualFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    if (!e.target.files?.length || !selectedVisual) return;
    setUploadingVisual(true);
    const files = Array.from(e.target.files);
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `visual/${selectedVisual.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('brand-files').upload(path, file);
      if (uploadError) { toast.error(`Erro ao carregar ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('brand-files').getPublicUrl(path);
      await supabase.from('brand_visual_files').insert({
        card_id: selectedVisual.id,
        file_url: publicUrl,
        file_name: file.name,
        file_type: type,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['brand-visual-files', selectedVisual.id] });
    setUploadingVisual(false);
    toast.success('Ficheiro(s) carregado(s)');
    e.target.value = '';
  };

  const uploadVisualCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedVisual) return;
    setUploadingVisual(true);
    const file = e.target.files[0];
    const path = `covers/${selectedVisual.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('brand-files').upload(path, file);
    if (uploadError) { toast.error('Erro ao carregar capa'); setUploadingVisual(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('brand-files').getPublicUrl(path);
    await supabase.from('brand_visual_cards').update({ cover_url: publicUrl } as any).eq('id', selectedVisual.id);
    setSelectedVisual(prev => prev ? { ...prev, cover_url: publicUrl } : null);
    queryClient.invalidateQueries({ queryKey: ['brand-visual-cards'] });
    setUploadingVisual(false);
    toast.success('Capa atualizada');
    e.target.value = '';
  };

  // ── Logo upload ──
  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !settings) return;
    setUploadingLogo(true);
    const file = e.target.files[0];
    const path = `logos/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file);
    if (uploadError) { toast.error('Erro ao carregar logo'); setUploadingLogo(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    await supabase.from('business_settings').update({ logo_url: publicUrl } as any).eq('id', settings.id);
    refetchSettings();
    setUploadingLogo(false);
    toast.success('Logo atualizado');
    e.target.value = '';
  };

  // ── Add visual card ──
  const addVisualCard = async () => {
    if (!newVisualTitle.trim()) return;
    await supabase.from('brand_visual_cards').insert({ title: newVisualTitle, sort_order: visualCards.length } as any);
    queryClient.invalidateQueries({ queryKey: ['brand-visual-cards'] });
    setNewVisualTitle('');
    setShowAddVisualCard(false);
    toast.success('Categoria adicionada');
  };

  const deleteVisualCard = async (id: string) => {
    await supabase.from('brand_visual_files').delete().eq('card_id', id);
    await supabase.from('brand_visual_cards').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-visual-cards'] });
    toast.success('Categoria removida');
  };

  const deleteVisualFile = async (fileId: string) => {
    await supabase.from('brand_visual_files').delete().eq('id', fileId);
    queryClient.invalidateQueries({ queryKey: ['brand-visual-files', selectedVisual?.id] });
    toast.success('Ficheiro removido');
  };

  const addVisualLink = async () => {
    if (!visualLinkLabel.trim() || !visualLinkUrl.trim() || !selectedVisual) return;
    await supabase.from('brand_visual_files').insert({
      card_id: selectedVisual.id,
      file_url: visualLinkUrl,
      file_name: visualLinkLabel,
      file_type: 'link',
    } as any);
    queryClient.invalidateQueries({ queryKey: ['brand-visual-files', selectedVisual.id] });
    setVisualLinkLabel('');
    setVisualLinkUrl('');
    setAddingVisualLink(false);
    toast.success('Link adicionado');
  };
  };

  // ── Competitor mutations ──

  const resetCompForm = () => setCompForm({ name: '', type: 'direta', instagram: '', website: '', produtos: '', precos: '', plataformas: '', posicionamento: '', comunicacao: '' });

  const saveCompetitor = async () => {
    if (!compForm.name.trim()) return;
    if (editingCompetitor) {
      await supabase.from('brand_competitors').update({
        name: compForm.name, type: compForm.type,
        instagram: compForm.instagram || null, website: compForm.website || null,
        produtos: compForm.produtos || null, precos: compForm.precos || null,
        plataformas: compForm.plataformas || null, posicionamento: compForm.posicionamento || null,
        comunicacao: compForm.comunicacao || null,
      } as any).eq('id', editingCompetitor.id);
    } else {
      await supabase.from('brand_competitors').insert({
        ...compForm, sort_order: competitors.length,
        instagram: compForm.instagram || null, website: compForm.website || null,
        produtos: compForm.produtos || null, precos: compForm.precos || null,
        plataformas: compForm.plataformas || null, posicionamento: compForm.posicionamento || null,
        comunicacao: compForm.comunicacao || null,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['brand-competitors'] });
    toast.success(editingCompetitor ? 'Atualizado' : 'Adicionado');
    setEditingCompetitor(null);
    setShowAddCompetitor(false);
    resetCompForm();
  };

  const deleteCompetitor = async (id: string) => {
    await supabase.from('brand_competitors').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-competitors'] });
    toast.success('Concorrente removido');
  };

  const openEditCompetitor = (c: BrandCompetitor) => {
    setCompForm({
      name: c.name, type: c.type,
      instagram: c.instagram || '', website: c.website || '',
      produtos: c.produtos || '', precos: c.precos || '',
      plataformas: c.plataformas || '', posicionamento: c.posicionamento || '',
      comunicacao: c.comunicacao || '',
    });
    setEditingCompetitor(c);
    setShowAddCompetitor(true);
  };

  // ── SWOT mutations ──

  const addSwotItem = async (quadrant: string, content: string) => {
    if (!content.trim()) return;
    const quadrantItems = swotItems.filter(i => i.quadrant === quadrant);
    await supabase.from('brand_swot_items').insert({ quadrant, content, sort_order: quadrantItems.length } as any);
    queryClient.invalidateQueries({ queryKey: ['brand-swot'] });
    setNewSwot(null);
  };

  const deleteSwotItem = async (id: string) => {
    await supabase.from('brand_swot_items').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-swot'] });
  };

  // ── Differential mutations ──

  const addDifferential = async () => {
    if (!newDifferential.trim()) return;
    await supabase.from('brand_differentials').insert({ content: newDifferential, sort_order: differentials.length } as any);
    queryClient.invalidateQueries({ queryKey: ['brand-differentials'] });
    setNewDifferential('');
  };

  const deleteDifferential = async (id: string) => {
    await supabase.from('brand_differentials').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['brand-differentials'] });
  };

  // ── Render ──

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader title="Gestão de Marca" subtitle="Marketing e Branding" />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* ── Brand Card ── */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {isOwner ? (
                  <label className="cursor-pointer group relative">
                    {settings?.logo_url ? (
                      <img src={settings.logo_url} alt={settings.business_name} className="h-20 w-20 rounded-xl object-contain border bg-muted/30 p-2 shrink-0 group-hover:opacity-70 transition-opacity" />
                    ) : (
                      <div className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:bg-muted/40 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-background/60">
                      <Upload className="h-4 w-4 text-foreground" />
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={uploadingLogo} />
                  </label>
                ) : settings?.logo_url ? (
                  <img src={settings.logo_url} alt={settings.business_name} className="h-20 w-20 rounded-xl object-contain border bg-muted/30 p-2 shrink-0" />
                ) : null}
                <div className="flex-1 space-y-3">
                  <h2 className="text-2xl font-bold text-foreground">{settings?.business_name || 'Negócio'}</h2>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Proposta Única de Valor</p>
                      {isOwner && !editingPuv && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTempPuv(puv); setEditingPuv(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {editingPuv ? (
                      <div className="space-y-2">
                        <Textarea value={tempPuv} onChange={e => setTempPuv(e.target.value)} rows={3} placeholder="Descreve a proposta única de valor do teu negócio..." />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={savePuv}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPuv(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {puv || <span className="italic">Ainda não definida.</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Folders & Shortcuts ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pastas */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Pastas</h3>
                  </div>
                  {isOwner && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowAddLink('folder')}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                    </Button>
                  )}
                </div>
                {folders.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma pasta adicionada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {folders.map(link => (
                      <div key={link.id} className="flex items-center gap-2 group">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {link.label}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteLink(link.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Atalhos */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Atalhos</h3>
                  </div>
                  {isOwner && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowAddLink('shortcut')}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                    </Button>
                  )}
                </div>
                {shortcuts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum atalho adicionado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {shortcuts.map(link => (
                      <div key={link.id} className="flex items-center gap-2 group">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {link.label}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteLink(link.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* ── Branding e Primal Branding ── */}
          <section className="space-y-5">
            <h2 className="text-xl font-semibold text-foreground">Branding & Primal Branding</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {KANBAN_GROUPS.map(group => {
                const items = kanbanItems.filter(i => i.group_key === group.key);
                return (
                  <div key={group.key} className="space-y-0 shadow-md rounded-lg overflow-hidden">
                    {/* Notion-style colored header */}
                    <div className={cn('flex items-center justify-between px-3 py-3', group.headerBg)}>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs font-semibold', group.headerText)}>// {group.label}</span>
                      </div>
                      <span className={cn('text-xs font-semibold', group.headerText)}>{items.length}</span>
                    </div>
                    {/* Items list */}
                    <div className="space-y-0 bg-muted/5 border-x border-b rounded-b-lg">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 px-3 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-muted/40 transition-colors group"
                          onClick={() => { setSelectedKanban(item); setKanbanContent(item.content || ''); }}
                        >
                          <span className="text-base leading-none">📄</span>
                          <span className="text-sm text-foreground flex-1 truncate">{item.title}</span>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={(e) => { e.stopPropagation(); deleteKanbanItem(item.id); }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {isOwner && (
                        addingToGroup === group.key ? (
                          <div className="p-2 space-y-1.5">
                            <Input
                              value={newItemTitle}
                              onChange={e => setNewItemTitle(e.target.value)}
                              placeholder="Nome do item..."
                              className="h-8 text-xs"
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && addKanbanItem()}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 text-xs" onClick={addKanbanItem}>
                                <Check className="h-3 w-3 mr-1" />Adicionar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingToGroup(null); setNewItemTitle(''); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className={cn('w-full text-left px-3 py-4 text-sm hover:bg-muted/30 transition-colors', group.addColor)}
                            onClick={() => setAddingToGroup(group.key)}
                          >
                            + New page
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>


          <Separator />

          {/* ── Identidade Visual ── */}
          <section className="space-y-6 pb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Identidade Visual</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setShowAddVisualCard(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Nova Categoria
                </Button>
              )}
            </div>

            {visualCards.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-3">
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Nenhuma categoria criada</p>
                    <p className="text-xs text-muted-foreground mt-1">Cria categorias como "Logótipo", "Paleta de Cores", "Tipografia", "Mockups" para organizar a identidade visual.</p>
                  </div>
                  {isOwner && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddVisualCard(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Criar primeira categoria
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {visualCards.map(card => (
                  <Card
                    key={card.id}
                    className="cursor-pointer hq-transition hover:shadow-md hover:-translate-y-0.5 overflow-hidden group relative"
                    onClick={() => { setSelectedVisual(card); setVisualDesc(card.description || ''); setEditingVisualDesc(false); }}
                  >
                    <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden">
                      {card.cover_url ? (
                        <img src={card.cover_url} alt={card.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground text-center">{card.title}</p>
                    </CardContent>
                    {isOwner && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); deleteVisualCard(card.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Add Link Dialog ── */}
      <Dialog open={!!showAddLink} onOpenChange={open => { if (!open) setShowAddLink(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar {showAddLink === 'folder' ? 'Pasta' : 'Atalho'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Ex: Google Drive" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">URL</label>
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button className="w-full" disabled={!linkLabel.trim() || !linkUrl.trim()} onClick={addLink}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Kanban Item Detail Dialog ── */}
      <Dialog open={!!selectedKanban} onOpenChange={open => { if (!open) setSelectedKanban(null); }}>
        <DialogContent className={cn(
          'max-h-[90vh] overflow-y-auto',
          selectedKanban?.title?.includes('Concorrência') ? 'sm:max-w-5xl' : 'sm:max-w-3xl'
        )}>
          <DialogHeader>
            <DialogTitle>{selectedKanban?.title}</DialogTitle>
          </DialogHeader>
          {selectedKanban && selectedKanban.title?.includes('Como ser e não ser vista') ? (
            /* ── Como ser / não ser vista ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'como_ser', label: 'Como ser vista', emoji: '✅', colorClass: 'border-l-4 border-l-green-500' },
                { key: 'como_nao_ser', label: 'Como não ser vista', emoji: '🚫', colorClass: 'border-l-4 border-l-red-500' },
              ].map(q => {
                const items = swotItems.filter(i => i.quadrant === q.key);
                return (
                  <Card key={q.key} className={cn('overflow-hidden', q.colorClass)}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{q.emoji} {q.label}</h3>
                        {isOwner && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setNewSwot({ quadrant: q.key, text: '' })}>
                            <Plus className="h-3 w-3 mr-1" />Adicionar
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-2 group text-sm text-muted-foreground">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                            <span className="flex-1">{item.content}</span>
                            {isOwner && (
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteSwotItem(item.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Nenhum item.</p>}
                      </div>
                      {newSwot?.quadrant === q.key && (
                        <div className="flex gap-2">
                          <Input value={newSwot.text} onChange={e => setNewSwot({ ...newSwot, text: e.target.value })}
                            placeholder={`Adicionar...`} className="h-8 text-xs" autoFocus
                            onKeyDown={e => e.key === 'Enter' && addSwotItem(q.key, newSwot.text)} />
                          <Button size="sm" className="h-8" onClick={() => addSwotItem(q.key, newSwot.text)}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setNewSwot(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : selectedKanban && selectedKanban.title?.includes('Análise SWOT') ? (
            /* ── SWOT content ── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'forcas', label: 'Forças', emoji: '💪', colorClass: 'border-l-4 border-l-green-500' },
                  { key: 'fraquezas', label: 'Fraquezas', emoji: '⚠️', colorClass: 'border-l-4 border-l-red-500' },
                  { key: 'oportunidades', label: 'Oportunidades', emoji: '🚀', colorClass: 'border-l-4 border-l-blue-500' },
                  { key: 'ameacas', label: 'Ameaças', emoji: '🔥', colorClass: 'border-l-4 border-l-amber-500' },
                ].map(q => {
                  const items = swotItems.filter(i => i.quadrant === q.key);
                  return (
                    <Card key={q.key} className={cn('overflow-hidden', q.colorClass)}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">{q.emoji} {q.label}</h3>
                          {isOwner && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setNewSwot({ quadrant: q.key, text: '' })}>
                              <Plus className="h-3 w-3 mr-1" />Adicionar
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {items.map(item => (
                            <div key={item.id} className="flex items-start gap-2 group text-sm text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                              <span className="flex-1">{item.content}</span>
                              {isOwner && (
                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteSwotItem(item.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {items.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Nenhum item.</p>}
                        </div>
                        {newSwot?.quadrant === q.key && (
                          <div className="flex gap-2">
                            <Input value={newSwot.text} onChange={e => setNewSwot({ ...newSwot, text: e.target.value })}
                              placeholder={`Adicionar ${q.label.toLowerCase()}...`} className="h-8 text-xs" autoFocus
                              onKeyDown={e => e.key === 'Enter' && addSwotItem(q.key, newSwot.text)} />
                            <Button size="sm" className="h-8" onClick={() => addSwotItem(q.key, newSwot.text)}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setNewSwot(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : selectedKanban && selectedKanban.title?.includes('Diferenciais') ? (
            /* ── Diferenciais content ── */
            <div className="space-y-3">
              {differentials.map(d => (
                <div key={d.id} className="flex items-center gap-3 group p-3 rounded-lg border bg-card hq-transition hover:shadow-sm">
                  <span className="text-primary">✦</span>
                  <span className="flex-1 text-sm text-foreground">{d.content}</span>
                  {isOwner && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteDifferential(d.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {differentials.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum diferencial adicionado.</p>}
              {isOwner && (
                <div className="flex gap-2 mt-2">
                  <Input value={newDifferential} onChange={e => setNewDifferential(e.target.value)}
                    placeholder="Adicionar diferencial..." className="h-9"
                    onKeyDown={e => e.key === 'Enter' && addDifferential()} />
                  <Button size="sm" className="h-9" disabled={!newDifferential.trim()} onClick={addDifferential}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
              )}
            </div>
          ) : selectedKanban && selectedKanban.title?.includes('Concorrência') ? (
            /* ── Concorrência content ── */
            <div className="space-y-4">
              {isOwner && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { resetCompForm(); setEditingCompetitor(null); setShowAddCompetitor(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
              )}
              {competitors.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum concorrente adicionado.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Instagram</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Website</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Produtos</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Preços</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Plataformas</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Posicionamento</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Comunicação</th>
                        {isOwner && <th className="w-16" />}
                      </tr>
                    </thead>
                    <tbody>
                      {competitors.map(c => (
                        <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/30 hq-transition cursor-pointer" onClick={() => isOwner && openEditCompetitor(c)}>
                          <td className="p-3 font-medium text-foreground">{c.name}</td>
                          <td className="p-3">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              c.type === 'direta' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            )}>
                              {c.type === 'direta' ? 'Direta' : 'Indireta'}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">{c.instagram || '—'}</td>
                          <td className="p-3 text-muted-foreground max-w-[150px] truncate">{c.website || '—'}</td>
                          <td className="p-3 text-muted-foreground max-w-[150px] truncate">{c.produtos || '—'}</td>
                          <td className="p-3 text-muted-foreground">{c.precos || '—'}</td>
                          <td className="p-3 text-muted-foreground max-w-[120px] truncate">{c.plataformas || '—'}</td>
                          <td className="p-3 text-muted-foreground max-w-[150px] truncate">{c.posicionamento || '—'}</td>
                          <td className="p-3 text-muted-foreground max-w-[150px] truncate">{c.comunicacao || '—'}</td>
                          {isOwner && (
                            <td className="p-3">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteCompetitor(c.id); }}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : selectedKanban ? (
            /* ── Default rich text content ── */
            <div className="space-y-4">
              <RichTextEditor content={kanbanContent} onChange={setKanbanContent} editable={isOwner} />
              {isOwner && (
                <div className="flex justify-end">
                  <Button onClick={saveKanbanContent}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Visual Card Detail Dialog ── */}
      <Dialog open={!!selectedVisual} onOpenChange={open => { if (!open) setSelectedVisual(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVisual?.title}</DialogTitle>
          </DialogHeader>
          {selectedVisual && (
            <div className="space-y-6">
              {/* Cover */}
              <div className="aspect-video bg-muted/30 rounded-lg overflow-hidden relative group flex items-center justify-center">
                {selectedVisual.cover_url ? (
                  <img src={selectedVisual.cover_url} alt={selectedVisual.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-muted-foreground/40">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-xs">Sem capa</p>
                  </div>
                )}
                {isOwner && (
                  <label className="absolute bottom-3 right-3 bg-background/90 backdrop-blur rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-background hq-transition border shadow-sm">
                    <Upload className="h-3.5 w-3.5 inline mr-1" />Alterar capa
                    <input type="file" accept="image/*" className="hidden" onChange={uploadVisualCover} disabled={uploadingVisual} />
                  </label>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Descrição</p>
                  {isOwner && !editingVisualDesc && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingVisualDesc(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {editingVisualDesc ? (
                  <div className="space-y-2">
                    <RichTextEditor content={visualDesc} onChange={setVisualDesc} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveVisualDesc}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingVisualDesc(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none">
                    {selectedVisual.description ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedVisual.description) }} />
                    ) : (
                      <p className="italic">Sem descrição.</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Uploads */}
              {isOwner && (
                <div className="flex gap-2 flex-wrap">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span><ImageIcon className="h-3.5 w-3.5 mr-1" />Carregar imagens</span>
                    </Button>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => uploadVisualFile(e, 'image')} disabled={uploadingVisual} />
                  </label>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span><FileText className="h-3.5 w-3.5 mr-1" />Carregar ficheiros</span>
                    </Button>
                    <input type="file" multiple className="hidden" onChange={e => uploadVisualFile(e, 'file')} disabled={uploadingVisual} />
                  </label>
                  <Button variant="outline" size="sm" onClick={() => setAddingVisualLink(true)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />Adicionar link
                  </Button>
                </div>
              )}

              {/* Image grid */}
              {visualFiles.filter(f => f.file_type === 'image').length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Imagens</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {visualFiles.filter(f => f.file_type === 'image').map(file => (
                      <div key={file.id} className="relative group rounded-lg overflow-hidden border">
                        <img src={file.file_url} alt={file.file_name} className="w-full aspect-square object-cover" />
                        {isOwner && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteVisualFile(file.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        <p className="text-[10px] text-muted-foreground p-1.5 truncate">{file.file_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files list */}
              {visualFiles.filter(f => f.file_type === 'file').length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ficheiros</p>
                  <div className="space-y-1.5">
                    {visualFiles.filter(f => f.file_type === 'file').map(file => (
                      <div key={file.id} className="flex items-center gap-2 group">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {file.file_name}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteVisualFile(file.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add link form */}
              {addingVisualLink && isOwner && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input value={visualLinkLabel} onChange={e => setVisualLinkLabel(e.target.value)} placeholder="Ex: Google Drive, Canva..." className="h-8 text-sm" autoFocus />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">URL</label>
                    <Input value={visualLinkUrl} onChange={e => setVisualLinkUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" onKeyDown={e => e.key === 'Enter' && addVisualLink()} />
                  </div>
                  <Button size="sm" className="h-8" disabled={!visualLinkLabel.trim() || !visualLinkUrl.trim()} onClick={addVisualLink}><Check className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingVisualLink(false); setVisualLinkLabel(''); setVisualLinkUrl(''); }}><X className="h-3 w-3" /></Button>
                </div>
              )}

              {/* Links */}
              {visualFiles.filter(f => f.file_type === 'link').length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Links</p>
                  <div className="space-y-1.5">
                    {visualFiles.filter(f => f.file_type === 'link').map(file => (
                      <div key={file.id} className="flex items-center gap-2 group">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {file.file_name}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteVisualFile(file.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visualFiles.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum ficheiro carregado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Competitor Dialog ── */}
      <Dialog open={showAddCompetitor} onOpenChange={open => { if (!open) { setShowAddCompetitor(false); setEditingCompetitor(null); resetCompForm(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompetitor ? 'Editar Concorrente' : 'Adicionar Concorrente'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nome *</label>
              <Input value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do concorrente" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Tipo</label>
              <Select value={compForm.type} onValueChange={v => setCompForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direta">Direta</SelectItem>
                  <SelectItem value="indireta">Indireta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Instagram</label>
              <Input value={compForm.instagram} onChange={e => setCompForm(f => ({ ...f, instagram: e.target.value }))} placeholder="@handle" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Website</label>
              <Input value={compForm.website} onChange={e => setCompForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground font-medium">Produtos</label>
              <Input value={compForm.produtos} onChange={e => setCompForm(f => ({ ...f, produtos: e.target.value }))} placeholder="Produtos principais" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Preços</label>
              <Input value={compForm.precos} onChange={e => setCompForm(f => ({ ...f, precos: e.target.value }))} placeholder="Faixa de preços" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Plataformas</label>
              <Input value={compForm.plataformas} onChange={e => setCompForm(f => ({ ...f, plataformas: e.target.value }))} placeholder="Instagram, TikTok..." />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground font-medium">Posicionamento</label>
              <Textarea value={compForm.posicionamento} onChange={e => setCompForm(f => ({ ...f, posicionamento: e.target.value }))} placeholder="Como se posicionam no mercado" rows={2} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground font-medium">Comunicação</label>
              <Textarea value={compForm.comunicacao} onChange={e => setCompForm(f => ({ ...f, comunicacao: e.target.value }))} placeholder="Estilo de comunicação" rows={2} />
            </div>
          </div>
          <Button className="w-full mt-2" disabled={!compForm.name.trim()} onClick={saveCompetitor}>
            <Check className="h-3.5 w-3.5 mr-1" />{editingCompetitor ? 'Guardar' : 'Adicionar'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Add Visual Card Dialog ── */}
      <Dialog open={showAddVisualCard} onOpenChange={open => { if (!open) { setShowAddVisualCard(false); setNewVisualTitle(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria Visual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome da categoria</label>
              <Input value={newVisualTitle} onChange={e => setNewVisualTitle(e.target.value)} placeholder="Ex: Logótipo, Paleta de Cores, Tipografia..." onKeyDown={e => e.key === 'Enter' && addVisualCard()} autoFocus />
            </div>
            <Button className="w-full" disabled={!newVisualTitle.trim()} onClick={addVisualCard}>
              <Plus className="h-3.5 w-3.5 mr-1" />Criar Categoria
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
