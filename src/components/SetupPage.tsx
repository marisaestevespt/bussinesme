import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { GOOGLE_FONTS } from '@/lib/modules';
import { toast } from 'sonner';

const DEFAULT_COLORS = {
  primary: '222 47% 11%',
  secondary: '210 40% 96%',
  background: '0 0% 100%',
  text: '222 84% 5%',
};

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

export function SetupPage() {
  const { user } = useAuth();
  const { refetch } = useBusinessSettings();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [colors, setColors] = useState({
    primary: hslToHex(DEFAULT_COLORS.primary),
    secondary: hslToHex(DEFAULT_COLORS.secondary),
    background: hslToHex(DEFAULT_COLORS.background),
    text: hslToHex(DEFAULT_COLORS.text),
  });
  const [fontDisplay, setFontDisplay] = useState('Inter');
  const [fontBody, setFontBody] = useState('Inter');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessName.trim()) return;

    setLoading(true);
    try {
      // First, assign owner role to this user
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'owner' });

      // Upload logo if provided
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

      // Also link user to the Owner custom_role
      const { data: ownerRole } = await supabase
        .from('custom_roles')
        .select('id')
        .eq('is_owner', true)
        .single();

      if (ownerRole) {
        await supabase.from('members').insert({
          user_id: user.id,
          custom_role_id: ownerRole.id,
        });
      }

      // Save business settings
      const { error } = await supabase.from('business_settings').insert({
        business_name: businessName.trim(),
        logo_url: logoUrl,
        primary_color: hexToHsl(colors.primary),
        secondary_color: hexToHsl(colors.secondary),
        background_color: hexToHsl(colors.background),
        text_color: hexToHsl(colors.text),
        font_display: fontDisplay,
        font_body: fontBody,
      });

      if (error) throw error;

      toast.success('HQ configurado com sucesso!');
      await refetch();
      // Force reload to apply CSS variables
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center hq-surface-sunken p-4">
      <div className="hq-card w-full max-w-2xl p-8 md:p-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Configura o teu HQ
          </h1>
          <p className="mt-3 text-muted-foreground">
            Define a identidade visual do teu negócio. Podes alterar tudo mais tarde nas Definições.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Business Name */}
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

          {/* Logo upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted">
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="h-11"
              />
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Cores</Label>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['primary', 'Cor primária'],
                ['secondary', 'Cor secundária'],
                ['background', 'Fundo'],
                ['text', 'Texto'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => setColors(c => ({ ...c, [key]: e.target.value }))}
                      className="h-10 w-10 cursor-pointer rounded-md border-0 p-0"
                    />
                    <Input
                      value={colors[key]}
                      onChange={(e) => setColors(c => ({ ...c, [key]: e.target.value }))}
                      className="h-10 font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fonte para títulos</Label>
              <Select value={fontDisplay} onValueChange={setFontDisplay}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_FONTS.map(font => (
                    <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fonte para corpo</Label>
              <Select value={fontBody} onValueChange={setFontBody}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_FONTS.map(font => (
                    <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview strip */}
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
            <div
              className="flex items-center gap-3 rounded-md p-4"
              style={{ backgroundColor: colors.background }}
            >
              <div
                className="h-8 w-8 rounded-md"
                style={{ backgroundColor: colors.primary }}
              />
              <span
                style={{ color: colors.text, fontFamily: fontDisplay }}
                className="font-semibold"
              >
                HQ | {businessName || 'O Teu Negócio'}
              </span>
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading || !businessName.trim()}>
            {loading ? 'A configurar...' : 'Começar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
