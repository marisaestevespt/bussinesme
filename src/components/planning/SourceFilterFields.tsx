import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DEPARTMENTS } from '@/lib/departments';

// Which sources support which filter fields
const SOURCE_FILTERS: Record<string, { key: string; label: string; type: 'client' | 'channel' | 'department' | 'expense_category' | 'time_category' | 'project_type' }[]> = {
  bd_tempo: [
    { key: 'category', label: 'Categoria', type: 'time_category' },
    { key: 'client_id', label: 'Cliente', type: 'client' },
  ],
  bd_tarefas: [
    { key: 'department', label: 'Departamento', type: 'department' },
  ],
  bd_marketing: [
    { key: 'channel_id', label: 'Canal', type: 'channel' },
  ],
  bd_conteudos: [
    { key: 'channel_id', label: 'Canal', type: 'channel' },
  ],
  bd_reunioes: [
    { key: 'department', label: 'Departamento', type: 'department' },
  ],
  bd_nps: [
    { key: 'client_id', label: 'Cliente', type: 'client' },
  ],
  bd_despesas: [
    { key: 'category', label: 'Categoria', type: 'expense_category' },
  ],
  bd_projetos: [
    { key: 'type', label: 'Tipo de projeto', type: 'project_type' },
  ],
};

const TIME_CATEGORIES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'interno', label: 'Interno' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'formacao', label: 'Formação' },
];

const PROJECT_TYPES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'interno', label: 'Interno' },
];

export function getSourceFilters(source: string) {
  return SOURCE_FILTERS[source] || [];
}

export function SourceFilterFields({ source, sourceFilter, onChange }: {
  source: string;
  sourceFilter: Record<string, string>;
  onChange: (sf: Record<string, string>) => void;
}) {
  const filters = SOURCE_FILTERS[source] || [];
  
  const clients = useQuery({
    queryKey: ['filter-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id,full_name').order('full_name');
      return data || [];
    },
    enabled: filters.some(f => f.type === 'client'),
  });

  const channels = useQuery({
    queryKey: ['filter-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('id,name').eq('is_active', true).order('name');
      return data || [];
    },
    enabled: filters.some(f => f.type === 'channel'),
  });

  const expenseCategories = useQuery({
    queryKey: ['filter-expense-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_categories' as any).select('id,name').eq('type', 'saida').order('name');
      return (data || []) as any[];
    },
    enabled: filters.some(f => f.type === 'expense_category'),
  });

  if (filters.length === 0) return null;

  const set = (key: string, value: string) => {
    const next = { ...sourceFilter };
    if (value === 'all') {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {filters.map(f => {
        let options: { value: string; label: string }[] = [];
        
        if (f.type === 'client') {
          options = (clients.data || []).map((c: any) => ({ value: c.id, label: c.full_name }));
        } else if (f.type === 'channel') {
          options = (channels.data || []).map((c: any) => ({ value: c.id, label: c.name }));
        } else if (f.type === 'department') {
          options = DEPARTMENTS.map(d => ({ value: d.id, label: d.label }));
        } else if (f.type === 'expense_category') {
          options = (expenseCategories.data || []).map((c: any) => ({ value: c.name, label: c.name }));
        } else if (f.type === 'time_category') {
          options = TIME_CATEGORIES;
        } else if (f.type === 'project_type') {
          options = PROJECT_TYPES;
        }

        return (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Select value={sourceFilter[f.key] || 'all'} onValueChange={v => set(f.key, v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
