import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { getClientStatusInfo } from '@/lib/clientStatus';
import { ProductIcon } from '@/components/entity-icon';

/**
 * Lista de clientes partilhada — UI idêntica à página /hub/clientes.
 * Mesmas colunas, mesma ordem, mesmo badge de status, mesmo formato de data.
 */

export interface SharedClientItem {
  id: string;
  full_name: string;
  client_id?: string | null;
  status: string;
  current_product?: string | null;
  current_product_id?: string | null;
  start_date?: string | null;
  end_of_cycle?: string | null;
  email?: string | null;
  whatsapp?: string | null;
}

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
};

export function SharedClientsList({
  items,
  emptyLabel,
  hideProductColumn,
}: {
  items: SharedClientItem[];
  emptyLabel?: string;
  hideProductColumn?: boolean;
}) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
        <Users className="mx-auto h-5 w-5 mb-2 opacity-60" />
        {emptyLabel || 'Sem clientes.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Status</TableHead>
            {!hideProductColumn && <TableHead>Produto</TableHead>}
            <TableHead>Início</TableHead>
            <TableHead>Fim ciclo</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Contacto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(c => {
            const st = getClientStatusInfo(c.status);
            return (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => navigate(`/hub/clientes/${c.id}`)}
              >
                <TableCell className="font-medium max-w-[220px] truncate" title={c.full_name}>
                  {c.full_name}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {c.client_id || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline" className={`whitespace-nowrap ${st.color}`}>
                    {st.label}
                  </Badge>
                </TableCell>
                {!hideProductColumn && (
                  <TableCell className="max-w-[200px]">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      {(c.current_product_id || c.current_product) && (
                        <ProductIcon
                          productId={c.current_product_id as any}
                          className="h-4 w-4 shrink-0"
                          emojiClassName="text-xs"
                        />
                      )}
                      <span className="truncate">{c.current_product || '—'}</span>
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {fmtDate(c.start_date)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {fmtDate(c.end_of_cycle)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate" title={c.email || ''}>
                  {c.email || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {c.whatsapp || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}