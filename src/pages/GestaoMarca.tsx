import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
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
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  closestCorners, useSensor, useSensors,
} from '@dnd-kit/core';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import {
  arrayMove,
} from '@dnd-kit/sortable';
import {
  Pencil, Check, X, Plus, ExternalLink, FolderOpen, Zap,
  Trash2, Upload, FileText, Image as ImageIcon,
  Target, Sparkles, BarChart3,
} from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { SortableKanbanItem } from '@/components/gestao-marca/SortableKanbanItem';
import { KanbanColumn } from '@/components/gestao-marca/KanbanColumn';
import { LogoFramer } from '@/components/gestao-marca/LogoFramer';
import type { KanbanItem } from '@/components/gestao-marca/types';
import { KanbanSectionsEditor } from '@/components/gestao-marca/KanbanSectionsEditor';
import { SingleLineEditor } from '@/components/gestao-marca/SingleLineEditor';
import { BulletListEditor } from '@/components/gestao-marca/BulletListEditor';
import { ArchetypesBoard } from '@/components/gestao-marca/ArchetypesBoard';
import { PersonalidadeUniversoBoard } from '@/components/gestao-marca/PersonalidadeUniversoBoard';
import { ContentPillarsBoard } from '@/components/gestao-marca/ContentPillarsBoard';
import { FolderSystemTable } from '@/components/gestao-marca/FolderSystemTable';

import type { BrandCompetitor, BrandLink, VisualCard, VisualFile } from '@/components/gestao-marca/types';
import { KANBAN_GROUPS, KANBAN_EMOJIS } from '@/components/gestao-marca/constants';
import { BrandIdentitySync } from '@/components/gestao-marca/BrandIdentitySync';
import { safeUrl } from '@/lib/url';


export default function GestaoMarcaPage() {
  const navigate = useNavigate();
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  // Proposta única de valor
  const [editingPuv, setEditingPuv] = useState(false);
  const [tempPuv, setTempPuv] = useState('');

  // About text
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempAbout, setTempAbout] = useState('');

  // Links
  const [showAddLink, setShowAddLink] = useState<'folder' | 'shortcut' | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Kanban detail
  const [selectedKanban, setSelectedKanban] = useState<KanbanItem | null>(null);
  const [kanbanContent, setKanbanContent] = useState('');
  const [editingKanban, setEditingKanban] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<KanbanItem | null>(null);

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
  const [showFolderSystem, setShowFolderSystem] = useState(false);

  // Competitors
  const [editingCompetitor, setEditingCompetitor] = useState<BrandCompetitor | null>(null);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [compForm, setCompForm] = useState({ name: '', type: 'direta', instagram: '', website: '', produtos: '', precos: '', plataformas: '', posicionamento: '', comunicacao: '' });

  // SWOT
  const [newSwot, setNewSwot] = useState<{ quadrant: string; text: string } | null>(null);

  // Diferenciais
  const [newDifferential, setNewDifferential] = useState('');

  // Reserved kanban titles (auto-created strategy pages — cannot be deleted)
  const RESERVED_KANBAN_TITLES = ['Análise SWOT', 'Análise Competitiva', 'Diferenciais'];

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
    if (error) toast.error('Não consegui guardar a identidade de marca. Tenta novamente.');
    else { toast.success('Guardado'); refetchSettings(); setEditingPuv(false); }
  };

  const aboutText = (settings as any)?.about_text || '';

  const saveAbout = async () => {
    if (!settings) return;
    const { error } = await supabase.from('business_settings').update({ about_text: tempAbout } as any).eq('id', settings.id);
    if (error) toast.error('Não consegui guardar a identidade de marca. Tenta novamente.');
    else { toast.success('Guardado'); refetchSettings(); setEditingAbout(false); }
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
    if (error) toast.error('Não consegui guardar a identidade de marca. Tenta novamente.');
    else {
      toast.success('Guardado');
      queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] });
      setSelectedKanban(prev => prev ? { ...prev, content: kanbanContent } : null);
      setEditingKanban(false);
    }
  };

  const updateKanbanEmoji = async (id: string, emoji: string) => {
    const { error } = await supabase.from('brand_kanban_items').update({ emoji } as any).eq('id', id);
    if (error) { toast.error('Erro ao alterar emoji'); return; }
    queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] });
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

  const handleKanbanDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    const activeItem = kanbanItems.find(i => i.id === active.id);
    if (!activeItem) return;

    // Determine target group: dropped on item or on empty column droppable
    const overId = String(over.id);
    const overItem = kanbanItems.find(i => i.id === overId);
    const targetGroup = overItem ? overItem.group_key : (overId.startsWith('col:') ? overId.slice(4) : null);
    if (!targetGroup) return;
    if (!KANBAN_GROUPS.find(g => g.key === targetGroup)) return;

    // Build new ordered list within target group
    const sameGroup = activeItem.group_key === targetGroup;
    const targetItems = kanbanItems.filter(i => i.group_key === targetGroup && i.id !== active.id);
    let newIndex = targetItems.length;
    if (overItem) {
      const idxInTarget = targetItems.findIndex(i => i.id === overItem.id);
      newIndex = idxInTarget === -1 ? targetItems.length : idxInTarget;
    }
    const reordered = [...targetItems];
    reordered.splice(newIndex, 0, { ...activeItem, group_key: targetGroup });

    // Optimistic update
    queryClient.setQueryData<KanbanItem[]>(['brand-kanban-items'], (prev) => {
      const others = (prev || []).filter(i => i.group_key !== targetGroup && (sameGroup ? true : i.id !== active.id));
      const updated = reordered.map((it, idx) => ({ ...it, sort_order: idx }));
      return [...others, ...updated];
    });

    // Persist: update target group order + (if moved) original group reindex
    const updates = reordered.map((it, idx) =>
      supabase.from('brand_kanban_items').update({ group_key: targetGroup, sort_order: idx } as any).eq('id', it.id)
    );
    if (!sameGroup) {
      const sourceItems = kanbanItems.filter(i => i.group_key === activeItem.group_key && i.id !== active.id);
      sourceItems.forEach((it, idx) => {
        updates.push(supabase.from('brand_kanban_items').update({ sort_order: idx } as any).eq('id', it.id));
      });
    }
    const results = await Promise.all(updates);
    if (results.some(r => r.error)) toast.error('Erro ao mover');
    queryClient.invalidateQueries({ queryKey: ['brand-kanban-items'] });
  };

  // ── Visual card mutations ──

  const saveVisualDesc = async () => {
    if (!selectedVisual) return;
    const { error } = await supabase.from('brand_visual_cards').update({ description: visualDesc } as any).eq('id', selectedVisual.id);
    if (error) toast.error('Não consegui guardar a identidade de marca. Tenta novamente.');
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
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-stretch">
                {/* Logo - fills full card height */}
                <div className="md:w-[260px] md:shrink-0 md:self-stretch">
                  {isOwner ? (
                    <LogoFramer
                      settings={settings}
                      uploadLogo={uploadLogo}
                      uploadingLogo={uploadingLogo}
                      refetchSettings={refetchSettings}
                      fill
                    />
                  ) : settings?.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={settings.business_name}
                      className="h-44 md:h-full w-full object-cover bg-muted/30"
                      style={{ objectPosition: `center ${(settings as any)?.logo_position_y ?? 50}%` }}
                    />
                  ) : null}
                </div>

                <div className="flex-1 space-y-4 min-w-0 p-5">
                  {/* Name */}
                  <h2 className="text-xl font-bold text-foreground">{settings?.business_name || 'Negócio'}</h2>

                  {/* PUV */}
                  <div className="group/puv">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Proposta Única de Valor</p>
                      {isOwner && !editingPuv && (
                        <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6 opacity-0 group-hover/puv:opacity-100 focus:opacity-100 transition-opacity" onClick={() => { setTempPuv(puv); setEditingPuv(true); }}>
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
                      <p className="text-base text-primary font-medium leading-relaxed">
                        {puv || <span className="italic text-muted-foreground font-normal">Ainda não definida.</span>}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-primary/20" />

                  {/* About / Texto de Apresentação */}
                  <div className="group/about">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Texto de Apresentação</p>
                      {isOwner && !editingAbout && (
                        <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6 opacity-0 group-hover/about:opacity-100 focus:opacity-100 transition-opacity" onClick={() => { setTempAbout(aboutText); setEditingAbout(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {editingAbout ? (
                      <div className="space-y-2">
                        <Textarea value={tempAbout} onChange={e => setTempAbout(e.target.value)} rows={5} placeholder="Escreve um texto de apresentação da marca..." />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveAbout}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingAbout(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-primary/90 leading-relaxed whitespace-pre-line">
                        {aboutText || <span className="italic text-muted-foreground">Ainda não definido.</span>}
                      </p>
                    )}
                  </div>

                </div>
              </div>
            </CardContent>
          </Card>

          {/* Missão / Visão / Valores — sync com Planeamento Estratégico */}
          <BrandIdentitySync settingsId={settings?.id} isOwner={isOwner} />

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
                  <EmptyHint>Nenhuma pasta adicionada.</EmptyHint>
                ) : (
                  <div className="space-y-2">
                    {folders.map(link => (
                      <div key={link.id} className="flex items-center gap-2 group">
                        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {link.label}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteLink(link.id)}>
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
                  <EmptyHint>Nenhum atalho adicionado.</EmptyHint>
                ) : (
                  <div className="space-y-2">
                    {shortcuts.map(link => (
                      <div key={link.id} className="flex items-center gap-2 group">
                        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {link.label}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteLink(link.id)}>
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
            <DndContext
              collisionDetection={closestCorners}
              onDragStart={(e: DragStartEvent) => {
                const it = kanbanItems.find(i => i.id === e.active.id);
                setActiveDragItem(it || null);
              }}
              onDragEnd={handleKanbanDragEnd}
              onDragCancel={() => setActiveDragItem(null)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {(() => {
                  const savedOrder: string[] = Array.isArray((settings as any)?.kanban_group_order) ? (settings as any).kanban_group_order : [];
                  const ordered = [
                    ...savedOrder.map(k => KANBAN_GROUPS.find(g => g.key === k)).filter(Boolean) as typeof KANBAN_GROUPS,
                    ...KANBAN_GROUPS.filter(g => !savedOrder.includes(g.key)),
                  ];
                  const moveColumn = async (key: string, dir: -1 | 1) => {
                    if (!settings) return;
                    const cur = ordered.map(g => g.key);
                    const idx = cur.indexOf(key);
                    const target = idx + dir;
                    if (idx < 0 || target < 0 || target >= cur.length) return;
                    [cur[idx], cur[target]] = [cur[target], cur[idx]];
                    const { error } = await supabase.from('business_settings').update({ kanban_group_order: cur } as any).eq('id', settings.id);
                    if (error) { toast.error('Erro ao reordenar'); return; }
                    refetchSettings();
                  };
                  return ordered.map((group, colIdx) => {
                    const items = [...kanbanItems.filter(i => i.group_key === group.key)].sort((a, b) => a.sort_order - b.sort_order);
                    const customLabel = ((settings as any)?.kanban_group_labels || {})[group.key] as string | undefined;
                    return (
                    <KanbanColumn
                      key={group.key}
                      group={{ ...group, label: customLabel?.trim() || group.label }}
                      items={items}
                      isOwner={isOwner}
                      reservedTitles={RESERVED_KANBAN_TITLES}
                      addingToGroup={addingToGroup}
                      newItemTitle={newItemTitle}
                      setNewItemTitle={setNewItemTitle}
                      setAddingToGroup={setAddingToGroup}
                      onAddItem={addKanbanItem}
                      onOpenItem={(item) => { setSelectedKanban(item); setKanbanContent(item.content || ''); setEditingKanban(false); }}
                      onDeleteItem={deleteKanbanItem}
                      onChangeEmoji={updateKanbanEmoji}
                      onRenameGroup={async (newLabel) => {
                        if (!settings) return;
                        const current = ((settings as any)?.kanban_group_labels || {}) as Record<string, string>;
                        const next = { ...current, [group.key]: newLabel };
                        const { error } = await supabase.from('business_settings').update({ kanban_group_labels: next } as any).eq('id', settings.id);
                        if (error) { toast.error('Erro ao renomear coluna'); return; }
                        toast.success('Coluna renomeada');
                        refetchSettings();
                      }}
                      canMoveLeft={colIdx > 0}
                      canMoveRight={colIdx < ordered.length - 1}
                      onMoveLeft={() => moveColumn(group.key, -1)}
                      onMoveRight={() => moveColumn(group.key, 1)}
                    />
                    );
                  });
                })()}
              </div>
              <DragOverlay>
                {activeDragItem ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-card border rounded-md shadow-lg">
                    <span className="text-base leading-none">{activeDragItem.emoji || '📄'}</span>
                    <span className="text-sm text-foreground">{activeDragItem.title}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </section>



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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visualCards.map(card => (
                  <Card
                    key={card.id}
                    className="cursor-pointer hq-transition hover:shadow-md hover:-translate-y-0.5 overflow-hidden group relative"
                    onClick={() => { setSelectedVisual(card); setVisualDesc(card.description || ''); setEditingVisualDesc(false); }}
                  >
                    <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                      {card.cover_url ? (
                        <img src={card.cover_url} alt={card.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium text-foreground text-center truncate">{card.title}</p>
                    </CardContent>
                    {isOwner && (
                      <Button
                        variant="destructive"
                        aria-label="Eliminar" size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); deleteVisualCard(card.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </Card>
                ))}
                <Card
                  className="cursor-pointer hq-transition hover:shadow-md hover:-translate-y-0.5 overflow-hidden group relative border-primary/30"
                  onClick={() => setShowFolderSystem(true)}
                >
                  <div className="aspect-square bg-primary/5 flex items-center justify-center overflow-hidden">
                    <FolderOpen className="h-8 w-8 text-primary/60" />
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium text-foreground text-center truncate">Sistema de Pastas</p>
                  </CardContent>
                </Card>
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

      {/* ── Sistema de Pastas Dialog ── */}
      <Dialog open={showFolderSystem} onOpenChange={setShowFolderSystem}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Sistema de Pastas
            </DialogTitle>
          </DialogHeader>
          <FolderSystemTable isOwner={isOwner} />
        </DialogContent>
      </Dialog>

      {/* ── Kanban Item Detail Dialog ── */}
      <Dialog open={!!selectedKanban} onOpenChange={open => { if (!open) setSelectedKanban(null); }}>
        <DialogContent className={cn(
          'max-h-[90vh] overflow-y-auto',
          selectedKanban?.title?.includes('Personalidade') || selectedKanban?.title?.includes('Universo')
            ? 'sm:max-w-[1200px] w-[95vw]'
            : selectedKanban?.title?.includes('Competitiva') || selectedKanban?.title?.includes('Concorrência')
              ? 'sm:max-w-5xl'
              : 'sm:max-w-3xl'
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
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-2 group text-sm text-muted-foreground">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                            <span className="flex-1">{item.content}</span>
                            {isOwner && (
                              <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteSwotItem(item.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {items.length === 0 && <EmptyHint>Nenhum item.</EmptyHint>}
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
                        <div className="space-y-2">
                          {items.map(item => (
                            <div key={item.id} className="flex items-start gap-2 group text-sm text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                              <span className="flex-1">{item.content}</span>
                              {isOwner && (
                                <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteSwotItem(item.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {items.length === 0 && <EmptyHint>Nenhum item.</EmptyHint>}
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
                    <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteDifferential(d.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {differentials.length === 0 && <EmptyHint>Nenhum diferencial adicionado.</EmptyHint>}
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
          ) : selectedKanban && (selectedKanban.title?.includes('Competitiva') || selectedKanban.title?.includes('Concorrência')) ? (
            /* ── Concorrência content ── */
            <div className="space-y-4">
              {isOwner && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { resetCompForm(); setEditingCompetitor(null); setShowAddCompetitor(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
              )}
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
                      {competitors.length === 0 ? (
                        <tr>
                          <td colSpan={isOwner ? 10 : 9} className="p-6 text-center text-sm text-muted-foreground italic">
                            Nenhum concorrente adicionado.
                          </td>
                        </tr>
                      ) : competitors.map(c => (
                        <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/30 hq-transition cursor-pointer" onClick={() => isOwner && openEditCompetitor(c)}>
                          <td className="p-3 font-medium text-foreground">{c.name}</td>
                          <td className="p-3">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              c.type === 'direta' ? 'bg-destructive/15 text-destructive dark:bg-destructive/20 dark:text-destructive' : 'bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning'
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
                              <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteCompetitor(c.id); }}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            </div>
          ) : selectedKanban ? (
            /* ── Default: sections editor (or special link for Público Alvo) ── */
            <div className="space-y-4">
              {selectedKanban.title?.includes('Público') && selectedKanban.title?.includes('Alvo') ? (
                <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Página de Público-Alvo</p>
                    <p className="text-xs text-muted-foreground">Esta secção está ligada à página dedicada de Público-Alvo & Personas em Estratégia.</p>
                  </div>
                  <Button onClick={() => { setSelectedKanban(null); navigate('/hub/marketing/estrategia/publico-alvo'); }}>
                    Abrir página <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              ) : null}
              {selectedKanban.title?.includes('Assinatura') || selectedKanban.title?.includes('promessa') || selectedKanban.title?.includes('Proposta') || selectedKanban.title?.includes('Movimento') || selectedKanban.title?.includes('Transformaç') || selectedKanban.title?.includes('transformaç') || selectedKanban.title?.includes('Convite') || selectedKanban.title?.includes('convite') || selectedKanban.title?.toLowerCase().includes('propósito') || selectedKanban.title?.toLowerCase().includes('proposito') || selectedKanban.title?.toLowerCase().includes('história') || selectedKanban.title?.toLowerCase().includes('historia') ? (
                <SingleLineEditor
                  itemId={selectedKanban.id}
                  initial={selectedKanban.content || ''}
                  isOwner={isOwner}
                  placeholder={selectedKanban.title?.includes('Assinatura') ? 'Escreve a frase de assinatura...' : selectedKanban.title?.includes('Proposta') ? 'Escreve a proposta de valor...' : selectedKanban.title?.includes('Movimento') ? 'Escreve o movimento da marca...' : selectedKanban.title?.toLowerCase().includes('transformaç') ? 'Escreve a transformação que entregas...' : selectedKanban.title?.toLowerCase().includes('convite') ? 'Escreve o convite da marca...' : selectedKanban.title?.toLowerCase().includes('propósito') || selectedKanban.title?.toLowerCase().includes('proposito') ? 'Escreve o vosso propósito numa frase...' : selectedKanban.title?.toLowerCase().includes('história') || selectedKanban.title?.toLowerCase().includes('historia') ? 'Escreve a história da marca numa frase...' : 'Escreve a vossa promessa...'}
                  onSaved={(val) => setSelectedKanban(prev => prev ? { ...prev, content: val } : null)}
                />
              ) : selectedKanban.title?.includes('Personalidade') ? (
                <PersonalidadeUniversoBoard itemId={selectedKanban.id} isOwner={isOwner} />
              ) : selectedKanban.title?.includes('Arquétipos') || selectedKanban.title?.includes('Arquetipos') ? (
                <ArchetypesBoard isOwner={isOwner} />
              ) : selectedKanban.title?.includes('Pilares') ? (
                <ContentPillarsBoard isOwner={isOwner} />
              ) : selectedKanban.title?.includes('Crenç') || selectedKanban.title?.includes('crenç') ? (
                <BulletListEditor
                  itemId={selectedKanban.id}
                  initial={selectedKanban.content || ''}
                  isOwner={isOwner}
                  placeholder="Nova crença..."
                  onSaved={(val) => setSelectedKanban(prev => prev ? { ...prev, content: val } : null)}
                />
              ) : (
                <KanbanSectionsEditor
                  itemId={selectedKanban.id}
                  isOwner={isOwner}
                  twoColumns={
                    selectedKanban.title?.includes('Segmento')
                  }
                  hideAttachments={
                    selectedKanban.title?.includes('Tom de voz') ||
                    selectedKanban.title?.includes('Segmento')
                  }
                />
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
                    <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6" onClick={() => setEditingVisualDesc(true)}>
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
                      <EmptyHint>Sem descrição.</EmptyHint>
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
                            aria-label="Eliminar" size="icon"
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
                  <div className="space-y-2">
                    {visualFiles.filter(f => f.file_type === 'file').map(file => (
                      <div key={file.id} className="flex items-center gap-2 group">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {file.file_name}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteVisualFile(file.id)}>
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
                  <div className="space-y-2">
                    {visualFiles.filter(f => f.file_type === 'link').map(file => (
                      <div key={file.id} className="flex items-center gap-2 group">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          {file.file_name}
                        </a>
                        {isOwner && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteVisualFile(file.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visualFiles.length === 0 && (
                <EmptyHint>Nenhum ficheiro carregado.</EmptyHint>
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

