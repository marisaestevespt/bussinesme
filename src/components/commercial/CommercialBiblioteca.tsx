import { useState } from 'react';
import { useSectorConfig } from '@/hooks/useSectorConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { LibraryEntrySheet } from './library/LibraryEntrySheet';

const ENTRY_TYPES = ['Lançamento', 'Relançamento', 'Campanha', 'Sequência de Email', 'Promoção', 'Outro'] as const;
const RESULTS = ['Funcionou', 'Não Funcionou', 'Parcialmente'] as const;

type LibraryEntry = {
  id: string;
  title: string;
  entry_type: string;
  product: string | null;
  start_date: string | null;
  end_date: string | null;
  result: string;
  summary: string | null;
  what_worked: string | null;
  what_didnt_work: string | null;
  results_numbers: string | null;
  learnings: string | null;
  materials: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const RESULT_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  funcionou: { label: 'Funcionou', variant: 'default' },
  'não funcionou': { label: 'Não Funcionou', variant: 'destructive' },
  parcialmente: { label: 'Parcialmente', variant: 'secondary' },
};

export function CommercialBiblioteca() {
  const sectorConfig = useSectorConfig();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'gallery' | 'list'>('gallery');
  const [filterType, setFilterType] = useState('todos');
  const [filterProduct, setFilterProduct] = useState('todos');
  const [filterResult, setFilterResult] = useState('todos');
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['commercial-library'],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_library_entries')
        .select('*')
        .order('created_at', { ascending: false });
      return (data || []) as LibraryEntry[];
    },
  });

  const year = new Date().getFullYear();
  const { data: products = [] } = useQuery({
    queryKey: ['commercial-products-list', year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_product_goals').select('product_name').eq('year', year);
      return (data || []).map(p => p.product_name);
    },
  });

  const filtered = entries.filter(e => {
    if (filterType !== 'todos' && e.entry_type.toLowerCase() !== filterType.toLowerCase()) return false;
    if (filterProduct !== 'todos' && e.product !== filterProduct) return false;
    if (filterResult !== 'todos' && e.result.toLowerCase() !== filterResult.toLowerCase()) return false;
    return true;
  });

  const uniqueProducts = [...new Set(entries.map(e => e.product).filter(Boolean))];

  const openNew = () => {
    setSelectedEntry(null);
    setIsNew(true);
    setSheetOpen(true);
  };

  const openEntry = (entry: LibraryEntry) => {
    setSelectedEntry(entry);
    setIsNew(false);
    setSheetOpen(true);
  };

  const resultBadge = (result: string) => {
    const r = RESULT_BADGE[result.toLowerCase()] || { label: result, variant: 'outline' as const };
    return <Badge variant={r.variant}>{r.label}</Badge>;
  };

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start && !end) return '—';
    const s = start ? format(new Date(start), 'MMM yyyy', { locale: pt }) : '';
    const e = end ? format(new Date(end), 'MMM yyyy', { locale: pt }) : '';
    if (s && e) return `${s} → ${e}`;
    return s || e;
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v as 'gallery' | 'list')}>
          <ToggleGroupItem value="gallery" aria-label="Galeria"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Lista"><List className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {ENTRY_TYPES.map(t => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder={sectorConfig.t('produto')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {uniqueProducts.map(p => <SelectItem key={p!} value={p!}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Resultado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os resultados</SelectItem>
            {RESULTS.map(r => <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Entrada</Button>
      </div>

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Biblioteca vazia</p>
          <p className="text-sm mt-1">Regista a tua primeira estratégia ou campanha.</p>
        </div>
      )}

      {/* Gallery */}
      {view === 'gallery' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(entry => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openEntry(entry)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">{entry.title}</h3>
                  {resultBadge(entry.result)}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{entry.entry_type}</Badge>
                  {entry.product && <span>• {entry.product}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{formatPeriod(entry.start_date, entry.end_date)}</p>
                {entry.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.summary}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List */}
      {view === 'list' && filtered.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(entry => (
                <TableRow key={entry.id} className="cursor-pointer" onClick={() => openEntry(entry)}>
                  <TableCell className="font-medium">{entry.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{entry.entry_type}</Badge></TableCell>
                  <TableCell>{entry.product || '—'}</TableCell>
                  <TableCell className="text-sm">{formatPeriod(entry.start_date, entry.end_date)}</TableCell>
                  <TableCell>{resultBadge(entry.result)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(entry.updated_at), 'dd/MM/yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <LibraryEntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        isNew={isNew}
        products={products}
      />
    </div>
  );
}
