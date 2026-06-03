import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '../EditableText';
import { EditableStringList, SectionLabel, SubBlock } from './shared';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PerfilData {
  definicao: string;
  cards: { title: string; text: string }[];
  precisa: string[];
  naoEncaixa: string[];
}

export function BlockPerfil({ data, onChange }: { data: PerfilData; onChange: (d: PerfilData) => void }) {
  const update = (patch: Partial<PerfilData>) => onChange({ ...data, ...patch });

  const updateCard = (i: number, patch: Partial<PerfilData['cards'][number]>) => {
    const cards = [...data.cards];
    cards[i] = { ...cards[i], ...patch };
    update({ cards });
  };
  const deleteCard = (i: number) => update({ cards: data.cards.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-8">
      {/* Definição em frase */}
      <SubBlock title="Definição em frase">
        <div className="rounded-md bg-muted/40 border border-border/60 p-4">
          <EditableText
            value={data.definicao}
            onSave={(v) => update({ definicao: v })}
            multiline
            placeholder="Descreve em uma frase quem é o público-alvo..."
            className="text-sm leading-relaxed text-foreground italic min-h-[1.5em]"
          />
        </div>
      </SubBlock>

      {/* Grid 2x3 cards */}
      <SubBlock title="Dimensões do perfil">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.cards.map((c, i) => (
            <Card key={i} className="group relative">
              <button
                onClick={() => deleteCard(i)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10 transition-opacity"
                aria-label="Eliminar card"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <CardContent className="p-4">
                <EditableText
                  value={c.title}
                  onSave={(v) => updateCard(i, { title: v })}
                  className="text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground mb-2"
                />
                <EditableText
                  value={c.text}
                  onSave={(v) => updateCard(i, { text: v })}
                  multiline
                  placeholder="Descreve este aspeto..."
                  className="text-xs text-foreground leading-relaxed min-h-[2.5em]"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </SubBlock>

      {/* Duas listas: precisa ter / não encaixa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={cn('border-l-[3px] border-success bg-success/5')}>
          <CardContent className="p-4">
            <SectionLabel>Precisa ter</SectionLabel>
            <EditableStringList
              items={data.precisa}
              onChange={(precisa) => update({ precisa })}
              bullet="check"
              addLabel="Adicionar requisito"
              placeholder="Novo requisito"
              emptyText="Adiciona características obrigatórias do público-alvo..."
            />
          </CardContent>
        </Card>
        <Card className={cn('border-l-[3px] border-destructive bg-destructive/5')}>
          <CardContent className="p-4">
            <SectionLabel>Não encaixa se</SectionLabel>
            <EditableStringList
              items={data.naoEncaixa}
              onChange={(naoEncaixa) => update({ naoEncaixa })}
              bullet="x"
              addLabel="Adicionar exclusão"
              placeholder="Nova exclusão"
              emptyText="Adiciona características que excluem do público..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}