import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { DISPLAY_FONTS, BODY_FONTS } from '@/lib/modules';

type CustomFont = { id: string; font_name: string; font_url: string };

/** Loaded Google Fonts cache to avoid duplicate <link> injections. */
const loadedGoogleFonts = new Set<string>();
/** Loaded custom @font-face cache. */
const loadedCustomFonts = new Set<string>();

function ensureGoogleFont(family: string) {
  if (!family || loadedGoogleFonts.has(family)) return;
  const id = `gf-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) { loadedGoogleFonts.add(family); return; }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedGoogleFonts.add(family);
}

function ensureCustomFont(family: string, url: string) {
  if (!family || loadedCustomFonts.has(family)) return;
  const id = `cf-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) { loadedCustomFonts.add(family); return; }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@font-face { font-family: '${family}'; src: url('${url}'); font-display: swap; }`;
  document.head.appendChild(style);
  loadedCustomFonts.add(family);
}

interface Props {
  label: string;
  value: string | undefined;
  onChange: (next: string) => void;
  /** Show "display" or "body" curated set first. Defaults to "display". */
  variant?: 'display' | 'body';
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** Optional callback when user clears the value (Use o padrão). */
  onClear?: () => void;
  disabled?: boolean;
}

export function BrandFontPicker({ label, value, onChange, variant = 'display', placeholder = 'Usar padrão', onClear, disabled }: Props) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: customFonts = [] } = useQuery({
    queryKey: ['custom-fonts'],
    queryFn: async () => {
      const { data } = await supabase.from('custom_fonts').select('*').order('created_at');
      return (data || []) as CustomFont[];
    },
    staleTime: 60_000,
  });

  // Preload current value so the dropdown trigger shows the actual font.
  useEffect(() => {
    if (!value) return;
    const custom = customFonts.find(f => f.font_name === value);
    if (custom) ensureCustomFont(custom.font_name, custom.font_url);
    else ensureGoogleFont(value);
  }, [value, customFonts]);

  // Preload curated fonts so dropdown options render in their own typeface.
  useEffect(() => {
    [...DISPLAY_FONTS, ...BODY_FONTS].forEach(ensureGoogleFont);
    customFonts.forEach(f => ensureCustomFont(f.font_name, f.font_url));
  }, [customFonts]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) {
      toast.error('Formato inválido. Usa TTF, OTF, WOFF ou WOFF2.');
      return;
    }
    setUploading(true);
    try {
      const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const path = `${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('custom-fonts').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('custom-fonts').getPublicUrl(path);
      const { error } = await supabase.from('custom_fonts').insert({ font_name: fontName, font_url: publicUrl, font_type: variant } as any);
      if (error) throw error;
      ensureCustomFont(fontName, publicUrl);
      qc.invalidateQueries({ queryKey: ['custom-fonts'] });
      onChange(fontName);
      toast.success(`Fonte "${fontName}" adicionada`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar fonte');
    } finally {
      setUploading(false);
    }
  };

  const primary = variant === 'body' ? BODY_FONTS : DISPLAY_FONTS;
  const secondary = variant === 'body' ? DISPLAY_FONTS : BODY_FONTS;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {value && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <X className="h-3 w-3" /> usar padrão
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-9 text-sm flex-1" style={value ? { fontFamily: `'${value}', sans-serif` } : undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {customFonts.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Personalizadas</div>
                {customFonts.map(f => (
                  <SelectItem key={f.font_name} value={f.font_name}>
                    <span style={{ fontFamily: `'${f.font_name}', sans-serif` }}>{f.font_name}</span>
                  </SelectItem>
                ))}
              </>
            )}
            <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
              {variant === 'body' ? 'Para corpo de texto' : 'Para títulos'}
            </div>
            {primary.map(f => (
              <SelectItem key={f} value={f}>
                <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
              </SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
              {variant === 'body' ? 'Para títulos' : 'Para corpo'}
            </div>
            {secondary.map(f => (
              <SelectItem key={f} value={f}>
                <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!disabled && (
          <label>
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              onChange={handleUpload}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild className="h-9">
              <span className="cursor-pointer">
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? '...' : 'Upload'}
              </span>
            </Button>
          </label>
        )}
      </div>
    </div>
  );
}