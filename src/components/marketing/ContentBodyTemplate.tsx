import { memo, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';

// Template structures per format
export type TemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image-placeholder' | 'checklist';
  placeholder?: string;
  items?: string[]; // for checklist
};

const CAROUSEL_MAX_SLIDES = 20;
const STORIES_MAX_SLIDES = 20;
const DEFAULT_CAROUSEL_SLIDES = 2;
const DEFAULT_STORIES_SLIDES = 2;

function getTemplateFields(format: string, slideCount?: number): TemplateField[] {
  switch (format) {
    case 'carrossel':
      {
        const count = Math.min(Math.max(slideCount ?? DEFAULT_CAROUSEL_SLIDES, 1), CAROUSEL_MAX_SLIDES);
        return [
          { key: 'capa', label: 'CAPA', type: 'image-placeholder' },
          ...Array.from({ length: count - 1 }, (_, i) => ({
            key: `imagem_${i + 2}`,
            label: `IMAGEM ${i + 2}`,
            type: 'image-placeholder' as const,
          })),
          { key: 'legenda', label: 'Legenda:', type: 'textarea', placeholder: 'Escreve a legenda do carrossel...' },
        ];
      }

    case 'stories':
      {
        const count = Math.min(Math.max(slideCount ?? DEFAULT_STORIES_SLIDES, 1), STORIES_MAX_SLIDES);
        return Array.from({ length: count }, (_, i) => ({
          key: `story_${i + 1}`,
          label: `STORY ${i + 1}`,
          type: 'image-placeholder' as const,
        }));
      }

    case 'carrossel_legacy_unused':
      return [
        { key: 'capa', label: 'CAPA', type: 'image-placeholder' },
        ...Array.from({ length: CAROUSEL_MAX_SLIDES - 1 }, (_, i) => ({
          key: `imagem_${i + 2}`,
          label: `IMAGEM ${i + 2}`,
          type: 'image-placeholder' as const,
        })),
        { key: 'legenda', label: 'Legenda:', type: 'textarea', placeholder: 'Escreve a legenda do carrossel...' },
      ];

    case 'estatico':
      return [
        { key: 'capa', label: 'CAPA', type: 'image-placeholder' },
        { key: 'legenda', label: 'Legenda:', type: 'textarea', placeholder: 'Escreve a legenda do post...' },
      ];

    case 'reels':
    case 'short_tiktok':
    case 'vlog':
    case 'longo_youtube':
      return [
        { key: 'checklist', label: 'Checklist: antes de cada vídeo:', type: 'checklist', items: [
          'Iluminação OK', 'Áudio OK', 'Enquadramento OK', 'Cenário arrumado', 'Guião revisto',
        ]},
        { key: 'hook', label: 'Hook:', type: 'textarea', placeholder: 'O gancho inicial do vídeo...' },
        { key: 'script', label: 'Script de vídeo', type: 'textarea', placeholder: 'Escreve o script/guião...' },
        { key: 'legenda', label: 'Legenda:', type: 'textarea', placeholder: 'Escreve a legenda...' },
      ];

    case 'email':
      return [
        { key: 'checklist', label: 'Checklist: antes de enviar', type: 'checklist', items: [
          'Assunto testado (A/B se possível)', 'Pré-header coerente', 'Links revistos', 'Imagens com alt text', 'CTA claro e único', 'Versão mobile testada',
        ]},
        { key: 'assunto', label: 'Assunto:', type: 'text', placeholder: 'Linha de assunto do email...' },
        { key: 'preheader', label: 'Pré-header:', type: 'text', placeholder: 'Texto curto que aparece junto ao assunto...' },
        { key: 'intro', label: 'Intro / abertura:', type: 'textarea', placeholder: 'Primeiras linhas que captam atenção...' },
        { key: 'corpo', label: 'Corpo do email:', type: 'textarea', placeholder: 'Conteúdo principal do email...' },
        { key: 'cta', label: 'CTA (Call to Action):', type: 'text', placeholder: 'Ex: Saber mais, Comprar agora...' },
        { key: 'ps', label: 'P.S.:', type: 'textarea', placeholder: 'Pós-escrito (opcional, costuma ter alta taxa de leitura)...' },
      ];

    case 'post_linkedin':
      return [
        { key: 'capa', label: 'IMAGEM / DOCUMENTO', type: 'image-placeholder' },
        { key: 'hook', label: 'Hook:', type: 'text', placeholder: 'Primeira frase que capta atenção...' },
        { key: 'corpo', label: 'Corpo do post:', type: 'textarea', placeholder: 'Conteúdo do post...' },
        { key: 'cta', label: 'CTA:', type: 'text', placeholder: 'Call to action...' },
        { key: 'hashtags', label: 'Hashtags:', type: 'text', placeholder: '#exemplo #marketing ...' },
      ];

    case 'pin':
      return [
        { key: 'capa', label: 'IMAGEM DO PIN', type: 'image-placeholder' },
        { key: 'titulo', label: 'Título do Pin:', type: 'text', placeholder: 'Título SEO do pin...' },
        { key: 'descricao', label: 'Descrição:', type: 'textarea', placeholder: 'Descrição do pin...' },
        { key: 'link', label: 'Link destino:', type: 'text', placeholder: 'https://...' },
        { key: 'tags', label: 'Tags / palavras-chave:', type: 'text', placeholder: 'Termos de pesquisa relevantes...' },
      ];

    default:
      return [
        { key: 'conteudo', label: 'Conteúdo:', type: 'textarea', placeholder: 'Escreve o conteúdo...' },
        { key: 'notas', label: 'Notas:', type: 'textarea', placeholder: 'Notas internas, referências, links...' },
      ];
  }
}

interface ContentBodyTemplateProps {
  format: string;
  value: Record<string, any> | null;
  onChange: (value: Record<string, any>) => void;
  editable?: boolean;
}

function ContentBodyTemplateInner({ format, value, onChange, editable = true }: ContentBodyTemplateProps) {
  // Internal state buffers fast keystrokes; we only push to parent (heavy re-render) after a debounce.
  const [data, setData] = useState<Record<string, any>>(value || {});
  const debounceRef = useRef<number | null>(null);
  const dataRef = useRef(data);
  const lastExternalRef = useRef<string>(JSON.stringify(value || {}));

  // Determine current slide count for variable-slide formats. Stored in `_slide_count`
  // so it persists per content item. Falls back to inferring from existing keys
  // (legacy items saved with 20 slots) or to the format default.
  const inferSlideCount = (): number | undefined => {
    if (format === 'carrossel') {
      const stored = Number(data._slide_count);
      if (Number.isFinite(stored) && stored >= 1) return stored;
      // Infer from existing non-empty image keys
      const used = [1, ...Array.from({ length: CAROUSEL_MAX_SLIDES - 1 }, (_, i) => i + 2)]
        .filter(n => {
          const key = n === 1 ? 'capa' : `imagem_${n}`;
          const v = data[key];
          return typeof v === 'string' && v.trim().length > 0;
        });
      if (used.length > 0) return Math.max(...used, DEFAULT_CAROUSEL_SLIDES);
      return DEFAULT_CAROUSEL_SLIDES;
    }
    if (format === 'stories') {
      const stored = Number(data._slide_count);
      if (Number.isFinite(stored) && stored >= 1) return stored;
      const used = Array.from({ length: STORIES_MAX_SLIDES }, (_, i) => i + 1).filter(n => {
        const v = data[`story_${n}`];
        return typeof v === 'string' && v.trim().length > 0;
      });
      if (used.length > 0) return Math.max(...used, DEFAULT_STORIES_SLIDES);
      return DEFAULT_STORIES_SLIDES;
    }
    return undefined;
  };

  const slideCount = inferSlideCount();
  const fields = getTemplateFields(format, slideCount);
  const isVariableSlideFormat = format === 'carrossel' || format === 'stories';
  const maxSlides = format === 'carrossel' ? CAROUSEL_MAX_SLIDES : STORIES_MAX_SLIDES;

  // Re-sync from outside when the value prop changes meaningfully (e.g. after load).
  useEffect(() => {
    const incoming = JSON.stringify(value || {});
    if (incoming !== lastExternalRef.current && incoming !== JSON.stringify(dataRef.current)) {
      lastExternalRef.current = incoming;
      setData(value || {});
      dataRef.current = value || {};
    }
  }, [value]);

  useEffect(() => () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      onChange(dataRef.current);
    }
  }, [onChange]);

  const scheduleFlush = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      lastExternalRef.current = JSON.stringify(dataRef.current);
      onChange(dataRef.current);
    }, 400);
  };

  const updateField = (key: string, val: any) => {
    const next = { ...dataRef.current, [key]: val };
    dataRef.current = next;
    setData(next);
    scheduleFlush();
  };

  const setSlideCount = (n: number) => {
    const next = { ...dataRef.current, _slide_count: n };
    dataRef.current = next;
    setData(next);
    scheduleFlush();
  };

  const addSlide = () => {
    if (!isVariableSlideFormat) return;
    const current = slideCount ?? (format === 'carrossel' ? DEFAULT_CAROUSEL_SLIDES : DEFAULT_STORIES_SLIDES);
    if (current >= maxSlides) return;
    setSlideCount(current + 1);
  };

  const removeSlideAt = (index: number) => {
    if (!isVariableSlideFormat) return;
    const current = slideCount ?? 1;
    if (current <= 1) return;
    // Shift content down: for index i (1-based), copy i+1 → i, i+2 → i+1, etc.
    const next = { ...dataRef.current };
    const keyAt = (n: number) => {
      if (format === 'carrossel') return n === 1 ? 'capa' : `imagem_${n}`;
      return `story_${n}`;
    };
    for (let i = index; i < current; i++) {
      next[keyAt(i)] = dataRef.current[keyAt(i + 1)] ?? '';
    }
    delete next[keyAt(current)];
    next._slide_count = current - 1;
    dataRef.current = next;
    setData(next);
    scheduleFlush();
  };

  const toggleChecklistItem = (key: string, item: string) => {
    const current: string[] = dataRef.current[`${key}_checked`] || [];
    const updated = current.includes(item)
      ? current.filter((i: string) => i !== item)
      : [...current, item];
    const next = { ...dataRef.current, [`${key}_checked`]: updated };
    dataRef.current = next;
    setData(next);
    scheduleFlush();
  };

  if (!format) return null;

  const renderField = (field: TemplateField) => {
    if (field.type === 'text') {
      return editable ? (
        <Input
          value={data[field.key] || ''}
          onChange={e => updateField(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="h-11 text-base border-0 border-b border-border rounded-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary"
        />
      ) : (
        <p className="text-base">{data[field.key] || <span className="text-muted-foreground italic">Vazio</span>}</p>
      );
    }
    if (field.type === 'textarea') {
      return (
        <RichTextEditor
          content={data[field.key] || ''}
          onChange={(v) => updateField(field.key, v)}
          editable={editable}
          placeholder={field.placeholder}
          minHeight={160}
          collapsibleToolbar
        />
      );
    }
    if (field.type === 'checklist') {
      return (
        <div className="space-y-2">
          {(field.items || []).map(item => {
            const checked = (data[`${field.key}_checked`] || []).includes(item);
            return (
              <label key={item} className={cn(
                "flex items-center gap-3 text-sm cursor-pointer",
                checked && "line-through text-muted-foreground"
              )}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => editable && toggleChecklistItem(field.key, item)}
                  disabled={!editable}
                />
                {item}
              </label>
            );
          })}
        </div>
      );
    }
    if (field.type === 'image-placeholder') {
      return (
        <RichTextEditor
          content={data[field.key] || ''}
          onChange={(v) => updateField(field.key, v)}
          editable={editable}
          placeholder={`Escreve o copy / cola a imagem para ${field.label.toLowerCase()}...`}
          minHeight={140}
          enableImages
          collapsibleToolbar
        />
      );
    }
    return null;
  };

  // Agrupa: slides (image-placeholder) num único card "Slides do post",
  // restantes campos (legenda, hook, etc.) cada um no seu card.
  const slideFields = fields.filter(f => f.type === 'image-placeholder');
  const otherFields = fields.filter(f => f.type !== 'image-placeholder');
  const slidesSectionTitle = slideFields.length === 1 ? 'Capa do post' : 'Slides do post';
  const slidesSectionHint = slideFields.length === 1
    ? '— copy / notas para a imagem de capa'
    : '— um bloco por slide; cada um tem editor completo';

  return (
    <div className="space-y-4">
      {slideFields.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-semibold text-foreground">{slidesSectionTitle}</label>
            <span className="text-xs text-muted-foreground">{slidesSectionHint}</span>
            {isVariableSlideFormat && editable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto h-7 gap-1 text-xs"
                onClick={addSlide}
                disabled={(slideCount ?? 0) >= maxSlides}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar slide
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {slideFields.map((field, idx) => (
              <div key={field.key} className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {field.label}
                  </label>
                  {isVariableSlideFormat && editable && slideFields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSlideAt(idx + 1)}
                      title="Remover slide"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      )}

      {otherFields.map(field => (
        <div
          key={field.key}
          className="rounded-xl border border-border/60 bg-card px-5 py-4 space-y-3"
        >
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {field.label.replace(/:$/, '')}
          </label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}

function AutoGrowTextarea({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[140px] text-base leading-relaxed resize-none border-0 bg-muted/20 rounded-md px-4 py-3 focus-visible:ring-1 focus-visible:ring-primary/30"
    />
  );
}

export const ContentBodyTemplate = memo(ContentBodyTemplateInner, (prev, next) => {
  // Re-render only when format/editable change, or when the external value identity changes.
  // This prevents heavy re-mounts of the Tiptap editor on every parent re-render.
  return (
    prev.format === next.format &&
    prev.editable === next.editable &&
    prev.value === next.value &&
    prev.onChange === next.onChange
  );
});

function ImageBlock({
  label, value, onChange, editable,
}: { label: string; value: string; onChange: (v: string) => void; editable: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      </div>
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/10 p-2 min-h-[120px]">
        <RichTextEditor
          content={value || ''}
          onChange={onChange}
          editable={editable}
          placeholder={`Notas, copy ou descrição para ${label.toLowerCase()}...`}
          minHeight={100}
        />
      </div>
    </div>
  );
}
