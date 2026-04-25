import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/hooks/useProducts';

const OBJETIVO_TYPES = [
  { value: 'produto', label: 'Produto' },
  { value: 'link', label: 'Link' },
  { value: 'whatsapp', label: 'Whatsapp' },
  { value: 'perfil', label: 'Perfil' },
] as const;

export type ObjetivoFinalType = 'produto' | 'link' | 'whatsapp' | 'perfil' | '';

/** Parse stored value "tipo:valor" into { type, value } */
export function parseObjetivoFinal(raw: string | null): { type: ObjetivoFinalType; value: string } {
  if (!raw) return { type: '', value: '' };
  const sep = raw.indexOf(':');
  if (sep === -1) return { type: '', value: raw }; // legacy free-text
  const type = raw.slice(0, sep) as ObjetivoFinalType;
  if (!OBJETIVO_TYPES.some(t => t.value === type)) return { type: '', value: raw };
  return { type, value: raw.slice(sep + 1) };
}

/** Serialize back to "tipo:valor" for DB storage */
export function serializeObjetivoFinal(type: ObjetivoFinalType, value: string): string | null {
  if (!type) return null;
  return `${type}:${value}`;
}

/** Display label for table columns */
export function displayObjetivoFinal(raw: string | null): string {
  const { type, value } = parseObjetivoFinal(raw);
  if (!type) return raw || '—';
  const label = OBJETIVO_TYPES.find(t => t.value === type)?.label || type;
  return value ? `${label}: ${value}` : label;
}

interface Props {
  type: ObjetivoFinalType;
  value: string;
  onTypeChange: (type: ObjetivoFinalType) => void;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ObjetivoFinalField({ type, value, onTypeChange, onValueChange, disabled }: Props) {
  const { products } = useProducts();
  const productList = products.data || [];

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">Objetivo Final</Label>
      <RadioGroup
        value={type}
        onValueChange={(v) => { onTypeChange(v as ObjetivoFinalType); onValueChange(''); }}
        className="flex flex-wrap gap-4"
        disabled={disabled}
      >
        {OBJETIVO_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-2">
            <RadioGroupItem value={t.value} id={`obj-${t.value}`} />
            <Label htmlFor={`obj-${t.value}`} className="text-sm font-normal cursor-pointer">{t.label}</Label>
          </div>
        ))}
      </RadioGroup>

      {type === 'produto' && (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
          <SelectContent>
            {productList.map(p => (
              <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === 'link' && (
        <Input
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder="https://..."
          className="h-9"
          readOnly={disabled}
        />
      )}
    </div>
  );
}
