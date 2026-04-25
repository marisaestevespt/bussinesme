import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Template structures per format
export type TemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image-placeholder' | 'checklist';
  placeholder?: string;
  items?: string[]; // for checklist
};

const CAROUSEL_MAX_SLIDES = 20;

function getTemplateFields(format: string): TemplateField[] {
  switch (format) {
    case 'carrossel':
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

    case 'stories':
      return [
        ...Array.from({ length: 10 }, (_, i) => ({
          key: `story_${i + 1}`,
          label: `STORY ${i + 1}`,
          type: 'image-placeholder' as const,
        })),
        { key: 'notas', label: 'Notas:', type: 'textarea', placeholder: 'Notas sobre os stories...' },
      ];

    case 'email':
      return [
        { key: 'assunto', label: 'Assunto:', type: 'text', placeholder: 'Linha de assunto do email...' },
        { key: 'cabecalho', label: 'Cabeçalho:', type: 'text', placeholder: 'Pré-header / cabeçalho...' },
        { key: 'corpo', label: 'Corpo do email:', type: 'textarea', placeholder: 'Conteúdo do email...' },
        { key: 'cta', label: 'CTA (Call to Action):', type: 'text', placeholder: 'Ex: Saber mais, Comprar agora...' },
      ];

    case 'post_linkedin':
      return [
        { key: 'hook', label: 'Hook:', type: 'text', placeholder: 'Primeira frase que capta atenção...' },
        { key: 'corpo', label: 'Corpo do post:', type: 'textarea', placeholder: 'Conteúdo do post...' },
        { key: 'cta', label: 'CTA:', type: 'text', placeholder: 'Call to action...' },
        { key: 'capa', label: 'IMAGEM/DOCUMENTO', type: 'image-placeholder' },
      ];

    case 'pin':
      return [
        { key: 'capa', label: 'IMAGEM DO PIN', type: 'image-placeholder' },
        { key: 'titulo', label: 'Título do Pin:', type: 'text', placeholder: 'Título SEO do pin...' },
        { key: 'descricao', label: 'Descrição:', type: 'textarea', placeholder: 'Descrição do pin...' },
        { key: 'link', label: 'Link destino:', type: 'text', placeholder: 'https://...' },
      ];

    default:
      return [
        { key: 'conteudo', label: 'Conteúdo:', type: 'textarea', placeholder: 'Escreve o conteúdo...' },
      ];
  }
}

interface ContentBodyTemplateProps {
  format: string;
  value: Record<string, any> | null;
  onChange: (value: Record<string, any>) => void;
  editable?: boolean;
}

export function ContentBodyTemplate({ format, value, onChange, editable = true }: ContentBodyTemplateProps) {
  const fields = getTemplateFields(format);
  const data = value || {};

  const updateField = (key: string, val: any) => {
    onChange({ ...data, [key]: val });
  };

  const toggleChecklistItem = (key: string, item: string) => {
    const current: string[] = data[`${key}_checked`] || [];
    const updated = current.includes(item)
      ? current.filter((i: string) => i !== item)
      : [...current, item];
    onChange({ ...data, [`${key}_checked`]: updated });
  };

  if (!format) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Template de Conteúdo</h3>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        {fields.map((field, idx) => (
          <div key={field.key}>
            {field.type === 'image-placeholder' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">{field.label}</label>
                <div className="h-10 rounded border border-dashed border-muted-foreground/30 bg-muted/20 flex items-center px-3">
                  {editable ? (
                    <Input
                      value={data[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder={`Notas para ${field.label.toLowerCase()}...`}
                      className="border-0 bg-transparent h-8 px-0 text-sm focus-visible:ring-0"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">{data[field.key] || ''}</span>
                  )}
                </div>
              </div>
            )}

            {field.type === 'text' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-primary uppercase tracking-wide">{field.label}</label>
                {editable ? (
                  <Input
                    value={data[field.key] || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="h-9 text-sm"
                  />
                ) : (
                  <p className="text-sm">{data[field.key] || <span className="text-muted-foreground italic">Vazio</span>}</p>
                )}
              </div>
            )}

            {field.type === 'textarea' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-primary uppercase tracking-wide">{field.label}</label>
                {editable ? (
                  <Textarea
                    value={data[field.key] || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-[80px] text-sm resize-y"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{data[field.key] || <span className="text-muted-foreground italic">Vazio</span>}</p>
                )}
              </div>
            )}

            {field.type === 'checklist' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase tracking-wide">▸ {field.label}</label>
                <div className="space-y-2 pl-2">
                  {(field.items || []).map(item => {
                    const checked = (data[`${field.key}_checked`] || []).includes(item);
                    return (
                      <label key={item} className={cn(
                        "flex items-center gap-2 text-sm cursor-pointer",
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
              </div>
            )}

            {idx < fields.length - 1 && field.type !== 'image-placeholder' && (
              <Separator className="mt-3" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
