import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Shield } from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  created: { label: 'Criou', variant: 'default' },
  updated: { label: 'Editou', variant: 'secondary' },
  deleted: { label: 'Eliminou', variant: 'destructive' },
};

const ENTITY_LABELS: Record<string, string> = {
  meeting: 'Reunião',
  client: 'Cliente',
  sale: 'Venda',
  task: 'Tarefa',
  project: 'Projeto',
  sop: 'Processo',
  member: 'Membro',
};

export function SettingsAuditLog() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', entityFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (entityFilter && entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = search
    ? logs.filter(
        (l) =>
          l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          l.action?.toLowerCase().includes(search.toLowerCase()) ||
          l.entity_type?.toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const uniqueEntities = [...new Set(logs.map((l) => l.entity_type))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Registo de Auditoria</h3>
          <p className="text-xs text-muted-foreground">
            Histórico de todas as ações realizadas no sistema. Só visível para o owner.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por utilizador, ação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {uniqueEntities.map((e) => (
              <SelectItem key={e} value={e}>
                {ENTITY_LABELS[e] || e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">A carregar...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum registo de auditoria encontrado.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data</TableHead>
                <TableHead>Utilizador</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: 'outline' as const };
                const meta = log.metadata as Record<string, unknown> | null;
                const detail = meta?.title ? String(meta.title) : log.entity_id ? `ID: ${log.entity_id.slice(0, 8)}…` : '—';

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="text-sm">{log.user_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={actionInfo.variant} className="text-xs">
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                      {detail}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
