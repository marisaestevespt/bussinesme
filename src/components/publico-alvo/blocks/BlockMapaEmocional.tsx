import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '../EditableText';
import { AddButton, EditableStringList, SectionLabel, SubBlock, STRONG_CARD } from './shared';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapaEmocionalData {
  pensa: string[];
  sente: string[];
  faz: string[];
  quer: string[];
  palavrasProblema: string[];
  palavrasQuer: string[];
  glossario: { termo: string; definicao: string }[];
}

const PANELS = [
  { key: 'pensa' as const, label: 'O que ela pensa', tint: 'bg-info/10 border-info/30' },
  { key: 'sente' as const, label: 'O que ela sente', tint: 'bg-warning/10 border-warning/30' },
  { key: 'faz' as const, label: 'O que ela faz hoje', tint: 'bg-destructive/10 border-destructive/30' },
  { key: 'quer' as const, label: 'O que ela quer', tint: 'bg-success/10 border-success/30' },
];

export function BlockMapaEmocional({
  data,
  onChange,
}: {
  data: MapaEmocionalData;
  onChange: (d: MapaEmocionalData) => void;
}) {
  const update = (patch: Partial<MapaEmocionalData>) => onChange({ ...data, ...patch });

  const updateGloss = (i: number, patch: Partial<MapaEmocionalData['glossario'][number]>) => {
    const next = [...(data.glossario || [])];
    next[i] = { ...next[i], ...patch };
    update({ glossario: next });
  };
  const deleteGloss = (i: number) => update({ glossario: (data.glossario || []).filter((_, idx) => idx !== i) });
  const addGloss = () => update({ glossario: [...(data.glossario || []), { termo: 'TERMO', definicao: '' }] });

  return (
    <div className="space-y-8">
      {/* 2x2 emotional panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PANELS.map((p) => (
          <Card key={p.key} className={cn("border-2 shadow-card hover:shadow-elegant transition-all", p.tint)}>
            <CardContent className="p-4">
              <SectionLabel>{p.label}</SectionLabel>
              <EditableStringList
                items={(data[p.key] as string[]) || []}
                onChange={(next) => update({ [p.key]: next } as Partial<MapaEmocionalData>)}
                addLabel="Adicionar"
                placeholder="Novo"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Palavras exatas */}
      <SubBlock title="Palavras exatas que usa">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'palavrasProblema' as const, label: 'Para descrever o problema' },
            { key: 'palavrasQuer' as const, label: 'Para descrever o que quer' },
          ].map((col) => (
            <div key={col.key}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">{col.label}</p>
              <PhraseList
                items={(data[col.key] as string[]) || []}
                onChange={(next) => update({ [col.key]: next } as Partial<MapaEmocionalData>)}
              />
            </div>
          ))}
        </div>
      </SubBlock>

      {/* Glossário */}
      <SubBlock title="Glossário">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.glossario || []).map((g, i) => (
            <Card key={i} className={cn("group relative", STRONG_CARD)}>
              <button
                onClick={() => deleteGloss(i)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10 transition-opacity"
                aria-label="Eliminar termo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <CardContent className="p-3">
                <EditableText
                  value={g.termo}
                  onSave={(v) => updateGloss(i, { termo: (v || '').toUpperCase() })}
                  className="text-[11px] font-semibold tracking-[0.12em] text-primary mb-1.5"
                />
                <EditableText
                  value={g.definicao}
                  onSave={(v) => updateGloss(i, { definicao: v })}
                  multiline
                  placeholder="Definição..."
                  className="text-xs text-foreground leading-relaxed min-h-[2em]"
                />
              </CardContent>
            </Card>
          ))}
        </div>
        <AddButton onClick={addGloss} label="Adicionar termo" />
      </SubBlock>
    </div>
  );
}

function PhraseList({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, 'Nova frase']);
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="group relative pl-3 border-l-2 border-primary/40">
          <button
            onClick={() => del(i)}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
            aria-label="Eliminar frase"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <EditableText
            value={it}
            onSave={(v) => update(i, v)}
            multiline
            className="text-xs text-foreground italic leading-relaxed"
          />
        </div>
      ))}
      <AddButton onClick={add} label="Adicionar frase" />
    </div>
  );
}