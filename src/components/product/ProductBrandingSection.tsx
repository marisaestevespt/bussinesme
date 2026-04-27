import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, ExternalLink, Upload, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface BrandingData {
  // Identidade visual
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  fonts?: { display?: string; body?: string };
  visual_assets?: Array<{ label: string; url: string }>;
  // Posicionamento
  positioning?: string;
  promise?: string;
  manifesto?: string;
  tagline?: string;
  tone_of_voice?: string;
  // Símbolos
  emojis?: string;
  words_to_use?: string;
  words_to_avoid?: string;
  pains?: string;
  desires?: string;
  difficulties?: string;
  dreams?: string;
  // Pastas / links externos
  folders?: Array<{ label: string; url: string }>;
  // Notas
  notes?: string;
}

interface Props {
  branding: BrandingData;
  isOwner: boolean;
  onUpdate: (next: BrandingData) => void;
  portalBranding?: PortalBrandingData;
  onUpdatePortalBranding?: (next: PortalBrandingData) => void;
  productId?: string;
  /** Cor exclusiva do calendário/agenda (separada do branding visual). */
  calendarColor?: string | null;
  onUpdateCalendarColor?: (next: string) => void;
}

export interface PortalBrandingData {
  primary_color?: string;       // HSL "351 56% 28%" or empty (= usa identidade global)
  accent_color?: string;
  text_color?: string;
  font_display?: string;
  font_body?: string;
  logo_url?: string;
  business_name?: string;
  welcome_text?: string;
  login_title?: string;
  login_subtitle?: string;
  hero_image_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
}

export function ProductBrandingSection({ branding, isOwner, onUpdate, portalBranding, onUpdatePortalBranding, productId, calendarColor, onUpdateCalendarColor }: Props) {
  const b = branding || {};
  const set = (patch: Partial<BrandingData>) => onUpdate({ ...b, ...patch });
  const pb = portalBranding || {};
  const setPB = (patch: Partial<PortalBrandingData>) => onUpdatePortalBranding?.({ ...pb, ...patch });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [applyingColors, setApplyingColors] = useState(false);
  const qc = useQueryClient();

  const applyProductColors = async () => {
    if (!productId) return;
    if (!b.primary_color && !b.secondary_color && !b.accent_color) {
      toast.error('Define pelo menos uma cor primária antes de aplicar.');
      return;
    }
    setApplyingColors(true);
    try {
      // The portal expects HSL triplets like "351 56% 28%" (NOT "#xxxxxx").
      // Convert hex / rgb inputs into a triplet so the portal renders correctly.
      const toHslTriplet = (raw?: string): string | null => {
        if (!raw) return null;
        const trimmed = raw.trim();
        if (!trimmed) return null;
        // Already a triplet "H S% L%"
        if (/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(trimmed)) return trimmed;
        // Hex #rgb / #rrggbb
        const hex = trimmed.replace('#', '');
        const m = hex.length === 3
          ? hex.split('').map(c => c + c).join('')
          : hex.length === 6 ? hex : null;
        if (!m) return null;
        const r = parseInt(m.slice(0, 2), 16) / 255;
        const g = parseInt(m.slice(2, 4), 16) / 255;
        const bl = parseInt(m.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
        const l = (max + min) / 2;
        let h = 0, s = 0;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - bl) / d + (g < bl ? 6 : 0)); break;
            case g: h = ((bl - r) / d + 2); break;
            case bl: h = ((r - g) / d + 4); break;
          }
          h *= 60;
        }
        return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };
      const primaryHsl = toHslTriplet(b.primary_color);
      const secondaryHsl = toHslTriplet(b.secondary_color);
      const accentHsl = toHslTriplet(b.accent_color);

      // Find all client portals linked to clients that use this product
      // Either by clients.current_product_id or by an active project on that product.
      const [clientsRes, projectsRes] = await Promise.all([
        supabase.from('clients').select('id').eq('current_product_id', productId),
        supabase.from('projects').select('client_id').eq('product_id', productId).not('client_id', 'is', null),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      const clientIds = Array.from(new Set([
        ...((clientsRes.data ?? []).map(c => c.id)),
        ...((projectsRes.data ?? []).map(p => p.client_id as string).filter(Boolean)),
      ]));
      let portalsUpdated = 0;

      if (clientIds.length > 0) {
        const { data: portals, error: portalsErr } = await supabase
          .from('client_portals')
          .select('id, portal_branding' as any)
          .in('client_id', clientIds);
        if (portalsErr) throw portalsErr;

        const portalRows = (portals ?? []) as unknown as Array<{ id: string; portal_branding: Record<string, unknown> | null }>;
        for (const portal of portalRows) {
          const current = portal.portal_branding ?? {};
          const merged = {
            ...current,
            ...(primaryHsl ? { primary_color: primaryHsl } : {}),
            ...(secondaryHsl ? { secondary_color: secondaryHsl } : {}),
            ...(accentHsl ? { accent_color: accentHsl } : {}),
          };
          const { error: updErr } = await supabase
            .from('client_portals')
            .update({ portal_branding: merged } as any)
            .eq('id', portal.id);
          if (!updErr) portalsUpdated++;
        }
      }

      // Refresh runtime caches everywhere
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['product-brand-colors'] }),
        qc.invalidateQueries({ queryKey: ['product-brand-list'] }),
        qc.invalidateQueries({ queryKey: ['portal-branding'] }),
      ]);

      toast.success(
        portalsUpdated > 0
          ? `Cores aplicadas (${portalsUpdated} portal${portalsUpdated > 1 ? 'is' : ''} atualizado${portalsUpdated > 1 ? 's' : ''}).`
          : 'Cores aplicadas em toda a app.',
      );
    } catch (err) {
      console.error('applyProductColors', err);
      toast.error('Não consegui aplicar as cores. Tenta novamente.');
    } finally {
      setApplyingColors(false);
    }
  };

  const updateList = <K extends 'visual_assets' | 'folders'>(
    key: K,
    next: Array<{ label: string; url: string }>
  ) => set({ [key]: next } as Partial<BrandingData>);

  const handleUpload = async (
    key: 'visual_assets' | 'folders',
    file: File,
    items: Array<{ label: string; url: string }>,
  ) => {
    setUploadingKey(key);
    try {
      const ext = file.name.split('.').pop();
      const path = `branding/${key}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('brand-files').upload(path, file);
      if (error) {
        toast.error('Erro ao carregar ficheiro');
        return;
      }
      const { data: urlData } = supabase.storage.from('brand-files').getPublicUrl(path);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      updateList(key, [...items, { label: baseName, url: urlData.publicUrl }]);
      toast.success('Ficheiro carregado');
    } finally {
      setUploadingKey(null);
    }
  };

  const renderLinkList = (
    key: 'visual_assets' | 'folders',
    title: string,
    placeholder: string,
  ) => {
    const items = (b[key] || []) as Array<{ label: string; url: string }>;
    return (
      <div className="space-y-3 pt-2">
        <Label className="text-sm font-semibold block">{title}</Label>
        {items.map((item, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 rounded-lg border border-border bg-muted/30">
            <Input
              value={item.label}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], label: e.target.value };
                updateList(key, next);
              }}
              placeholder="Nome"
              className="h-9 text-sm sm:w-1/3"
              readOnly={!isOwner}
            />
            <Input
              value={item.url}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], url: e.target.value };
                updateList(key, next);
              }}
              placeholder={placeholder}
              className="h-9 text-sm flex-1"
              readOnly={!isOwner}
            />
            <div className="flex gap-1 items-center self-end sm:self-auto">
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2 hover:bg-primary/10 rounded-md">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </a>
              )}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => updateList(key, items.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {isOwner && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateList(key, [...items, { label: '', url: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar link
            </Button>
            <label>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(key, f, items);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingKey === key}
                asChild
              >
                <span className="cursor-pointer">
                  <Upload className="h-3 w-3 mr-1" />
                  {uploadingKey === key ? 'A carregar...' : 'Carregar ficheiro'}
                </span>
              </Button>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Identidade Visual */}
      <Card>
        <CardHeader><CardTitle className="text-base">Identidade Visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cor Primária</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={b.primary_color || '#000000'}
                  onChange={(e) => set({ primary_color: e.target.value })}
                  className="h-9 w-14 p-1 shrink-0"
                  disabled={!isOwner}
                />
                <Input
                  value={b.primary_color || ''}
                  onChange={(e) => set({ primary_color: e.target.value })}
                  placeholder="#FFCC00 ou hsl(...)"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cor Secundária</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={b.secondary_color || '#000000'}
                  onChange={(e) => set({ secondary_color: e.target.value })}
                  className="h-9 w-14 p-1 shrink-0"
                  disabled={!isOwner}
                />
                <Input
                  value={b.secondary_color || ''}
                  onChange={(e) => set({ secondary_color: e.target.value })}
                  placeholder="#..."
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cor de Destaque</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={b.accent_color || '#000000'}
                  onChange={(e) => set({ accent_color: e.target.value })}
                  className="h-9 w-14 p-1 shrink-0"
                  disabled={!isOwner}
                />
                <Input
                  value={b.accent_color || ''}
                  onChange={(e) => set({ accent_color: e.target.value })}
                  placeholder="#..."
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>
          </div>

          {isOwner && productId && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Aplica estas cores em toda a app: agenda, vendas, eventos e portais dos clientes deste produto.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={applyProductColors}
                disabled={applyingColors}
              >
                <Palette className="h-3.5 w-3.5 mr-1.5" />
                {applyingColors ? 'A aplicar…' : 'Aplicar cores do produto'}
              </Button>
            </div>
          )}

          {onUpdateCalendarColor && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Cor no calendário</Label>
                  <p className="text-xs text-muted-foreground">
                    Cor usada na Agenda para todas as reuniões, eventos e blocos de trabalho associados a este produto (com cliente, internos ou ações comerciais).
                  </p>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <Input
                    type="color"
                    value={calendarColor || b.primary_color || '#6366f1'}
                    onChange={(e) => onUpdateCalendarColor(e.target.value)}
                    className="h-9 w-14 p-1 shrink-0"
                    disabled={!isOwner}
                  />
                  <Input
                    value={calendarColor || ''}
                    onChange={(e) => onUpdateCalendarColor(e.target.value)}
                    placeholder="#6366f1"
                    className="h-9 text-sm w-32"
                    readOnly={!isOwner}
                  />
                </div>
              </div>
              {(calendarColor || b.primary_color) && (
                <div
                  className="mt-2 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: calendarColor || b.primary_color }}
                >
                  <span className="h-2 w-2 rounded-full bg-white/80" />
                  Pré-visualização na agenda
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipografia — Display / Títulos</Label>
              <Input
                value={b.fonts?.display || ''}
                onChange={(e) => set({ fonts: { ...(b.fonts || {}), display: e.target.value } })}
                placeholder="Ex: Plus Jakarta Sans"
                className="h-9 text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipografia — Corpo</Label>
              <Input
                value={b.fonts?.body || ''}
                onChange={(e) => set({ fonts: { ...(b.fonts || {}), body: e.target.value } })}
                placeholder="Ex: Inter"
                className="h-9 text-sm"
                readOnly={!isOwner}
              />
            </div>
          </div>

          {renderLinkList('visual_assets', 'Assets Visuais (logos, mood board, ícones, etc.)', 'https://...')}
        </CardContent>
      </Card>

      {/* Portal do Cliente — branding específico deste produto */}
      {onUpdatePortalBranding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portal do Cliente</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Personaliza o portal dos clientes que têm este produto. Campos vazios herdam automaticamente da Identidade Visual global do negócio.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Cores (HSL para combinar com o sistema) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cor Primária (HSL)</Label>
                <Input
                  value={pb.primary_color || ''}
                  onChange={(e) => setPB({ primary_color: e.target.value })}
                  placeholder="Ex: 351 56% 28%"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
                {pb.primary_color && (
                  <div className="h-2 rounded" style={{ backgroundColor: `hsl(${pb.primary_color})` }} />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cor de Destaque (HSL)</Label>
                <Input
                  value={pb.accent_color || ''}
                  onChange={(e) => setPB({ accent_color: e.target.value })}
                  placeholder="Ex: 26 40% 39%"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
                {pb.accent_color && (
                  <div className="h-2 rounded" style={{ backgroundColor: `hsl(${pb.accent_color})` }} />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cor de Texto (HSL)</Label>
                <Input
                  value={pb.text_color || ''}
                  onChange={(e) => setPB({ text_color: e.target.value })}
                  placeholder="Ex: 0 0% 16%"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
                {pb.text_color && (
                  <div className="h-2 rounded" style={{ backgroundColor: `hsl(${pb.text_color})` }} />
                )}
              </div>
            </div>

            {/* Tipografia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fonte Display / Títulos</Label>
                <Input
                  value={pb.font_display || ''}
                  onChange={(e) => setPB({ font_display: e.target.value })}
                  placeholder="Ex: Lora"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fonte Corpo</Label>
                <Input
                  value={pb.font_body || ''}
                  onChange={(e) => setPB({ font_body: e.target.value })}
                  placeholder="Ex: DM Sans"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>

            {/* Logo + nome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Logo (URL)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={pb.logo_url || ''}
                    onChange={(e) => setPB({ logo_url: e.target.value })}
                    placeholder="https://..."
                    className="h-9 text-sm flex-1"
                    readOnly={!isOwner}
                  />
                  {isOwner && (
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploadingKey('portal_logo');
                          try {
                            const ext = f.name.split('.').pop();
                            const path = `portal-branding/logo-${Date.now()}.${ext}`;
                            const { error } = await supabase.storage.from('brand-files').upload(path, f);
                            if (error) { toast.error('Erro ao carregar logo'); return; }
                            const { data: urlData } = supabase.storage.from('brand-files').getPublicUrl(path);
                            setPB({ logo_url: urlData.publicUrl });
                            toast.success('Logo carregado');
                          } finally {
                            setUploadingKey(null);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingKey === 'portal_logo'} asChild>
                        <span className="cursor-pointer">
                          <Upload className="h-3 w-3 mr-1" />
                          {uploadingKey === 'portal_logo' ? '...' : 'Enviar'}
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
                {pb.logo_url && (
                  <img src={pb.logo_url} alt="Logo portal" className="h-10 mt-2 object-contain" />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome a apresentar</Label>
                <Input
                  value={pb.business_name || ''}
                  onChange={(e) => setPB({ business_name: e.target.value })}
                  placeholder="Deixa vazio para usar o nome da empresa"
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>

            {/* Textos do login */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold block">Login do portal</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <Input
                    value={pb.login_title || ''}
                    onChange={(e) => setPB({ login_title: e.target.value })}
                    placeholder="Olá! 👋"
                    className="h-9 text-sm"
                    readOnly={!isOwner}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Subtítulo lateral</Label>
                  <Input
                    value={pb.login_subtitle || ''}
                    onChange={(e) => setPB({ login_subtitle: e.target.value })}
                    placeholder="O teu espaço. A tua jornada."
                    className="h-9 text-sm"
                    readOnly={!isOwner}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Mensagem de boas-vindas</Label>
                <Textarea
                  value={pb.welcome_text || ''}
                  onChange={(e) => setPB({ welcome_text: e.target.value })}
                  placeholder="Bem-vinda ao teu espaço pessoal..."
                  className="min-h-[70px] text-sm"
                  readOnly={!isOwner}
                />
              </div>
            </div>

            {/* Hero / imagem de fundo */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold block">Painel lateral (hero)</Label>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Imagem de fundo (URL)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={pb.hero_image_url || ''}
                    onChange={(e) => setPB({ hero_image_url: e.target.value })}
                    placeholder="https://..."
                    className="h-9 text-sm flex-1"
                    readOnly={!isOwner}
                  />
                  {isOwner && (
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploadingKey('portal_hero');
                          try {
                            const ext = f.name.split('.').pop();
                            const path = `portal-branding/hero-${Date.now()}.${ext}`;
                            const { error } = await supabase.storage.from('brand-files').upload(path, f);
                            if (error) { toast.error('Erro ao carregar imagem'); return; }
                            const { data: urlData } = supabase.storage.from('brand-files').getPublicUrl(path);
                            setPB({ hero_image_url: urlData.publicUrl });
                            toast.success('Imagem carregada');
                          } finally {
                            setUploadingKey(null);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingKey === 'portal_hero'} asChild>
                        <span className="cursor-pointer">
                          <Upload className="h-3 w-3 mr-1" />
                          {uploadingKey === 'portal_hero' ? '...' : 'Enviar'}
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
                {pb.hero_image_url && (
                  <img src={pb.hero_image_url} alt="Hero" className="h-24 w-full object-cover rounded-md mt-2" />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Título do hero</Label>
                  <Input
                    value={pb.hero_title || ''}
                    onChange={(e) => setPB({ hero_title: e.target.value })}
                    placeholder="O teu espaço."
                    className="h-9 text-sm"
                    readOnly={!isOwner}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Subtítulo do hero</Label>
                  <Input
                    value={pb.hero_subtitle || ''}
                    onChange={(e) => setPB({ hero_subtitle: e.target.value })}
                    placeholder="A tua jornada."
                    className="h-9 text-sm"
                    readOnly={!isOwner}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posicionamento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Posicionamento & Mensagem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tagline</Label>
            <Input
              value={b.tagline || ''}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="Frase curta e memorável"
              className="h-9 text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Posicionamento</Label>
            <Textarea
              value={b.positioning || ''}
              onChange={(e) => set({ positioning: e.target.value })}
              placeholder="Para [público], que [necessidade], somos [categoria] que [diferenciador]."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Promessa</Label>
            <Textarea
              value={b.promise || ''}
              onChange={(e) => set({ promise: e.target.value })}
              placeholder="O que prometemos entregar ao cliente."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Manifesto</Label>
            <Textarea
              value={b.manifesto || ''}
              onChange={(e) => set({ manifesto: e.target.value })}
              placeholder="A declaração de princípios e propósito desta marca."
              className="min-h-[120px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tom de Voz</Label>
            <Textarea
              value={b.tone_of_voice || ''}
              onChange={(e) => set({ tone_of_voice: e.target.value })}
              placeholder="Ex: próximo, direto, com humor leve. Evitar jargão técnico."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
        </CardContent>
      </Card>

      {/* Símbolos & Linguagem */}
      <Card>
        <CardHeader><CardTitle className="text-base">Símbolos & Linguagem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Emojis da Marca</Label>
            <Input
              value={b.emojis || ''}
              onChange={(e) => set({ emojis: e.target.value })}
              placeholder="✨ 🎯 💡"
              className="h-9 text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Palavras a Utilizar</Label>
            <Textarea
              value={b.words_to_use || ''}
              onChange={(e) => set({ words_to_use: e.target.value })}
              placeholder="Vocabulário, expressões e termos que representam a marca"
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Palavras a NÃO Dizer</Label>
            <Textarea
              value={b.words_to_avoid || ''}
              onChange={(e) => set({ words_to_avoid: e.target.value })}
              placeholder="Termos, jargão ou expressões a evitar"
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dores</Label>
              <Textarea
                value={b.pains || ''}
                onChange={(e) => set({ pains: e.target.value })}
                placeholder="Principais dores do público"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dificuldades</Label>
              <Textarea
                value={b.difficulties || ''}
                onChange={(e) => set({ difficulties: e.target.value })}
                placeholder="Obstáculos que enfrentam"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Desejos</Label>
              <Textarea
                value={b.desires || ''}
                onChange={(e) => set({ desires: e.target.value })}
                placeholder="O que querem alcançar"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sonhos</Label>
              <Textarea
                value={b.dreams || ''}
                onChange={(e) => set({ dreams: e.target.value })}
                placeholder="Aspirações maiores e visão de futuro"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pastas & Recursos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pastas & Recursos Externos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {renderLinkList('folders', 'Links para pastas (Drive, Figma, Notion, etc.)', 'https://...')}
        </CardContent>
      </Card>

      {/* Notas livres */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notas de Branding</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={b.notes || ''}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Outras notas, referências, inspirações..."
            className="min-h-[120px] text-sm"
            readOnly={!isOwner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
