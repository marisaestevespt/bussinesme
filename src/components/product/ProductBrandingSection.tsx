import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, ExternalLink, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

export function ProductBrandingSection({ branding, isOwner, onUpdate }: Props) {
  const b = branding || {};
  const set = (patch: Partial<BrandingData>) => onUpdate({ ...b, ...patch });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipografia — Display / Títulos</Label>
              <Input
                value={b.fonts?.display || ''}
                onChange={(e) => set({ fonts: { ...(b.fonts || {}), display: e.target.value } })}
                placeholder="Ex: Plus Jakarta Sans"
                className="h-9 text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-1.5">
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

      {/* Posicionamento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Posicionamento & Mensagem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tagline</Label>
            <Input
              value={b.tagline || ''}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="Frase curta e memorável"
              className="h-9 text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Posicionamento</Label>
            <Textarea
              value={b.positioning || ''}
              onChange={(e) => set({ positioning: e.target.value })}
              placeholder="Para [público], que [necessidade], somos [categoria] que [diferenciador]."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Promessa</Label>
            <Textarea
              value={b.promise || ''}
              onChange={(e) => set({ promise: e.target.value })}
              placeholder="O que prometemos entregar ao cliente."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Manifesto</Label>
            <Textarea
              value={b.manifesto || ''}
              onChange={(e) => set({ manifesto: e.target.value })}
              placeholder="A declaração de princípios e propósito desta marca."
              className="min-h-[120px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Emojis da Marca</Label>
            <Input
              value={b.emojis || ''}
              onChange={(e) => set({ emojis: e.target.value })}
              placeholder="✨ 🎯 💡"
              className="h-9 text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Palavras a Utilizar</Label>
            <Textarea
              value={b.words_to_use || ''}
              onChange={(e) => set({ words_to_use: e.target.value })}
              placeholder="Vocabulário, expressões e termos que representam a marca"
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
          <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dores</Label>
              <Textarea
                value={b.pains || ''}
                onChange={(e) => set({ pains: e.target.value })}
                placeholder="Principais dores do público"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dificuldades</Label>
              <Textarea
                value={b.difficulties || ''}
                onChange={(e) => set({ difficulties: e.target.value })}
                placeholder="Obstáculos que enfrentam"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Desejos</Label>
              <Textarea
                value={b.desires || ''}
                onChange={(e) => set({ desires: e.target.value })}
                placeholder="O que querem alcançar"
                className="min-h-[100px] text-sm"
                readOnly={!isOwner}
              />
            </div>
            <div className="space-y-1.5">
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
