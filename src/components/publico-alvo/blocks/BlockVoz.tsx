import { EditableText } from '../EditableText';
import { AddButton, SectionLabel, SubBlock } from './shared';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface VozData {
  tom: { tags: string[]; notas: string };
  frases: { frase: string; contexto: string }[];
  canais: { chips: { label: string; active: boolean }[]; notas: string };
}

export function BlockVoz({ data, onChange }: { data: VozData; onChange: (d: VozData) => void }) {
  const update = (patch: Partial<VozData>) => onChange({ ...data, ...patch });

  // Tom
  const updateTag = (i: number, v: string) => {
    const tags = [...data.tom.tags];
    tags[i] = v;
    update({ tom: { ...data.tom, tags } });
  };
  const deleteTag = (i: number) => update({ tom: { ...data.tom, tags: data.tom.tags.filter((_, idx) => idx !== i) } });
  const addTag = () => update({ tom: { ...data.tom, tags: [...data.tom.tags, 'Novo tom'] } });

  // Frases
  const updateFrase = (i: number, patch: Partial<{ frase: string; contexto: string }>) => {
    const frases = [...data.frases];
    frases[i] = { ...frases[i], ...patch };
    update({ frases });
  };
  const deleteFrase = (i: number) => update({ frases: data.frases.filter((_, idx) => idx !== i) });
  const addFrase = () => update({ frases: [...data.frases, { frase: 'Nova frase de posicionamento', contexto: '' }] });

  // Canais
  const toggleChip = (i: number) => {
    const chips = data.canais.chips.map((c, idx) => (idx === i ? { ...c, active: !c.active } : c));
    update({ canais: { ...data.canais, chips } });
  };
  const editChip = (i: number, label: string) => {
    const chips = [...data.canais.chips];
    chips[i] = { ...chips[i], label };
    update({ canais: { ...data.canais, chips } });
  };
  const deleteChip = (i: number) =>
    update({ canais: { ...data.canais, chips: data.canais.chips.filter((_, idx) => idx !== i) } });
  const addChip = () =>
    update({ canais: { ...data.canais, chips: [...data.canais.chips, { label: 'Novo canal', active: false }] } });

  return (
    <div className="space-y-10">
      {/* Tom */}
      <SubBlock title="Tom de comunicação">
        <div className="flex flex-wrap gap-2">
          {data.tom.tags.map((t, i) => (
            <span
              key={i}
              className="group inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              <EditableText value={t} onSave={(v) => updateTag(i, v)} as="span" className="bg-transparent" />
              <button
                onClick={() => deleteTag(i)}
                className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                aria-label="Eliminar tom"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={addTag}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-primary/40 text-primary/70 hover:text-primary hover:border-primary text-xs transition-colors"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <div className="mt-4">
          <SectionLabel>Notas</SectionLabel>
          <EditableText
            value={data.tom.notas}
            onSave={(v) => update({ tom: { ...data.tom, notas: v } })}
            multiline
            placeholder="Notas sobre o tom..."
            className="text-xs text-foreground leading-relaxed min-h-[2em]"
          />
        </div>
      </SubBlock>

      {/* Frases de posicionamento */}
      <SubBlock title="Frases de posicionamento">
        <div className="space-y-3">
          {data.frases.map((f, i) => (
            <Card key={i} className="group relative">
              <button
                onClick={() => deleteFrase(i)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10 transition-opacity"
                aria-label="Eliminar frase"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <CardContent className="p-4">
                <EditableText
                  value={f.frase}
                  onSave={(v) => updateFrase(i, { frase: v })}
                  multiline
                  className="text-base font-semibold text-foreground leading-snug"
                />
                <EditableText
                  value={f.contexto}
                  onSave={(v) => updateFrase(i, { contexto: v })}
                  multiline
                  placeholder="Contexto / onde usar..."
                  className="text-xs text-muted-foreground mt-2 leading-relaxed min-h-[1em]"
                />
              </CardContent>
            </Card>
          ))}
          <AddButton onClick={addFrase} label="Adicionar frase" />
        </div>
      </SubBlock>

      {/* Canais */}
      <SubBlock title="Canais e contexto">
        <div className="flex flex-wrap gap-2">
          {data.canais.chips.map((c, i) => (
            <span
              key={i}
              className={cn(
                'group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                c.active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40',
              )}
              onClick={() => toggleChip(i)}
            >
              <EditableText
                as="span"
                value={c.label}
                onSave={(v) => editChip(i, v)}
                className="bg-transparent"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChip(i);
                }}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                aria-label="Eliminar canal"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={addChip}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-primary/40 text-primary/70 hover:text-primary hover:border-primary text-xs transition-colors"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <div className="mt-4">
          <SectionLabel>Comportamento por canal</SectionLabel>
          <EditableText
            value={data.canais.notas}
            onSave={(v) => update({ canais: { ...data.canais, notas: v } })}
            multiline
            placeholder="Como ela se comporta em cada canal..."
            className="text-xs text-foreground leading-relaxed min-h-[3em]"
          />
        </div>
      </SubBlock>
    </div>
  );
}