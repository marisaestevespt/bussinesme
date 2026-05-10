import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

/** Common pricing units. Pure display — does not affect math. */
export const COMMON_UNITS = [
  { value: 'h', label: 'h (hora)' },
  { value: 'h/sem', label: 'h/sem (horas por semana)' },
  { value: 'h/mês', label: 'h/mês (horas por mês)' },
  { value: 'dia', label: 'dia' },
  { value: 'semana', label: 'semana' },
  { value: 'mês', label: 'mês' },
  { value: 'sessão', label: 'sessão' },
  { value: 'reunião', label: 'reunião' },
  { value: 'post', label: 'post' },
  { value: 'vídeo', label: 'vídeo' },
  { value: 'artigo', label: 'artigo' },
  { value: 'página', label: 'página' },
  { value: 'palavra', label: 'palavra' },
  { value: 'projeto', label: 'projeto' },
  { value: 'entregável', label: 'entregável' },
  { value: 'unidade', label: 'unidade' },
];

const CUSTOM = '__custom__';

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}

export function UnitSelect({ value, onChange, disabled }: Props) {
  const isKnown = !!value && COMMON_UNITS.some(u => u.value === value);
  const [customMode, setCustomMode] = useState(!!value && !isKnown);
  const [draft, setDraft] = useState(value || '');

  if (customMode) {
    return (
      <Input
        autoFocus
        value={draft}
        disabled={disabled}
        placeholder="Ex: campanha"
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft.trim() || null); if (!draft.trim()) setCustomMode(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(value || ''); setCustomMode(false); }
        }}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <Select
      value={value || ''}
      disabled={disabled}
      onValueChange={v => {
        if (v === CUSTOM) { setDraft(''); setCustomMode(true); return; }
        onChange(v);
      }}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Escolhe…" />
      </SelectTrigger>
      <SelectContent>
        {COMMON_UNITS.map(u => (
          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
        ))}
        <SelectItem value={CUSTOM}>Outra…</SelectItem>
      </SelectContent>
    </Select>
  );
}