import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, EyeOff, Eye } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Cat = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  department: string;
  sort_order: number;
  is_active: boolean;
};

const DEPARTMENTS = [
  { value: 'relacao_clientes', label: 'Relação com Clientes' },
  { value: 'produto', label: 'Produto' },
  { value: 'operacao', label: 'Operação' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outro', label: 'Outro' },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function SettingsRecolhas() {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nps_categories' as any)
      .select('*')
      .order('sort_order');
    if (!error && data) setItems(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCat = async () => {
    const label = 'Nova categoria';
    const baseKey = slugify(label);
    let key = baseKey;
    let n = 1;
    while (items.some(i => i.key === key)) { n++; key = `${baseKey}_${n}`; }
    const sort_order = (items[items.length - 1]?.sort_order || 0) + 10;
    const { error } = await supabase.from('nps_categories' as any).insert({
      key, label, department: 'outro', sort_order,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success('Categoria adicionada'); load(); }
  };

  const update = async (id: string, patch: Partial<Cat>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    const { error } = await supabase.from('nps_categories' as any).update(patch as any).eq('id', id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta categoria?')) return;
    const { error } = await supabase.from('nps_categories' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Removida'); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Categorias de NPS</h2>
          <p className="text-sm text-muted-foreground">
            Definem as dimensões que o cliente avalia em cada recolha NPS. Cada categoria liga-se a um departamento responsável.
          </p>
        </div>
        <Button size="sm" onClick={addCat}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <div className="space-y-2">
          {items.map(c => (
            <div
              key={c.id}
              className={`hq-card p-4 grid grid-cols-12 gap-3 items-start ${!c.is_active ? 'opacity-60' : ''}`}
            >
              <div className="col-span-12 md:col-span-3 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome</label>
                <Input
                  value={c.label}
                  onChange={e => update(c.id, { label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-12 md:col-span-4 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</label>
                <Input
                  value={c.description || ''}
                  onChange={e => update(c.id, { description: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Ajuda curta para o cliente"
                />
              </div>
              <div className="col-span-6 md:col-span-3 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Departamento</label>
                <Select value={c.department} onValueChange={v => update(c.id, { department: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 md:col-span-2 flex items-end justify-end gap-1 h-full">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  title={c.is_active ? 'Desativar' : 'Ativar'}
                  onClick={() => update(c.id, { is_active: !c.is_active })}
                >
                  {c.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem categorias. Adiciona a primeira.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
