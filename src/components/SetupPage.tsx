import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { DISPLAY_FONTS, BODY_FONTS } from '@/lib/modules';
import { toast } from 'sonner';
import { Upload, Palette, Type, Building2, Globe } from 'lucide-react';
import { SECTOR_OPTIONS, type BusinessSector } from '@/lib/sector-config';

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

const DEFAULT_COLORS = {
  primary: '222 47% 11%',
  secondary: '210 40% 96%',
  background: '0 0% 100%',
  text: '222 84% 5%',
};

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
    <div className="space-y-2">
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

/* ── main page ── */

export function SetupPage() {
  const { user } = useAuth();
  const { refetch } = useBusinessSettings();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [sector, setSector] = useState<BusinessSector>('servicos_digitais');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [colors, setColors] = useState({
    primary: hslToHex(DEFAULT_COLORS.primary),
    secondary: hslToHex(DEFAULT_COLORS.secondary),
    background: hslToHex(DEFAULT_COLORS.background),
    text: hslToHex(DEFAULT_COLORS.text),
  });
  const [fontDisplay, setFontDisplay] = useState('Cormorant Garamond');
  const [fontBody, setFontBody] = useState('DM Sans');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const updateColor = (key: keyof typeof colors) => (value: string) =>
    setColors(c => ({ ...c, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessName.trim()) return;

    setLoading(true);
    try {
      // Assign owner role
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'owner' });

      // Upload logo
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `${user.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
          logoUrl = publicUrl;
        }
      }

      // Save settings
      const { error } = await supabase.from('business_settings').insert({
        business_name: businessName.trim(),
        business_sector: sector,
        logo_url: logoUrl,
        primary_color: hexToHsl(colors.primary),
        secondary_color: hexToHsl(colors.secondary),
        background_color: hexToHsl(colors.background),
        text_color: hexToHsl(colors.text),
        font_display: fontDisplay,
        font_body: fontBody,
      });

      if (error) throw error;

      // Seed default data (roles, categories, channels, etc.)
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.functions.invoke('seed-instance', {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });

      toast.success('Sistema Lyrata® configurado com sucesso!');
      await refetch();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center hq-surface-sunken p-4">
      <div className="w-full max-w-2xl space-y-8 py-12">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Configura o teu sistema Lyrata®
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Define a identidade visual do teu negócio. Podes alterar tudo mais tarde nas Definições.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Setor ── */}
          <Section icon={Globe} title="Setor do Negócio">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Qual é o setor do teu negócio?</Label>
              <Select value={sector} onValueChange={v => setSector(v as BusinessSector)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
                O setor adapta automaticamente a terminologia do sistema — por exemplo, "Pacientes" em vez de "Clientes" para saúde. Podes alterar a qualquer momento em <strong>Definições → Instância</strong>.
              </p>
            </div>
          </Section>

          {/* ── Identidade ── */}
          <Section icon={Building2} title="Identidade">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium">
                Nome do negócio
              </Label>
              <Input
                id="businessName"
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
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3 mt-2">
              As cores são guardadas, mas por defeito o sistema mantém o <strong className="text-foreground">tema Lyrata®</strong> (otimizado para leitura e contraste). Podes ativar as tuas cores a qualquer momento em <strong className="text-foreground">Definições → Identidade</strong>, no toggle <em>"Usar tema do sistema"</em>.
            </p>
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
            <div
              className="p-6"
              style={{ backgroundColor: colors.background }}
            >
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
                  sistema Lyrata® · {businessName || 'O Teu Negócio'}
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

          <Button type="submit" className="w-full h-12 text-base" disabled={loading || !businessName.trim()}>
            {loading ? 'A configurar...' : 'Criar o meu sistema Lyrata®'}
          </Button>
        </form>
      </div>
    </div>
  );
}
