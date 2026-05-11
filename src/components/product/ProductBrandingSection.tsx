import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, ExternalLink, Upload, Palette, Pencil, Check, FileText, Link2, Sparkles, Globe, FolderOpen, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { BrandFontPicker } from '@/components/shared/BrandFontPicker';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { ImageIcon } from 'lucide-react';
import { EntityTabs, EntityTabsList, EntityTabsTrigger, EntityTabsContent } from '@/components/layout/entity/EntityTabs';
import { ProductTabHeader } from './_shared';

/* ── color helpers (HEX <-> HSL triplet "H S% L%") ── */

function hexToHslTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const m = h.length === 3 ? h.split('').map(c => c + c).join('') : h.length === 6 ? h : null;
  if (!m) return '';
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hue = ((b - r) / d + 2); break;
      case b: hue = ((r - g) / d + 4); break;
    }
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslTripletToHex(triplet?: string): string {
  if (!triplet) return '#000000';
  const parts = triplet.trim().split(/\s+/).map(p => parseFloat(p));
  if (parts.length < 3 || parts.some(isNaN)) return '#000000';
  const h = parts[0], s = parts[1] / 100, l = parts[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function PortalColorField({
  label, value, onChange, disabled,
}: { label: string; value?: string; onChange: (hslTriplet: string) => void; disabled?: boolean }) {
  const hex = value ? hslTripletToHex(value) : '';
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <input
            type="color"
            value={hex || '#000000'}
            onChange={(e) => onChange(hexToHslTriplet(e.target.value))}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div
            className="h-full w-full rounded-lg"
            style={{ backgroundColor: hex || 'transparent', backgroundImage: !hex ? 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%) 50% / 10px 10px' : undefined }}
          />
        </label>
        <Input
          value={hex}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (!v) { onChange(''); return; }
            const triplet = hexToHslTriplet(v.startsWith('#') ? v : `#${v}`);
            if (triplet) onChange(triplet);
          }}
          placeholder="#______"
          maxLength={7}
          disabled={disabled}
          className="h-10 font-mono text-xs w-28"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  );
}

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
  /** Slot opcional renderizado dentro de uma subtab dedicada "Email Boas-vindas". */
  welcomeEmailSlot?: React.ReactNode;
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

export function ProductBrandingSection({ branding, isOwner, onUpdate, portalBranding, onUpdatePortalBranding, productId, calendarColor, onUpdateCalendarColor, welcomeEmailSlot }: Props) {
  const b = branding || {};
  const set = (patch: Partial<BrandingData>) => onUpdate({ ...b, ...patch });
  const pb = portalBranding || {};
  const setPB = (patch: Partial<PortalBrandingData>) => onUpdatePortalBranding?.({ ...pb, ...patch });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [applyingColors, setApplyingColors] = useState(false);
  const qc = useQueryClient();
  const { settings: globalSettings } = useBusinessSettings();
  const globalHeroFallback = (globalSettings as any)?.login_bg_url as string | undefined;

  // ---- Portal preview helpers --------------------------------------------------
  // Falls back to the global brand identity (b.*) when a portal field is empty,
  // mirroring the actual portal rendering logic.
  const previewPrimary = pb.primary_color?.trim() || (b.primary_color?.startsWith('#') ? null : b.primary_color) || '351 56% 28%';
  const previewAccent = pb.accent_color?.trim() || '26 40% 39%';
  const previewText = pb.text_color?.trim() || '0 0% 16%';
  const previewFontDisplay = pb.font_display?.trim() || 'Lora';
  const previewFontBody = pb.font_body?.trim() || 'DM Sans';
  const previewLogo = pb.logo_url;
  const previewName = pb.business_name?.trim() || 'O teu negócio';
  const previewLoginTitle = pb.login_title?.trim() || 'Olá! 👋';
  const previewLoginSubtitle = pb.login_subtitle?.trim() || 'O teu espaço. A tua jornada.';
  const previewWelcome = pb.welcome_text?.trim() || 'Bem-vinda ao teu espaço pessoal.';
  const previewHeroImage = pb.hero_image_url || globalHeroFallback;
  const previewHeroTitle = pb.hero_title?.trim() || 'O teu espaço.';
  const previewHeroSubtitle = pb.hero_subtitle?.trim() || 'A tua jornada.';

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
  ) => (
    <LinkList
      title={title}
      placeholder={placeholder}
      isOwner={isOwner}
      items={(b[key] || []) as Array<{ label: string; url: string }>}
      onChange={(next) => updateList(key, next)}
      onUploadFile={(file, items) => handleUpload(key, file, items)}
      uploading={uploadingKey === key}
    />
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      <ProductTabHeader
        icon={Palette}
        title="Branding"
        description="Identidade visual, tom de voz e personalização do portal do cliente. Tudo o que torna este produto reconhecível."
      />
      <EntityTabs defaultValue="estrategia" className="space-y-6">
        <EntityTabsList className="w-full justify-start">
          <EntityTabsTrigger value="estrategia">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
            Estratégia
          </EntityTabsTrigger>
          <EntityTabsTrigger value="visual">
            <Palette className="h-3.5 w-3.5 mr-1.5 inline" />
            Identidade Visual
          </EntityTabsTrigger>
          {onUpdatePortalBranding && (
            <EntityTabsTrigger value="portal">
              <Globe className="h-3.5 w-3.5 mr-1.5 inline" />
              Portal do Cliente
            </EntityTabsTrigger>
          )}
          <EntityTabsTrigger value="recursos">
            <FolderOpen className="h-3.5 w-3.5 mr-1.5 inline" />
            Recursos & Notas
          </EntityTabsTrigger>
          {welcomeEmailSlot && (
            <EntityTabsTrigger value="welcome-email">
              <Mail className="h-3.5 w-3.5 mr-1.5 inline" />
              Email Boas-vindas
            </EntityTabsTrigger>
          )}
        </EntityTabsList>

        {/* ─────────────────────── ESTRATÉGIA ─────────────────────── */}
        <EntityTabsContent value="estrategia" className="space-y-6 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Estratégia da Marca</h3>
            <p className="text-xs text-muted-foreground">O que esta marca representa antes de qualquer desenho.</p>
          </div>
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
        </EntityTabsContent>

        {/* ─────────────────────── IDENTIDADE VISUAL ─────────────────────── */}
        <EntityTabsContent value="visual" className="space-y-6 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Identidade Visual</h3>
            <p className="text-xs text-muted-foreground">Como a marca se mostra: cores, tipografia, logos, assets.</p>
          </div>
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
        </EntityTabsContent>

        {/* ─────────────────────── PORTAL DO CLIENTE ─────────────────────── */}
        {onUpdatePortalBranding && (
        <EntityTabsContent value="portal" className="space-y-6 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Portal do Cliente</h3>
            <p className="text-xs text-muted-foreground">Personaliza o espaço onde o cliente entra.</p>
          </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portal do Cliente</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Personaliza o portal dos clientes que têm este produto. Campos vazios herdam automaticamente da Identidade Visual global do negócio.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Pré-visualização ao vivo do portal — generosa, sticky enquanto preenches */}
            <div className="lg:sticky lg:top-4 z-10 -mx-2 sm:mx-0">
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30 shadow-sm">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                  </div>
                  <div className="flex-1 mx-3 h-6 rounded-md bg-background border border-border/50 flex items-center px-3 text-[11px] text-muted-foreground truncate">
                    portal.{(previewName || 'negocio').toLowerCase().replace(/\s+/g, '')}.com
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pré-visualização ao vivo</span>
                </div>
                {/* Conteúdo do portal — proporção alta, cheia */}
                <div
                  className="grid grid-cols-1 md:grid-cols-2 aspect-[16/9] md:aspect-[16/8] min-h-[420px]"
                  style={{
                    fontFamily: previewFontBody,
                    color: `hsl(${previewText})`,
                  }}
                >
                  {/* Hero / painel lateral */}
                  <div
                    className="relative p-8 flex flex-col justify-end min-h-[260px]"
                    style={{
                      backgroundColor: `hsl(${previewPrimary})`,
                      backgroundImage: previewHeroImage ? `url(${previewHeroImage})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {previewHeroImage && (
                      <div className="absolute inset-0" style={{ backgroundColor: `hsl(${previewPrimary} / 0.5)` }} />
                    )}
                    <div className="relative z-10 text-white space-y-2">
                      <div
                        className="text-3xl md:text-4xl leading-tight font-medium"
                        style={{ fontFamily: previewFontDisplay }}
                      >
                        {previewHeroTitle}
                      </div>
                      <div className="text-sm md:text-base opacity-90 max-w-sm">
                        {previewHeroSubtitle}
                      </div>
                    </div>
                  </div>
                  {/* Painel de login */}
                  <div className="p-8 md:p-10 flex flex-col gap-5 bg-background">
                    <div className="flex items-center gap-3">
                      {previewLogo ? (
                        <img src={previewLogo} alt="" className="h-10 object-contain" />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                          style={{ backgroundColor: `hsl(${previewPrimary})` }}
                        >
                          {previewName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span
                        className="text-base font-medium"
                        style={{ fontFamily: previewFontDisplay, color: `hsl(${previewText})` }}
                      >
                        {previewName}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="text-2xl md:text-3xl leading-tight"
                        style={{ fontFamily: previewFontDisplay, color: `hsl(${previewText})` }}
                      >
                        {previewLoginTitle}
                      </div>
                      <div className="text-sm" style={{ color: `hsl(${previewText} / 0.65)` }}>
                        {previewLoginSubtitle}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: `hsl(${previewText} / 0.8)` }}>
                      {previewWelcome}
                    </p>
                    <div className="mt-auto space-y-3">
                      <div className="space-y-1.5">
                        <div className="text-[11px] uppercase tracking-wider" style={{ color: `hsl(${previewText} / 0.5)` }}>
                          Email
                        </div>
                        <div
                          className="h-11 rounded-md border px-3 flex items-center text-sm"
                          style={{ borderColor: `hsl(${previewText} / 0.18)`, color: `hsl(${previewText} / 0.55)` }}
                        >
                          email@exemplo.com
                        </div>
                      </div>
                      <div
                        className="h-11 rounded-md flex items-center justify-center text-sm font-medium text-white"
                        style={{ backgroundColor: `hsl(${previewAccent})` }}
                      >
                        Entrar no portal
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cores (HSL para combinar com o sistema) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PortalColorField
                label="Cor Primária"
                value={pb.primary_color}
                onChange={(v) => setPB({ primary_color: v })}
                disabled={!isOwner}
              />
              <PortalColorField
                label="Cor de Destaque"
                value={pb.accent_color}
                onChange={(v) => setPB({ accent_color: v })}
                disabled={!isOwner}
              />
              <PortalColorField
                label="Cor de Texto"
                value={pb.text_color}
                onChange={(v) => setPB({ text_color: v })}
                disabled={!isOwner}
              />
            </div>

            {/* Tipografia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <BrandFontPicker
                label="Fonte Display / Títulos"
                value={pb.font_display}
                onChange={(v) => setPB({ font_display: v })}
                onClear={() => setPB({ font_display: '' })}
                variant="display"
                disabled={!isOwner}
              />
              <BrandFontPicker
                label="Fonte Corpo"
                value={pb.font_body}
                onChange={(v) => setPB({ font_body: v })}
                onClear={() => setPB({ font_body: '' })}
                variant="body"
                disabled={!isOwner}
              />
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

            {/* Hero / imagem de fundo — DESTAQUE no topo */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold block flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Painel lateral do login (imagem de fundo)
                </Label>
                {pb.hero_image_url && isOwner && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setPB({ hero_image_url: '' })}>
                    Remover
                  </Button>
                )}
              </div>

              {/* Uploader compacto — a pré-visualização ao vivo já está no topo da subtab */}
              {isOwner && (
                <label className="inline-block">
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
                      {uploadingKey === 'portal_hero' ? 'A carregar…' : (previewHeroImage ? 'Mudar imagem' : 'Carregar imagem')}
                    </span>
                  </Button>
                </label>
              )}

              {/* URL alternativa + nota de fallback */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ou cola um URL</Label>
                <Input
                  value={pb.hero_image_url || ''}
                  onChange={(e) => setPB({ hero_image_url: e.target.value })}
                  placeholder="https://..."
                  className="h-9 text-sm"
                  readOnly={!isOwner}
                />
              </div>

              {!pb.hero_image_url && globalHeroFallback && (
                <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5 border border-border/50">
                  ℹ️ A usar a imagem global das <strong>Definições</strong> como fallback. Carrega aqui uma imagem para personalizar só este produto.
                </p>
              )}
              {!pb.hero_image_url && !globalHeroFallback && (
                <p className="text-[11px] text-muted-foreground">
                  Dica: também podes definir uma imagem global em <strong>Definições</strong> que será usada por defeito em todos os produtos.
                </p>
              )}

              {/* Títulos do hero */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
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
          </CardContent>
        </Card>
        </EntityTabsContent>
        )}

        {/* ─────────────────────── RECURSOS & NOTAS ─────────────────────── */}
        <EntityTabsContent value="recursos" className="space-y-6 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recursos & Notas</h3>
            <p className="text-xs text-muted-foreground">Pastas externas e notas internas sobre a marca.</p>
          </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Pastas & Recursos Externos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {renderLinkList('folders', 'Links para pastas (Drive, Figma, Notion, etc.)', 'https://...')}
        </CardContent>
      </Card>

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
        </EntityTabsContent>

        {/* ─────────────────────── EMAIL BOAS-VINDAS ─────────────────────── */}
        {welcomeEmailSlot && (
          <EntityTabsContent value="welcome-email" className="space-y-6 mt-4">
            {welcomeEmailSlot}
          </EntityTabsContent>
        )}
      </EntityTabs>
    </div>
  );
}

/* ── LinkList: itens estáticos, edição explícita por linha ── */

interface LinkItem { label: string; url: string }

function isLikelyFile(url: string): boolean {
  return /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp|svg|zip|rar|csv|ai|psd|fig|sketch|mp4|mov)(\?|$)/i.test(url);
}

function LinkList({
  title, placeholder, isOwner, items, onChange, onUploadFile, uploading,
}: {
  title: string;
  placeholder: string;
  isOwner: boolean;
  items: LinkItem[];
  onChange: (next: LinkItem[]) => void;
  onUploadFile: (file: File, items: LinkItem[]) => void;
  uploading: boolean;
}) {
  // Inline edit on blur — no explicit save button. Empty rows are removed automatically on blur.
  const updateField = (i: number, field: 'label' | 'url', value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };

  const removeIfEmpty = (i: number) => {
    const it = items[i];
    if (!it?.label?.trim() && !it?.url?.trim()) {
      onChange(items.filter((_, j) => j !== i));
    }
  };

  const addRow = () => {
    onChange([...items, { label: '', url: '' }]);
  };

  return (
    <div className="space-y-3 pt-2">
      <Label className="text-sm font-semibold block">{title}</Label>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Ainda não há nada aqui.</p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const Icon = isLikelyFile(item.url) ? FileText : Link2;
          return (
            <div
              key={i}
              className="group flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              {isOwner ? (
                <>
                  <Input
                    value={item.label}
                    onChange={(e) => updateField(i, 'label', e.target.value)}
                    onBlur={() => removeIfEmpty(i)}
                    placeholder="Nome"
                    className="h-8 text-sm sm:w-1/3 border-transparent hover:border-border focus:border-primary/40 bg-transparent"
                  />
                  <Input
                    value={item.url}
                    onChange={(e) => updateField(i, 'url', e.target.value)}
                    onBlur={() => removeIfEmpty(i)}
                    placeholder={placeholder}
                    className="h-8 text-xs flex-1 border-transparent hover:border-border focus:border-primary/40 bg-transparent font-mono"
                  />
                </>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{item.label || 'Sem nome'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{item.url}</div>
                </div>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 hover:bg-primary/10 rounded-md text-primary"
                  title="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {isOwner && (
        <div className="flex gap-2 flex-wrap pt-1">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar link
          </Button>
          <label>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(f, items);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? 'A carregar...' : 'Carregar ficheiro'}
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
