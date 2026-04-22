import { Card, CardContent } from '@/components/ui/card';
import { AccentCard, InfoCard, NoteBox, Quote, Tag, AccentColor } from './shared';
import { EditableText } from './EditableText';
import { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState, forwardRef } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// ── helpers ──────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  coral: 'bg-primary', primary: 'bg-primary', info: 'bg-info', success: 'bg-success',
  warning: 'bg-warning', accent: 'bg-accent-foreground', muted: 'bg-muted-foreground',
  destructive: 'bg-destructive',
};

const COLOR_BG_LIGHT: Record<string, string> = {
  coral: 'bg-primary/5', primary: 'bg-primary/5', info: 'bg-info/5', success: 'bg-success/5',
  warning: 'bg-warning/5', accent: 'bg-accent/5', muted: 'bg-muted/30',
  destructive: 'bg-destructive/5',
};

const BORDER_TOP: Record<string, string> = {
  muted: 'border-t-muted-foreground/30', warning: 'border-t-warning', coral: 'border-t-primary', primary: 'border-t-primary',
};

interface BlockProps {
  block: any;
  onUpdate: (updated: any) => void;
  onDelete: () => void;
}

// ── Inline editable list item ────────────────────────────────────
function EditableListItem({ value, onSave, onDelete }: { value: string; onSave: (v: string) => void; onDelete: () => void }) {
  return (
    <li className="group flex items-start gap-1">
      <EditableText value={value} onSave={onSave} className="text-xs text-foreground leading-relaxed flex-1" multiline />
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-0.5">
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}

const AddItemButton = forwardRef<HTMLButtonElement, { onClick: () => void; label?: string }>(
  ({ onClick, label = 'Adicionar item' }, ref) => (
    <button ref={ref} onClick={onClick} className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary mt-1.5 transition-colors">
      <Plus className="h-3 w-3" /> {label}
    </button>
  )
);
AddItemButton.displayName = 'AddItemButton';

// ── Block renderers ──────────────────────────────────────────────

function NoteBlock({ block, onUpdate }: BlockProps) {
  return (
    <NoteBox>
      <EditableText value={block.text} onSave={t => onUpdate({ ...block, text: t })} className="text-xs leading-relaxed text-foreground" multiline />
    </NoteBox>
  );
}

function AccentCardBlock({ block, onUpdate }: BlockProps) {
  return (
    <AccentCard color={block.color || 'coral'} title={block.title}>
      <EditableText value={block.text} onSave={t => onUpdate({ ...block, text: t })} className="text-sm text-foreground leading-relaxed" multiline />
    </AccentCard>
  );
}

function InfoGridBlock({ block, onUpdate, onDelete }: BlockProps) {
  const items = block.items || [];
  const cols = block.columns || 3;

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { title: 'Novo item', text: 'Descrição...' }] });
  };

  return (
    <div>
      <div className={cn('grid grid-cols-1 gap-3', cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
        {items.map((item: any, i: number) => (
          <Card key={i} className="group relative">
            <button onClick={() => deleteItem(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <CardContent className="p-4">
              <EditableText value={item.title} onSave={t => updateItem(i, { title: t })} className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2" />
              <EditableText value={item.text} onSave={t => updateItem(i, { text: t })} className="text-xs text-foreground leading-relaxed" multiline />
            </CardContent>
          </Card>
        ))}
      </div>
      <AddItemButton onClick={addItem} />
    </div>
  );
}

function TwoColumnBlock({ block, onUpdate }: BlockProps) {
  const updateSide = (side: 'left' | 'right', patch: any) => {
    onUpdate({ ...block, [side]: { ...block[side], ...patch } });
  };

  const updateListItem = (side: 'left' | 'right', idx: number, val: string) => {
    const items = [...(block[side].items || [])];
    items[idx] = val;
    updateSide(side, { items });
  };

  const deleteListItem = (side: 'left' | 'right', idx: number) => {
    updateSide(side, { items: block[side].items.filter((_: any, i: number) => i !== idx) });
  };

  const addListItem = (side: 'left' | 'right') => {
    updateSide(side, { items: [...(block[side].items || []), 'Novo item'] });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(['left', 'right'] as const).map(side => (
        <AccentCard key={side} color={block[side].color || 'muted'} title={block[side].title}>
          <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
            {(block[side].items || []).map((item: string, i: number) => (
              <EditableListItem key={i} value={item} onSave={v => updateListItem(side, i, v)} onDelete={() => deleteListItem(side, i)} />
            ))}
          </ul>
          <AddItemButton onClick={() => addListItem(side)} />
        </AccentCard>
      ))}
    </div>
  );
}

function PersonasBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updatePersona = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deletePersona = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addPersona = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[items.length] || '?';
    onUpdate({ ...block, items: [...items, { letter, color: 'coral', name: 'Nova Persona', role: 'Descrição do perfil', quem: '', frase: '', dores: '', gatilho: '', ouvir: '' }] });
  };

  return (
    <div className="space-y-4">
      {items.map((p: any, i: number) => (
        <Card key={i} className="overflow-hidden group relative">
          <button onClick={() => deletePersona(i)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
            <Trash2 className="h-4 w-4" />
          </button>
          <div className={cn('p-5 flex items-center gap-4', COLOR_BG_LIGHT[p.color] || 'bg-muted/30')}>
            <div className={cn('h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0', COLOR_BG[p.color] || 'bg-primary')}>
              {p.letter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <EditableText value={p.name} onSave={v => updatePersona(i, { name: v })} className="font-semibold text-sm text-foreground" />
                {p.tag && <Tag color={(p.color || 'coral') as AccentColor}>{p.tag}</Tag>}
              </div>
              <EditableText value={p.role} onSave={v => updatePersona(i, { role: v })} className="text-xs text-muted-foreground mt-0.5" />
            </div>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Quem é</p>
                <EditableText value={p.quem || ''} onSave={v => updatePersona(i, { quem: v })} className="text-xs text-foreground leading-relaxed" multiline />
                {p.frase && <Quote><EditableText value={p.frase} onSave={v => updatePersona(i, { frase: v })} className="text-xs italic text-muted-foreground/80" multiline /></Quote>}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Dores principais</p>
                <EditableText value={p.dores || ''} onSave={v => updatePersona(i, { dores: v })} className="text-xs text-foreground leading-relaxed" multiline />
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1 mt-3">Gatilho de ação</p>
                <EditableText value={p.gatilho || ''} onSave={v => updatePersona(i, { gatilho: v })} className="text-xs text-foreground leading-relaxed" multiline />
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">O que precisa ouvir</p>
              <EditableText value={p.ouvir || ''} onSave={v => updatePersona(i, { ouvir: v })} className="text-xs text-foreground italic leading-relaxed" multiline />
              {p.nota && <EditableText value={p.nota} onSave={v => updatePersona(i, { nota: v })} className="text-xs text-primary font-medium mt-2" multiline />}
            </div>
          </CardContent>
        </Card>
      ))}
      <AddItemButton onClick={addPersona} label="Adicionar persona" />
    </div>
  );
}

function CenterCardBlock({ block, onUpdate }: BlockProps) {
  return (
    <Card className="mb-4">
      <CardContent className="p-4 text-center">
        <EditableText value={block.text} onSave={t => onUpdate({ ...block, text: t })} className="text-sm font-semibold text-foreground" />
      </CardContent>
    </Card>
  );
}

function AccentGridBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];
  const cols = block.columns || 2;

  const updateCard = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const updateCardItem = (cardIdx: number, itemIdx: number, val: string) => {
    const card = items[cardIdx];
    const newList = [...(card.items || [])];
    newList[itemIdx] = val;
    updateCard(cardIdx, { items: newList });
  };

  const deleteCardItem = (cardIdx: number, itemIdx: number) => {
    const card = items[cardIdx];
    updateCard(cardIdx, { items: card.items.filter((_: any, i: number) => i !== itemIdx) });
  };

  const addCardItem = (cardIdx: number) => {
    const card = items[cardIdx];
    updateCard(cardIdx, { items: [...(card.items || []), 'Novo item'] });
  };

  const deleteCard = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addCard = () => {
    onUpdate({ ...block, items: [...items, { color: 'coral', title: 'Novo bloco', items: ['Item 1'], text: '' }] });
  };

  return (
    <div>
      <div className={cn('grid grid-cols-1 gap-3', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {items.map((card: any, ci: number) => (
          <AccentCard key={ci} color={(card.color || 'coral') as AccentColor} title={card.title} className="group relative">
            <button onClick={() => deleteCard(ci)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {card.text && (
              <EditableText value={card.text} onSave={t => updateCard(ci, { text: t })} className="text-xs text-foreground leading-relaxed mb-2" multiline />
            )}
            {card.quote && (
              <Quote><EditableText value={card.quote} onSave={t => updateCard(ci, { quote: t })} className="text-xs italic text-muted-foreground/80" multiline /></Quote>
            )}
            {card.items && (
              <>
                <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
                  {card.items.map((item: string, ii: number) => (
                    <EditableListItem key={ii} value={item} onSave={v => updateCardItem(ci, ii, v)} onDelete={() => deleteCardItem(ci, ii)} />
                  ))}
                </ul>
                <AddItemButton onClick={() => addCardItem(ci)} />
              </>
            )}
          </AccentCard>
        ))}
      </div>
      <AddItemButton onClick={addCard} label="Adicionar bloco" />
    </div>
  );
}

function BarChartBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  type Temp = 'alta' | 'media' | 'baixa';
  const TEMP_META: Record<Temp, { label: string; pct: number; bar: string; badge: string; rank: number }> = {
    alta:  { label: 'Alta',  pct: 90, bar: 'bg-primary',          badge: 'bg-primary/10 text-primary',         rank: 0 },
    media: { label: 'Média', pct: 55, bar: 'bg-warning',          badge: 'bg-warning/15 text-warning',         rank: 1 },
    baixa: { label: 'Baixa', pct: 25, bar: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground',     rank: 2 },
  };

  // Derive temperature from item: explicit `temperature` wins; otherwise derive from legacy count/total
  const getTemp = (b: any): Temp => {
    if (b?.temperature && TEMP_META[b.temperature as Temp]) return b.temperature;
    const pct = b?.total > 0 ? Math.round((b.count / b.total) * 100) : 0;
    if (pct >= 70) return 'alta';
    if (pct >= 40) return 'media';
    return 'baixa';
  };

  const setTemp = (idx: number, temp: Temp) => {
    const newItems = [...items];
    // Drop legacy count/total — temperature is now the source of truth
    const { count: _c, total: _t, ...rest } = newItems[idx] || {};
    newItems[idx] = { ...rest, temperature: temp };
    onUpdate({ ...block, items: newItems });
  };

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { label: 'Novo item', temperature: 'media' }] });
  };

  // Sort visually by temperature (alta → média → baixa) without mutating storage order
  const sortedIndices = items
    .map((b: any, i: number) => ({ i, rank: TEMP_META[getTemp(b)].rank }))
    .sort((a: any, b: any) => a.rank - b.rank)
    .map((x: any) => x.i);

  return (
    <div className="space-y-0 mb-6">
      {sortedIndices.map((i: number) => {
        const b = items[i];
        const temp = getTemp(b);
        const meta = TEMP_META[temp];
        return (
          <div key={i} className="flex items-center gap-4 py-2.5 border-b group">
            <EditableText value={b.label} onSave={l => updateItem(i, { label: l })} className="text-xs font-medium w-[200px] truncate text-foreground" />
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
              <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${meta.pct}%` }} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded w-14 text-center hover:opacity-80 transition-opacity ${meta.badge}`}
                  aria-label="Alterar temperatura"
                >
                  {meta.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                {(['alta','media','baixa'] as Temp[]).map(t => (
                  <DropdownMenuItem key={t} onClick={() => setTemp(i, t)} className="text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${TEMP_META[t].bar}`} />
                    {TEMP_META[t].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0" aria-label="Eliminar item">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <AddItemButton onClick={addItem} />
    </div>
  );
}

function HighlightCardBlock({ block, onUpdate }: BlockProps) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-5">
        <EditableText value={block.title} onSave={t => onUpdate({ ...block, title: t })} className="text-sm font-semibold text-foreground" />
        <EditableText value={block.text} onSave={t => onUpdate({ ...block, text: t })} className="text-xs text-muted-foreground mt-2 leading-relaxed" multiline />
      </CardContent>
    </Card>
  );
}

function NumberedLevelsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { num: items.length + 1, color: 'muted', title: 'Novo nível', desc: 'Descrição...', example: '', tags: [] }] });
  };

  return (
    <div>
      <div className="space-y-0">
        {items.map((l: any, i: number) => (
          <div key={i} className="flex items-start gap-4 py-4 border-b group">
            <span className={cn('shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white', COLOR_BG[l.color] || 'bg-muted-foreground')}>
              {l.num}
            </span>
            <div className="flex-1 min-w-0">
              <EditableText value={l.title} onSave={t => updateItem(i, { title: t })} className="text-sm font-semibold text-foreground" />
              <EditableText value={l.desc} onSave={t => updateItem(i, { desc: t })} className="text-xs text-muted-foreground mt-1" multiline />
              {l.example && <EditableText value={l.example} onSave={t => updateItem(i, { example: t })} className="text-xs italic text-muted-foreground/70 mt-1" />}
              {l.tags && l.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {l.tags.map((t: any, ti: number) => <Tag key={ti} color={(t.color || 'muted') as AccentColor}>{t.text}</Tag>)}
                </div>
              )}
            </div>
            <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar nível" />
    </div>
  );
}

function TwoAccentCardsBlock({ block, onUpdate }: BlockProps) {
  const updateSide = (side: 'left' | 'right', patch: any) => {
    onUpdate({ ...block, [side]: { ...block[side], ...patch } });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
      {(['left', 'right'] as const).map(side => (
        <AccentCard key={side} color={(block[side].color || 'coral') as AccentColor}>
          <EditableText value={block[side].title} onSave={t => updateSide(side, { title: t })} className="text-xs font-semibold text-foreground mb-2" />
          <EditableText value={block[side].text} onSave={t => updateSide(side, { text: t })} className="text-xs text-muted-foreground leading-relaxed" multiline />
        </AccentCard>
      ))}
    </div>
  );
}

function TemperatureCardsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      {items.map((t: any, i: number) => (
        <Card key={i} className={cn('overflow-hidden border-t-[3px]', BORDER_TOP[t.border] || 'border-t-primary')}>
          <CardContent className="p-4">
            <EditableText value={t.title} onSave={v => updateItem(i, { title: v })} className="text-sm font-bold text-foreground mb-1" />
            <EditableText value={t.desc} onSave={v => updateItem(i, { desc: v })} className="text-xs font-medium text-foreground mb-2" />
            <EditableText value={t.text} onSave={v => updateItem(i, { text: v })} className="text-xs text-muted-foreground leading-relaxed mb-2" multiline />
            <Tag color={(t.tagColor || 'muted') as AccentColor}>{t.tag}</Tag>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BuyingStepsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    const num = String(items.length + 1).padStart(2, '0');
    onUpdate({ ...block, items: [...items, { num, title: 'Novo passo', text: 'Descrição...' }] });
  };

  return (
    <div>
      <p className="text-xs font-semibold text-foreground mb-3">Padrão de compra</p>
      <div className="relative">
        {items.map((s: any, i: number) => (
          <div key={i} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <span className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">{s.num}</span>
              {i < items.length - 1 && <div className="w-px flex-1 min-h-[40px] border-l-2 border-dashed border-border" />}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <Card><CardContent className="p-4">
                <EditableText value={s.title} onSave={t => updateItem(i, { title: t })} className="text-sm font-semibold text-foreground mb-1" />
                <EditableText value={s.text} onSave={t => updateItem(i, { text: t })} className="text-xs text-muted-foreground" multiline />
              </CardContent></Card>
            </div>
            <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-2">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar passo" />
    </div>
  );
}

function JourneyStepsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { num: items.length + 1, color: 'muted', title: 'Nova etapa', desc: 'Descrição...', emotion: 'Emoção' }] });
  };

  return (
    <div>
      <div className="relative">
        {items.map((s: any, i: number) => (
          <div key={i} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <span className={cn('shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white', COLOR_BG[s.color] || 'bg-muted-foreground')}>{s.num}</span>
              {i < items.length - 1 && <div className="w-px flex-1 min-h-[40px] border-l-2 border-dashed border-border" />}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <Card><CardContent className="p-4">
                <EditableText value={s.title} onSave={t => updateItem(i, { title: t })} className="text-sm font-semibold text-foreground mb-1" />
                <EditableText value={s.desc} onSave={t => updateItem(i, { desc: t })} className="text-xs text-muted-foreground mb-2" multiline />
                <Tag color={(s.color || 'muted') as AccentColor}>{s.emotion}</Tag>
              </CardContent></Card>
            </div>
            <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-2">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar etapa" />
    </div>
  );
}

function ObjectionsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { q: 'Nova objeção?', a: 'Resposta...' }] });
  };

  return (
    <div>
      <div className="space-y-3">
        {items.map((o: any, i: number) => (
          <Card key={i} className="overflow-hidden group relative">
            <button onClick={() => deleteItem(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <div className="p-4 bg-destructive/5">
              <EditableText value={`"${o.q}"`} onSave={t => updateItem(i, { q: t.replace(/^"|"$/g, '') })} className="text-sm font-semibold text-destructive" />
            </div>
            <CardContent className="p-4 border-t">
              <EditableText value={o.a} onSave={t => updateItem(i, { a: t })} className="text-xs text-muted-foreground leading-relaxed" multiline />
            </CardContent>
          </Card>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar objeção" />
    </div>
  );
}

function NumberedItemsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { num: items.length + 1, title: 'Novo trigger', text: 'Descrição...' }] });
  };

  return (
    <div>
      <div className="space-y-3">
        {items.map((t: any, i: number) => (
          <div key={i} className="flex gap-3 items-start group">
            <span className="shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">{t.num}</span>
            <Card className="flex-1">
              <CardContent className="p-4">
                <EditableText value={t.title} onSave={v => updateItem(i, { title: v })} className="text-xs font-semibold text-foreground mb-1" />
                <EditableText value={t.text} onSave={v => updateItem(i, { text: v })} className="text-xs text-muted-foreground leading-relaxed" multiline />
                {t.quote && <Quote><EditableText value={t.quote} onSave={v => updateItem(i, { quote: v })} className="text-xs italic text-muted-foreground/80" /></Quote>}
              </CardContent>
            </Card>
            <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0 mt-2">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar item" />
    </div>
  );
}

function AntiCardsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];
  const cols = block.columns || 2;

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { title: 'Novo perfil', text: 'Descrição...' }] });
  };

  return (
    <div>
      <div className={cn('grid grid-cols-1 gap-3', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {items.map((item: any, i: number) => (
          <Card key={i} className="overflow-hidden bg-destructive/5 border-destructive/20 group relative">
            <button onClick={() => deleteItem(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <CardContent className="p-5">
              <EditableText value={item.title} onSave={t => updateItem(i, { title: t })} className="text-sm font-bold text-destructive mb-2" />
              <EditableText value={item.text} onSave={t => updateItem(i, { text: t })} className="text-xs text-destructive/80 leading-relaxed" multiline />
            </CardContent>
          </Card>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar perfil" />
    </div>
  );
}

function FailCardsBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { title: 'Nova tentativa', desc: 'O que aconteceu...', fail: 'Motivo da falha' }] });
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item: any, i: number) => (
          <Card key={i} className="overflow-hidden group relative">
            <button onClick={() => deleteItem(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <CardContent className="p-4">
              <EditableText value={item.title} onSave={t => updateItem(i, { title: t })} className="text-xs font-semibold text-foreground mb-2" />
              <EditableText value={item.desc} onSave={t => updateItem(i, { desc: t })} className="text-xs text-muted-foreground leading-relaxed mb-3" multiline />
              <p className="text-[11px] font-medium text-destructive">✗ <EditableText value={item.fail} onSave={t => updateItem(i, { fail: t })} as="span" className="text-[11px] font-medium text-destructive" /></p>
            </CardContent>
          </Card>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar tentativa" />
    </div>
  );
}

function QuoteColumnsBlock({ block, onUpdate }: BlockProps) {
  const updateSide = (side: 'left' | 'right', patch: any) => {
    onUpdate({ ...block, [side]: { ...block[side], ...patch } });
  };

  const updateQuote = (side: 'left' | 'right', idx: number, val: string) => {
    const quotes = [...(block[side].quotes || [])];
    quotes[idx] = val;
    updateSide(side, { quotes });
  };

  const deleteQuote = (side: 'left' | 'right', idx: number) => {
    updateSide(side, { quotes: block[side].quotes.filter((_: any, i: number) => i !== idx) });
  };

  const addQuote = (side: 'left' | 'right') => {
    updateSide(side, { quotes: [...(block[side].quotes || []), 'Nova frase...'] });
  };

  const borderColor = { left: 'border-primary/30', right: 'border-success/30' };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {(['left', 'right'] as const).map(side => (
        <Card key={side}>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-3">{block[side].label}</p>
            <div className="space-y-2">
              {(block[side].quotes || []).map((q: string, i: number) => (
                <div key={i} className={cn('pl-3 border-l-2 group flex items-start gap-1', borderColor[side])}>
                  <EditableText value={`"${q}"`} onSave={v => updateQuote(side, i, v.replace(/^"|"$/g, ''))} className="text-xs italic text-foreground flex-1" />
                  <button onClick={() => deleteQuote(side, i)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <AddItemButton onClick={() => addQuote(side)} label="Adicionar frase" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GlossaryBlock({ block, onUpdate }: BlockProps) {
  const items = block.items || [];

  const updateItem = (idx: number, patch: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onUpdate({ ...block, items: newItems });
  };

  const deleteItem = (idx: number) => {
    onUpdate({ ...block, items: items.filter((_: any, i: number) => i !== idx) });
  };

  const addItem = () => {
    onUpdate({ ...block, items: [...items, { word: 'Nova palavra', text: 'Definição...' }] });
  };

  return (
    <div>
      <p className="text-xs font-semibold text-foreground mb-3">Glossário</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((g: any, i: number) => (
          <Card key={i} className="group relative">
            <button onClick={() => deleteItem(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <CardContent className="p-4">
              <EditableText value={g.word} onSave={w => updateItem(i, { word: w })} className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2" />
              <EditableText value={g.text} onSave={t => updateItem(i, { text: t })} className="text-xs text-foreground leading-relaxed" multiline />
            </CardContent>
          </Card>
        ))}
      </div>
      <AddItemButton onClick={addItem} label="Adicionar termo" />
    </div>
  );
}

function PhraseGroupsBlock({ block, onUpdate }: BlockProps) {
  const groups = block.groups || [];

  const updateGroup = (gi: number, patch: any) => {
    const newGroups = [...groups];
    newGroups[gi] = { ...newGroups[gi], ...patch };
    onUpdate({ ...block, groups: newGroups });
  };

  const updatePhrase = (gi: number, pi: number, patch: any) => {
    const phrases = [...groups[gi].phrases];
    phrases[pi] = { ...phrases[pi], ...patch };
    updateGroup(gi, { phrases });
  };

  const deletePhrase = (gi: number, pi: number) => {
    updateGroup(gi, { phrases: groups[gi].phrases.filter((_: any, i: number) => i !== pi) });
  };

  const addPhrase = (gi: number) => {
    updateGroup(gi, { phrases: [...groups[gi].phrases, { type: 'NOVO · Formato', phrase: 'Nova frase...', why: 'Porquê...' }] });
  };

  const deleteGroup = (gi: number) => {
    onUpdate({ ...block, groups: groups.filter((_: any, i: number) => i !== gi) });
  };

  const addGroup = () => {
    onUpdate({ ...block, groups: [...groups, { label: 'Novo grupo', color: 'coral', phrases: [] }] });
  };

  return (
    <div className="space-y-6">
      {groups.map((g: any, gi: number) => (
        <div key={gi} className="group/group relative">
          <div className="flex items-center gap-2 mb-3">
            <EditableText value={g.label} onSave={l => updateGroup(gi, { label: l })} className="text-xs font-semibold text-foreground" />
            <button onClick={() => deleteGroup(gi)} className="opacity-0 group-hover/group:opacity-100 text-destructive/60 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(g.phrases || []).map((p: any, pi: number) => (
              <Card key={pi} className="group relative">
                <button onClick={() => deletePhrase(gi, pi)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive z-10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <CardContent className="p-5">
                  <Tag color={(g.color || 'coral') as AccentColor}>{p.type}</Tag>
                  <EditableText value={`"${p.phrase}"`} onSave={v => updatePhrase(gi, pi, { phrase: v.replace(/^"|"$/g, '') })} className="mt-3 text-[15px] font-semibold leading-snug text-foreground" />
                  <EditableText value={p.why} onSave={v => updatePhrase(gi, pi, { why: v })} className="mt-2 text-[11px] italic text-muted-foreground" multiline />
                </CardContent>
              </Card>
            ))}
          </div>
          <AddItemButton onClick={() => addPhrase(gi)} label="Adicionar frase" />
        </div>
      ))}
      <AddItemButton onClick={addGroup} label="Adicionar grupo" />
    </div>
  );
}

// ── Block router ─────────────────────────────────────────────────

const BLOCK_RENDERERS: Record<string, React.FC<BlockProps>> = {
  note: NoteBlock,
  accent_card: AccentCardBlock,
  info_grid: InfoGridBlock,
  two_column: TwoColumnBlock,
  personas: PersonasBlock,
  center_card: CenterCardBlock,
  accent_grid: AccentGridBlock,
  bar_chart: BarChartBlock,
  highlight_card: HighlightCardBlock,
  numbered_levels: NumberedLevelsBlock,
  two_accent_cards: TwoAccentCardsBlock,
  temperature_cards: TemperatureCardsBlock,
  buying_steps: BuyingStepsBlock,
  journey_steps: JourneyStepsBlock,
  objections: ObjectionsBlock,
  numbered_items: NumberedItemsBlock,
  anti_cards: AntiCardsBlock,
  fail_cards: FailCardsBlock,
  quote_columns: QuoteColumnsBlock,
  glossary: GlossaryBlock,
  phrase_groups: PhraseGroupsBlock,
};

interface SectionRendererProps {
  content: Json;
  onContentChange: (content: Json) => void;
}

export function SectionRenderer({ content, onContentChange }: SectionRendererProps) {
  const data = content as { blocks: any[] };
  const blocks = data?.blocks || [];

  const updateBlock = (idx: number, updated: any) => {
    const newBlocks = [...blocks];
    newBlocks[idx] = updated;
    onContentChange({ blocks: newBlocks });
  };

  const deleteBlock = (idx: number) => {
    onContentChange({ blocks: blocks.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const Renderer = BLOCK_RENDERERS[block.type];
        if (!Renderer) return <div key={i} className="text-xs text-muted-foreground">Bloco desconhecido: {block.type}</div>;
        return (
          <div key={i} className="relative group/block">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Eliminar este bloco?')) deleteBlock(i);
              }}
              aria-label="Eliminar bloco"
              className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-destructive/60 hover:text-destructive hover:border-destructive/40 opacity-0 group-hover/block:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <Renderer block={block} onUpdate={b => updateBlock(i, b)} onDelete={() => deleteBlock(i)} />
          </div>
        );
      })}
    </div>
  );
}
