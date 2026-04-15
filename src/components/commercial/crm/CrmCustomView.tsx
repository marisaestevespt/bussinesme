import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { statusLabel, getFollowUpState, FollowUpState } from '@/hooks/useCrmData';
import { useCrmStages } from '@/hooks/useCrmStages';
import { format } from 'date-fns';
import { AlertTriangle, Clock, CalendarIcon, Filter, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrmCustomViewProps {
  leads: any[];
  onOpenLead: (lead: any) => void;
  initialFilters?: Filters;
  onSaveFilters?: (filters: Filters) => void;
  viewName?: string;
}

export interface Filters {
  name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  product: string;
  minValue: string;
  maxValue: string;
  followupFrom: string;
  followupTo: string;
  addedFrom: string;
  addedTo: string;
}

export const EMPTY_FILTERS: Filters = {
  name: '', email: '', phone: '', status: '', source: '', product: '',
  minValue: '', maxValue: '',
  followupFrom: '', followupTo: '',
  addedFrom: '', addedTo: '',
};

function fuClass(state: FollowUpState) {
  switch (state) {
    case 'overdue': return 'text-destructive font-medium';
    case 'today': return 'text-amber-600 font-medium';
    case 'soon': return 'text-yellow-600';
    default: return '';
  }
}

function FuIcon({ state }: { state: FollowUpState }) {
  if (state === 'overdue') return <AlertTriangle className="h-3 w-3 inline mr-1" />;
  if (state === 'today') return <Clock className="h-3 w-3 inline mr-1" />;
  return null;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (d: string) => void }) {
  const dateVal = value ? new Date(value) : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-9", !value && "text-muted-foreground")}>
            <CalendarIcon className="h-3 w-3 mr-1" />
            {dateVal ? format(dateVal, 'dd/MM/yyyy') : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateVal} onSelect={d => onChange(d ? d.toISOString() : '')} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CrmCustomView({ leads, onOpenLead, initialFilters, onSaveFilters }: CrmCustomViewProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters || EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);

  const set = (partial: Partial<Filters>) => setFilters(prev => ({ ...prev, ...partial }));

  const uniqueSources = useMemo(() => [...new Set(leads.map(l => l.source).filter(Boolean))], [leads]);
  const uniqueProducts = useMemo(() => [...new Set(leads.map(l => l.potential_product).filter(Boolean))], [leads]);

  const activeFilterCount = useMemo(() =>
    Object.values(filters).filter(v => v !== '').length,
    [filters]
  );

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (filters.name && !l.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.email && !l.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (filters.phone && !l.phone?.includes(filters.phone)) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (filters.source && l.source !== filters.source) return false;
      if (filters.product && l.potential_product !== filters.product) return false;
      if (filters.minValue && Number(l.estimated_value || 0) < Number(filters.minValue)) return false;
      if (filters.maxValue && Number(l.estimated_value || 0) > Number(filters.maxValue)) return false;
      if (filters.followupFrom && l.next_followup && new Date(l.next_followup) < new Date(filters.followupFrom)) return false;
      if (filters.followupTo && l.next_followup && new Date(l.next_followup) > new Date(filters.followupTo)) return false;
      if (filters.followupFrom && !l.next_followup) return false;
      if (filters.addedFrom && new Date(l.added_at) < new Date(filters.addedFrom)) return false;
      if (filters.addedTo && new Date(l.added_at) > new Date(filters.addedTo)) return false;
      return true;
    });
  }, [leads, filters]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">{activeFilterCount}</Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
        {onSaveFilters && (
          <Button variant="outline" size="sm" onClick={() => onSaveFilters(filters)}>
            <Save className="h-3 w-3 mr-1" /> Guardar filtros
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Pesquisar..." value={filters.name} onChange={e => set({ name: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input placeholder="Pesquisar..." value={filters.email} onChange={e => set({ email: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input placeholder="Pesquisar..." value={filters.phone} onChange={e => set({ phone: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={v => set({ status: v === '__all__' ? '' : v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {CRM_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fonte</Label>
                <Select value={filters.source} onValueChange={v => set({ source: v === '__all__' ? '' : v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {uniqueSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <Select value={filters.product} onValueChange={v => set({ product: v === '__all__' ? '' : v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {uniqueProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor mínimo (€)</Label>
                <Input type="number" placeholder="0" value={filters.minValue} onChange={e => set({ minValue: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor máximo (€)</Label>
                <Input type="number" placeholder="∞" value={filters.maxValue} onChange={e => set({ maxValue: e.target.value })} className="h-9" />
              </div>
              <DateFilter label="Follow-up desde" value={filters.followupFrom} onChange={d => set({ followupFrom: d })} />
              <DateFilter label="Follow-up até" value={filters.followupTo} onChange={d => set({ followupTo: d })} />
              <DateFilter label="Adicionada desde" value={filters.addedFrom} onChange={d => set({ addedFrom: d })} />
              <DateFilter label="Adicionada até" value={filters.addedTo} onChange={d => set({ addedTo: d })} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[130px]">Fonte</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[110px]">Telefone</TableHead>
                <TableHead className="w-[130px]">Produto</TableHead>
                <TableHead className="w-[120px]">Próximo FU</TableHead>
                <TableHead className="w-[110px]">Adicionada</TableHead>
                <TableHead className="w-[100px] text-right">Valor Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem resultados</TableCell></TableRow>
              )}
              {filtered.map(lead => {
                const fuState = getFollowUpState(lead.next_followup);
                return (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenLead(lead)}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{statusLabel(lead.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.source || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.email || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.potential_product || '—'}</TableCell>
                    <TableCell className={`text-sm ${fuClass(fuState)}`}>
                      <FuIcon state={fuState} />
                      {lead.next_followup ? format(new Date(lead.next_followup), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.added_at ? format(new Date(lead.added_at), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {Number(lead.estimated_value || 0) > 0 ? `${Number(lead.estimated_value).toLocaleString('pt-PT')}€` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
