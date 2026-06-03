import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '../EditableText';
import { AddButton, EditableStringList, SectionLabel } from './shared';
import { Trash2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Persona {
  id: string;
  letter: string;
  name: string;
  role: string;
  isMain: boolean;
  quem: string;
  dores: string[];
  gatilho: string[];
  tentou: string[];
  ouvir: string;
}

export interface PersonasData { items: Persona[] }

const newId = () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function BlockPersonas({ data, onChange }: { data: PersonasData; onChange: (d: PersonasData) => void }) {
  const items = data.items ?? [];

  const updateP = (i: number, patch: Partial<Persona>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange({ items: next });
  };
  const deleteP = (i: number) => onChange({ items: items.filter((_, idx) => idx !== i) });
  const addP = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const used = new Set(items.map((p) => p.letter));
    const letter = [...letters].find((l) => !used.has(l)) || '?';
    onChange({
      items: [
        ...items,
        {
          id: newId(),
          letter,
          name: 'Nova persona',
          role: 'Subtítulo descritivo',
          isMain: false,
          quem: '',
          dores: [],
          gatilho: [],
          tentou: [],
          ouvir: '',
        },
      ],
    });
  };
  const toggleMain = (i: number) => {
    const next = items.map((p, idx) => ({ ...p, isMain: idx === i ? !p.isMain : false }));
    onChange({ items: next });
  };

  return (
    <div className="space-y-5">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic text-center py-6">
          Sem personas. Adiciona a primeira abaixo.
        </p>
      )}
      {items.map((p, i) => (
        <Card key={p.id} className={cn("group relative overflow-hidden", STRONG_CARD)}>
          <button
            onClick={() => deleteP(i)}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10 transition-opacity"
            aria-label="Eliminar persona"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="p-5 flex items-center gap-4 bg-primary/5 border-b border-primary/15">
            <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold text-primary-foreground bg-primary shrink-0">
              <EditableText
                value={p.letter}
                onSave={(v) => updateP(i, { letter: (v || '?').slice(0, 1).toUpperCase() })}
                className="text-primary-foreground"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <EditableText
                  value={p.name}
                  onSave={(v) => updateP(i, { name: v })}
                  className="font-semibold text-sm text-foreground"
                />
                <button
                  onClick={() => toggleMain(i)}
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded transition-colors',
                    p.isMain
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground/60 hover:text-foreground',
                  )}
                  aria-label="Marcar como perfil mais comum"
                >
                  <Star className={cn('h-3 w-3', p.isMain && 'fill-current')} />
                  Perfil mais comum
                </button>
              </div>
              <EditableText
                value={p.role}
                onSave={(v) => updateP(i, { role: v })}
                className="text-xs text-muted-foreground mt-0.5"
              />
            </div>
          </div>

          <CardContent className="p-5 space-y-5">
            {/* 2x2 grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <SectionLabel>Quem é</SectionLabel>
                <EditableText
                  value={p.quem}
                  onSave={(v) => updateP(i, { quem: v })}
                  multiline
                  placeholder="Descreve quem é esta persona..."
                  className="text-xs text-foreground leading-relaxed min-h-[2em]"
                />
              </div>
              <div>
                <SectionLabel>Dores principais</SectionLabel>
                <EditableStringList
                  items={p.dores}
                  onChange={(dores) => updateP(i, { dores })}
                  addLabel="Adicionar dor"
                  placeholder="Nova dor"
                />
              </div>
              <div>
                <SectionLabel>Gatilho de ação</SectionLabel>
                <EditableStringList
                  items={p.gatilho}
                  onChange={(gatilho) => updateP(i, { gatilho })}
                  addLabel="Adicionar gatilho"
                  placeholder="Novo gatilho"
                />
              </div>
              <div>
                <SectionLabel>O que já tentou</SectionLabel>
                <EditableStringList
                  items={p.tentou}
                  onChange={(tentou) => updateP(i, { tentou })}
                  bullet="x"
                  addLabel="Adicionar tentativa"
                  placeholder="Nova tentativa"
                />
              </div>
            </div>

            {/* O que precisa ouvir */}
            <div className="rounded-md bg-muted/40 border border-border/60 p-4">
              <SectionLabel>O que precisa ouvir</SectionLabel>
              <EditableText
                value={p.ouvir}
                onSave={(v) => updateP(i, { ouvir: v })}
                multiline
                placeholder="A mensagem que faz esta persona prestar atenção..."
                className="text-sm text-foreground italic leading-relaxed min-h-[1.5em]"
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <AddButton onClick={addP} label="Adicionar persona" />
    </div>
  );
}