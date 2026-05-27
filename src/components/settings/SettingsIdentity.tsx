import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { DISPLAY_FONTS, BODY_FONTS, MONO_FONTS, SYSTEM_FONT_MONO } from '@/lib/modules';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Palette, Type, Building2, Save, Trash2, ImageIcon } from 'lucide-react';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

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
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <div className="h-full w-full rounded-lg" style={{ backgroundColor: value }} />
        </label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 font-mono text-xs w-28" maxLength={7} />
      </div>
    </div>
  );
}

/* ── font selector ── */

function FontSelector({ label, value, onChange, fonts, customFonts }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fonts: readonly string[];
  customFonts: { font_name: string }[];
}) {
  const allFonts = [...customFonts.map(f => f.font_name), ...fonts];
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {customFonts.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Personalizadas</div>
              {customFonts.map(f => (
                <SelectItem key={f.font_name} value={f.font_name}>
                  <span style={{ fontFamily: `'${f.font_name}', sans-serif` }}>{f.font_name}</span>
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mt-1">Predefinidas</div>
            </>
          )}
          {fonts.map(font => (
            <SelectItem key={font} value={font}>
              <span style={{ fontFamily: `'${font}', sans-serif` }}>{font}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground leading-relaxed" style={{ fontFamily: `'${value}', system-ui, sans-serif` }}>
        O teu negócio merece uma identidade única.
      </p>
    </div>
  );
}

/* ── main component ── */

export function SettingsIdentity() {
  const { settings, refetch } = useBusinessSettings();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState('');
  
  const [supportHours, setSupportHours] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [useSystemTheme, setUseSystemTheme] = useState(true);
  const [colors, setColors] = useState({
    primary: '#1a1f36',
    secondary: '#f0f4f8',
    background: '#ffffff',
    text: '#0a0f1e',
    accent: '#808080',
  });
  const [fontDisplay, setFontDisplay] = useState('Cormorant Garamond');
  const [fontBody, setFontBody] = useState('DM Sans');
  const [fontMono, setFontMono] = useState<string>(SYSTEM_FONT_MONO);
  const [uploadingFont, setUploadingFont] = useState(false);

  // Custom fonts
  const { data: customFonts = [] } = useQuery({
    queryKey: ['custom-fonts'],
    queryFn: async () => {
      const { data } = await supabase.from('custom_fonts').select('*').order('created_at');
      return (data || []) as any[];
    },
  });

  // Inject @font-face for custom fonts
  useEffect(() => {
    customFonts.forEach((f: any) => {
      const id = `custom-font-${f.id}`;
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `@font-face { font-family: '${f.font_name}'; src: url('${f.font_url}'); font-display: swap; }`;
      document.head.appendChild(style);
    });
  }, [customFonts]);

  // Populate form from existing settings
  useEffect(() => {
    if (!settings) return;
    setBusinessName(settings.business_name);
    
    setSupportHours(settings.support_hours || '');
    setLogoPreview(settings.logo_url);
    setBgPreview(settings.login_bg_url || null);
    setUseSystemTheme(settings.use_system_theme ?? true);
    setColors({
      primary: hslToHex(settings.primary_color),
      secondary: hslToHex(settings.secondary_color),
      background: hslToHex(settings.background_color),
      text: hslToHex(settings.text_color),
      accent: hslToHex(settings.accent_color || '0 0% 50%'),
    });
    setFontDisplay(settings.font_display);
    setFontBody(settings.font_body);
    setFontMono(((settings as any).font_mono as string) || SYSTEM_FONT_MONO);
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setBgFile(file); setBgPreview(URL.createObjectURL(file)); }
  };

  const updateColor = (key: keyof typeof colors) => (value: string) =>
    setColors(c => ({ ...c, [key]: value }));

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) {
      toast.error('Formato inválido. Usa TTF, OTF, WOFF ou WOFF2.');
      return;
    }
    setUploadingFont(true);
    try {
      const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('custom-fonts').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('custom-fonts').getPublicUrl(path);
      const { error } = await supabase.from('custom_fonts').insert({ font_name: fontName, font_url: publicUrl, font_type: 'display' } as any);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['custom-fonts'] });
      toast.success(`Fonte "${fontName}" adicionada`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar fonte');
    } finally {
      setUploadingFont(false);
    }
  };

  const deleteFont = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('custom_fonts').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['custom-fonts'] });
    toast.success('Fonte removida');
  };

  const handleSave = async () => {
    if (!settings || !businessName.trim()) return;
    setSaving(true);
    try {
      let logoUrl: string | null = settings.logo_url;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const { data: { user } } = await supabase.auth.getUser();
        const path = `${user?.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
          logoUrl = `${publicUrl}?t=${Date.now()}`;
        }
      } else if (!logoPreview) {
        logoUrl = null;
      }

      // Upload login bg if changed
      let loginBgUrl = settings.login_bg_url || null;
      if (bgFile) {
        const ext = bgFile.name.split('.').pop();
        const { data: { user } } = await supabase.auth.getUser();
        const path = `${user?.id}/login-bg.${ext}`;
        const { error: bgErr } = await supabase.storage.from('logos').upload(path, bgFile, { upsert: true });
        if (!bgErr) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
          loginBgUrl = publicUrl;
        }
      } else if (!bgPreview) {
        loginBgUrl = null;
      }

      const { error } = await supabase
        .from('business_settings')
        .update({
          business_name: businessName.trim(),
          
          logo_url: logoUrl,
          login_bg_url: loginBgUrl,
          support_hours: supportHours.trim() || null,
          use_system_theme: useSystemTheme,
          primary_color: hexToHsl(colors.primary),
          secondary_color: hexToHsl(colors.secondary),
          background_color: hexToHsl(colors.background),
          text_color: hexToHsl(colors.text),
          accent_color: hexToHsl(colors.accent),
          font_display: fontDisplay,
          font_body: fontBody,
          font_mono: fontMono,
        } as any)
        .eq('id', settings.id);

      if (error) throw error;
      toast.success('Definições atualizadas!');
      await refetch();
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
          <Label htmlFor="settingsBusinessName" className="text-sm font-medium">Nome do negócio</Label>
          <Input id="settingsBusinessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="O nome do teu negócio" required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportHours" className="text-sm font-medium">Horário de atendimento</Label>
          <Input id="supportHours" value={supportHours} onChange={(e) => setSupportHours(e.target.value)} placeholder="Ex: Seg a Sex, 10h – 18h" className="h-11" />
          <p className="text-xs text-muted-foreground">Será visível no portal do cliente.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Logo</Label>
          <div className="flex items-center gap-4">
            <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/50 hover:bg-muted/50 overflow-hidden transition-colors">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground/50" />
              )}
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <div className="text-xs text-muted-foreground">
              <p>Arrasta ou clica para carregar</p>
              <p className="mt-0.5">PNG, JPG ou SVG</p>
              {logoPreview && (
                <button type="button" className="mt-1 text-destructive hover:underline text-xs" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
                  Remover logo
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Cores da Marca (5) ── */}
      <Section icon={Palette} title="Cores da Marca">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Usar tema do sistema (Lyrata)</Label>
            <p className="text-xs text-muted-foreground">Usa a paleta predefinida do sistema. Desativa para personalizar as cores.</p>
          </div>
          <Switch checked={useSystemTheme} onCheckedChange={setUseSystemTheme} />
        </div>

        {!useSystemTheme && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ColorField label="Cor primária" value={colors.primary} onChange={updateColor('primary')} />
            <ColorField label="Cor secundária" value={colors.secondary} onChange={updateColor('secondary')} />
            <ColorField label="Cor de destaque" value={colors.accent} onChange={updateColor('accent')} />
            <ColorField label="Fundo" value={colors.background} onChange={updateColor('background')} />
            <ColorField label="Texto" value={colors.text} onChange={updateColor('text')} />
          </div>
        )}

        {/* Login background */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fundo da página de login</Label>
          <div className="flex items-center gap-4">
            <label className="flex h-20 w-32 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hq-transition hover:border-muted-foreground/50 hover:bg-muted/50 overflow-hidden">
              {bgPreview ? (
                <img src={bgPreview} alt="Login bg" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
              )}
              <input type="file" accept="image/*" onChange={handleBgChange} className="hidden" />
            </label>
            <div className="text-xs text-muted-foreground">
              <p>Imagem de fundo para a página de login</p>
              <p className="mt-0.5">Recomendado: 1920×1080 ou superior</p>
              {bgPreview && (
                <button type="button" className="mt-1 text-destructive hover:underline text-xs" onClick={() => { setBgFile(null); setBgPreview(null); }}>
                  Remover fundo
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Tipografia ── */}
      <Section icon={Type} title="Tipografia">
        {useSystemTheme && (
          <div className="p-3 rounded-xl bg-muted/50 border">
            <p className="text-sm text-muted-foreground">
              O tema do sistema usa <strong>Sora</strong> para títulos e <strong>Inter</strong> para corpo de texto.
              Desativa o tema do sistema nas cores para personalizar as fontes.
            </p>
          </div>
        )}

        {!useSystemTheme && (
          <>
            <div className="grid grid-cols-2 gap-6">
              <FontSelector label="Fonte para títulos" value={fontDisplay} onChange={setFontDisplay} fonts={DISPLAY_FONTS} customFonts={customFonts} />
              <FontSelector label="Fonte para corpo" value={fontBody} onChange={setFontBody} fonts={BODY_FONTS} customFonts={customFonts} />
            </div>

            {/* Custom font upload */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Fontes personalizadas</Label>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingFont}>
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      {uploadingFont ? 'A carregar...' : 'Carregar fonte'}
                    </span>
                  </Button>
                  <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">Formatos suportados: TTF, OTF, WOFF, WOFF2</p>
              {customFonts.length > 0 && (
                <div className="space-y-1">
                  {customFonts.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                      <span className="text-sm" style={{ fontFamily: `'${f.font_name}', sans-serif` }}>{f.font_name}</span>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFont(f.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
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
            <span style={{ color: colors.text, fontFamily: `'${fontDisplay}', 'Sora', system-ui, sans-serif` }} className="text-lg font-semibold">
              Sistema Lyrata® · {businessName || 'O Teu Negócio'}
            </span>
          </div>
          <p className="mt-3 text-sm" style={{ color: colors.text, fontFamily: `'${fontBody}', 'Inter', system-ui, sans-serif`, opacity: 0.7 }}>
            Esta é uma amostra do texto do corpo com a fonte selecionada.
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium text-white" style={{ backgroundColor: colors.primary }}>Primário</div>
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium border" style={{ backgroundColor: colors.secondary, color: colors.text }}>Secundário</div>
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium text-white" style={{ backgroundColor: colors.accent }}>Destaque</div>
          </div>
          {/* Color swatches */}
          <div className="flex gap-2 mt-4">
            {Object.entries(colors).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="h-10 w-10 rounded-lg border shadow-sm" style={{ backgroundColor: val }} />
                <span className="text-[9px] text-muted-foreground mt-1 block capitalize">{key === 'text' ? 'Texto' : key === 'background' ? 'Fundo' : key === 'accent' ? 'Destaque' : key === 'primary' ? 'Primária' : 'Secundária'}</span>
              </div>
            ))}
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
