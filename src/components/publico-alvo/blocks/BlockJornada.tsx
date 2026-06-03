import { Card, CardContent } from '@/components/ui/card';
import { EditableText } from '../EditableText';
import { AddButton, EditableStringList, SectionLabel, SubBlock } from './shared';
import { Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type BadgeColor = 'muted' | 'primary' | 'success' | 'warning' | 'info' | 'destructive';
const BADGE_STYLES: Record<BadgeColor, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  destructive: 'bg-destructive/15 text-destructive',
};

export interface JornadaData {
  niveis: { nome: string; desc: string; badge: string; badgeColor: BadgeColor; frase: string }[];
  temperatura: {
    fria: { desc: string; ativada: string };
    morna: { desc: string; ativada: string };
    quente: { desc: string; ativada: string };
  };
  ativa: string[];
  impede: { objecao: string; resposta: string }[];
}

export function BlockJornada({ data, onChange }: { data: JornadaData; onChange: (d: JornadaData) => void }) {
  const update = (patch: Partial<JornadaData>) => onChange({ ...data, ...patch });

  // ─ Níveis ─
  const updateNivel = (i: number, patch: Partial<JornadaData['niveis'][number]>) => {
    const next = [...data.niveis];
    next[i] = { ...next[i], ...patch };
    update({ niveis: next });
  };
  const deleteNivel = (i: number) => update({ niveis: data.niveis.filter((_, idx) => idx !== i) });
  const addNivel = () =>
    update({
      niveis: [...data.niveis, { nome: 'Novo nível', desc: '', badge: '', badgeColor: 'muted', frase: '' }],
    });

  // ─ Temperatura ─
  const updateTemp = (k: 'fria' | 'morna' | 'quente', patch: Partial<{ desc: string; ativada: string }>) => {
    update({ temperatura: { ...data.temperatura, [k]: { ...data.temperatura[k], ...patch } } });
  };

  // ─ Impede ─
  const updateImp = (i: number, patch: Partial<JornadaData['impede'][number]>) => {
    const next = [...data.impede];
    next[i] = { ...next[i], ...patch };
    update({ impede: next });
  };
  const deleteImp = (i: number) => update({ impede: data.impede.filter((_, idx) => idx !== i) });
  const addImp = () => update({ impede: [...data.impede, { objecao: 'Nova objeção', resposta: '' }] });

  return (
    <div className="space-y-10">
      {/* Secção A — Escala de consciência */}
      <SubBlock title="Escala de consciência">
        <div className="space-y-3">
          {data.niveis.map((n, i) => (
            <Card key={i} className={cn("group relative", STRONG_CARD)}>
              <button
                onClick={() => deleteNivel(i)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10 transition-opacity"
                aria-label="Eliminar nível"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <CardContent className="p-4 flex gap-4">
                <div className="shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EditableText
                      value={n.nome}
                      onSave={(v) => updateNivel(i, { nome: v })}
                      className="font-semibold text-sm text-foreground"
                    />
                    <BadgeEditor
                      label={n.badge}
                      color={n.badgeColor}
                      onChange={(badge, badgeColor) => updateNivel(i, { badge, badgeColor })}
                    />
                  </div>
                  <EditableText
                    value={n.desc}
                    onSave={(v) => updateNivel(i, { desc: v })}
                    multiline
                    placeholder="Descreve este nível de consciência..."
                    className="text-xs text-foreground leading-relaxed min-h-[1.5em]"
                  />
                  <div className="rounded bg-muted/40 px-3 py-2 border-l-2 border-border">
                    <EditableText
                      value={n.frase}
                      onSave={(v) => updateNivel(i, { frase: v })}
                      multiline
                      placeholder="Frase típica (opcional)..."
                      className="text-xs italic text-muted-foreground leading-relaxed min-h-[1em]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <AddButton onClick={addNivel} label="Adicionar nível" />
        </div>
      </SubBlock>

      {/* Secção B — Temperatura */}
      <SubBlock title="Temperatura">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            { k: 'fria' as const, title: 'Fria', tint: 'border-info/40 bg-info/5' },
            { k: 'morna' as const, title: 'Morna', tint: 'border-warning/40 bg-warning/5' },
            { k: 'quente' as const, title: 'Quente', tint: 'border-destructive/40 bg-destructive/5' },
          ]).map(({ k, title, tint }) => (
            <Card key={k} className={cn("border-2 shadow-card hover:shadow-elegant transition-all", tint)}>
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold text-sm text-foreground">{title}</p>
                <EditableText
                  value={data.temperatura[k].desc}
                  onSave={(v) => updateTemp(k, { desc: v })}
                  multiline
                  placeholder="Descrição..."
                  className="text-xs text-foreground leading-relaxed min-h-[2em]"
                />
                <div className="pt-1.5">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mr-1.5">Ativada por:</span>
                  <EditableText
                    as="span"
                    value={data.temperatura[k].ativada}
                    onSave={(v) => updateTemp(k, { ativada: v })}
                    className="text-[11px] font-medium text-primary"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SubBlock>

      {/* Secção C — Ativa vs Impede */}
      <SubBlock title="O que ativa vs. O que impede">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">O que ativa a decisão</p>
            <NumberedList
              items={data.ativa}
              onChange={(ativa) => update({ ativa })}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3">O que a impede</p>
            <div className="space-y-2">
              {data.impede.map((it, i) => (
                <ObjectionAccordion
                  key={i}
                  data={it}
                  onChange={(patch) => updateImp(i, patch)}
                  onDelete={() => deleteImp(i)}
                />
              ))}
              <AddButton onClick={addImp} label="Adicionar objeção" />
            </div>
          </div>
        </div>
      </SubBlock>
    </div>
  );
}

function BadgeEditor({
  label,
  color,
  onChange,
}: {
  label: string;
  color: BadgeColor;
  onChange: (label: string, color: BadgeColor) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className={cn('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded', BADGE_STYLES[color])}>
        <EditableText
          as="span"
          value={label}
          onSave={(v) => onChange(v, color)}
          placeholder="Adicionar etiqueta"
          className="bg-transparent"
        />
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-muted-foreground/60 hover:text-foreground p-0.5" aria-label="Cor da etiqueta">
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          {(Object.keys(BADGE_STYLES) as BadgeColor[]).map((c) => (
            <DropdownMenuItem key={c} onClick={() => onChange(label, c)} className="text-xs capitalize">
              <span className={cn('w-3 h-3 rounded mr-2', BADGE_STYLES[c])} />
              {c}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NumberedList({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, 'Novo']);
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="group flex items-start gap-3">
          <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <EditableText
            value={it}
            onSave={(v) => update(i, v)}
            multiline
            className="text-xs text-foreground leading-relaxed flex-1"
          />
          <button
            onClick={() => del(i)}
            className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-1 transition-opacity"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <AddButton onClick={add} label="Adicionar" />
    </div>
  );
}

function ObjectionAccordion({
  data,
  onChange,
  onDelete,
}: {
  data: { objecao: string; resposta: string };
  onChange: (patch: Partial<{ objecao: string; resposta: string }>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground/60 hover:text-foreground shrink-0"
          aria-label="Expandir"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
        <EditableText
          value={data.objecao}
          onSave={(v) => onChange({ objecao: v })}
          className="font-semibold text-xs text-destructive flex-1"
        />
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 transition-opacity"
          aria-label="Eliminar objeção"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-9">
          <EditableText
            value={data.resposta}
            onSave={(v) => onChange({ resposta: v })}
            multiline
            placeholder="Resposta / reframe..."
            className="text-xs text-foreground leading-relaxed min-h-[2em]"
          />
        </div>
      )}
    </div>
  );
}