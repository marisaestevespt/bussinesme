import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

export type ListItem = { text: string; checked?: boolean };

export function parseJsonList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : String(v ?? '')));
  return [];
}

export function parseCheckList(val: unknown): ListItem[] {
  if (Array.isArray(val)) {
    return val.map(v => {
      if (typeof v === 'object' && v !== null && 'text' in v) return v as ListItem;
      return { text: String(v ?? ''), checked: false };
    });
  }
  return [];
}

export function EditableTextList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const update = (i: number, val: string) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm w-6 shrink-0">{i + 1}.</span>
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder} className="flex-1" />
          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

export function EditableBulletList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const update = (i: number, val: string) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground">•</span>
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder} className="flex-1" />
          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

export function EditableCheckList({ items, onChange }: { items: ListItem[]; onChange: (items: ListItem[]) => void }) {
  const updateText = (i: number, text: string) => { const n = [...items]; n[i] = { ...n[i], text }; onChange(n); };
  const toggleCheck = (i: number) => { const n = [...items]; n[i] = { ...n[i], checked: !n[i].checked }; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { text: '', checked: false }]);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Checkbox checked={item.checked} onCheckedChange={() => toggleCheck(i)} />
          <Input value={item.text} onChange={e => updateText(i, e.target.value)} className="flex-1" />
          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

export function UtilizacaoTable({ usado, naoUsado, onChangeUsado, onChangeNaoUsado }: {
  usado: string[]; naoUsado: string[];
  onChangeUsado: (v: string[]) => void; onChangeNaoUsado: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <Label className="text-sm font-semibold mb-2 block">É usado quando:</Label>
        <EditableBulletList items={usado} onChange={onChangeUsado} placeholder="Situação..." />
      </div>
      <div>
        <Label className="text-sm font-semibold mb-2 block">Não é usado quando:</Label>
        <EditableBulletList items={naoUsado} onChange={onChangeNaoUsado} placeholder="Situação..." />
      </div>
    </div>
  );
}
