import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { useFinancialCategories, type CategoryType } from '@/hooks/useFinancialCategories';

interface Props {
  type: CategoryType;
  value: string;
  onValueChange: (v: string) => void;
}

export function CategorySelect({ type, value, onValueChange }: Props) {
  const { expenseCategories, subscriptionCategories, addCategory } = useFinancialCategories();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const categories = type === 'expense' ? expenseCategories : subscriptionCategories;

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const slug = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await addCategory.mutateAsync({ category_type: type, value: slug, label });
    onValueChange(slug);
    setNewLabel('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Nome da categoria..."
          className="h-9"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim() || addCategory.isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={v => { if (v === '__add_new__') { setAdding(true); } else { onValueChange(v); } }}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {categories.map(c => (
          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
        ))}
        <SelectItem value="__add_new__" className="text-primary font-medium">
          <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Nova categoria</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
