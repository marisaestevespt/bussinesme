import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { DISPLAY_FONTS, BODY_FONTS } from '@/lib/modules';
import { toast } from 'sonner';
import { Upload, Palette, Type, Building2, Save } from 'lucide-react';

/* ── colour helpers ── */

function hslToHex(hsl: string): string {
  const parts = hsl.split(' ').map(p => parseFloat(p));
  if (parts.length < 3) return '#1a1f36';
  const h = parts[0], s = parts[1] / 100, l = parts[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s: number;
  const l = (max + min) / 2;
  if (max === min) { s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/* ── section wrapper ── */

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold tracking-tight uppercase">{title}</h2>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ── colour picker ── */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border shadow-sm hq-transition hover:shadow-md">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="h-full w-full rounded-lg" style={{ backgroundColor: value }} />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 font-mono text-xs w-28"
          maxLength={7}
        />
      </div>
    </div>
  );
}

/* ── font selector ── */

function FontSelector({ label, value, onChange, fonts }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fonts: readonly string[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fonts.map(font => (
            <SelectItem key={font} value={font}>
              <span style={{ fontFamily: `'${font}', sans-serif` }}>{font}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p
        className="text-sm text-muted-foreground leading-relaxed"
        style={{ fontFamily: `'${value}', sans-serif` }}
      >
        O teu negócio merece uma identidade única.
      </p>
    </div>
  );
}

/* ── main component ── */

export function BrandSettings() {
  const { settings, refetch } = useBusinessSettings();
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [colors, setColors] = useState({
    primary: '#1a1f36',
    secondary: '#f0f4f8',
    background: '#ffffff',
    text: '#0a0f1e',
  });
  const [fontDisplay, setFontDisplay] = useState('Cormorant Garamond');
  const [fontBody, setFontBody] = useState('DM Sans');

  // Populate form from existing settings
  useEffect(() => {
    if (!settings) return;
    setBusinessName(settings.business_name);
    setLogoPreview(settings.logo_url);
    setColors({
      primary: hslToHex(settings.primary_color),
      secondary: hslToHex(settings.secondary_color),
      background: hslToHex(settings.background_color),
      text: hslToHex(settings.text_color),
    });
    setFontDisplay(settings.font_display);
    setFontBody(settings.font_body);
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const updateColor = (key: keyof typeof colors) => (value: string) =>
    setColors(c => ({ ...c, [key]: value }));

  const handleSave = async () => {
    if (!settings || !businessName.trim()) return;

    setSaving(true);
    try {
      // Upload new logo if changed
      let logoUrl = settings.logo_url;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const { data: { user } } = await supabase.auth.getUser();
        const path = `${user?.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
          logoUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from('business_settings')
        .update({
          business_name: businessName.trim(),
          logo_url: logoUrl,
          primary_color: hexToHsl(colors.primary),
          secondary_color: hexToHsl(colors.secondary),
          background_color: hexToHsl(colors.background),
          text_color: hexToHsl(colors.text),
          font_display: fontDisplay,
          font_body: fontBody,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast.success('Definições atualizadas!');
      await refetch();
      // Reload to apply new CSS variables everywhere
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* ── Identidade ── */}
      <Section icon={Building2} title="Identidade">
        <div className="space-y-2">
          <Label htmlFor="settingsBusinessName" className="text-sm font-medium">
            Nome do negócio
          </Label>
          <Input
            id="settingsBusinessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="O nome do teu negócio"
            required
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Logo</Label>
          <div className="flex items-center gap-4">
            <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hq-transition hover:border-muted-foreground/50 hover:bg-muted/50 overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground/50" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            <div className="text-xs text-muted-foreground">
              <p>Arrasta ou clica para carregar</p>
              <p className="mt-0.5">PNG, JPG ou SVG</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Cores da Marca ── */}
      <Section icon={Palette} title="Cores da Marca">
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Cor primária" value={colors.primary} onChange={updateColor('primary')} />
          <ColorField label="Cor secundária" value={colors.secondary} onChange={updateColor('secondary')} />
          <ColorField label="Fundo" value={colors.background} onChange={updateColor('background')} />
          <ColorField label="Texto" value={colors.text} onChange={updateColor('text')} />
        </div>
      </Section>

      {/* ── Tipografia ── */}
      <Section icon={Type} title="Tipografia">
        <div className="grid grid-cols-2 gap-6">
          <FontSelector
            label="Fonte para títulos"
            value={fontDisplay}
            onChange={setFontDisplay}
            fonts={DISPLAY_FONTS}
          />
          <FontSelector
            label="Fonte para corpo"
            value={fontBody}
            onChange={setFontBody}
            fonts={BODY_FONTS}
          />
        </div>
      </Section>

      {/* ── Preview ── */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Pré-visualização</span>
        </div>
        <div className="p-6" style={{ backgroundColor: colors.background }}>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <img src={logoPreview} alt="" className="h-8 w-8 rounded-md object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-md" style={{ backgroundColor: colors.primary }} />
            )}
            <span
              style={{ color: colors.text, fontFamily: `'${fontDisplay}', serif` }}
              className="text-lg font-semibold"
            >
              HQ | {businessName || 'O Teu Negócio'}
            </span>
          </div>
          <p
            className="mt-3 text-sm"
            style={{ color: colors.text, fontFamily: `'${fontBody}', sans-serif`, opacity: 0.7 }}
          >
            Esta é uma amostra do texto do corpo com a fonte selecionada.
          </p>
          <div className="flex gap-2 mt-4">
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium text-white" style={{ backgroundColor: colors.primary }}>
              Botão primário
            </div>
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium border" style={{ backgroundColor: colors.secondary, color: colors.text }}>
              Botão secundário
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="h-11 gap-2" disabled={saving || !businessName.trim()}>
        <Save className="h-4 w-4" />
        {saving ? 'A guardar...' : 'Guardar alterações'}
      </Button>
    </div>
  );
}
