import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Zap, Swords } from 'lucide-react';
import { format } from 'date-fns';
import { InlineField } from '@/components/product/InlineField';

interface Props {
  competitors: Array<{ name: string; notes: string }>;
  salesActions: Array<Record<string, unknown>>;
  isOwner: boolean;
  productName: string;
  onUpdateCompetitors: (c: Array<{ name: string; notes: string }>) => void;
  onAddSalesAction: () => void;
}

export function ProductComercialSection({
  competitors, salesActions, isOwner, productName,
  onUpdateCompetitors, onAddSalesAction,
}: Props) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-warning" />
            Ações de Venda
          </CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddSalesAction}>
              <Plus className="h-3 w-3 mr-1" /> Nova Ação
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Data/Período</TableHead>
                <TableHead>Produto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesActions.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem ações para este produto</TableCell></TableRow>
              )}
              {salesActions.map((a: Record<string, unknown>) => (
                <TableRow key={a.id as string}>
                  <TableCell><Badge variant="outline" className="text-xs">{a.status as string}</Badge></TableCell>
                  <TableCell className="font-medium">{a.action_name as string}</TableCell>
                  <TableCell className="text-sm">{a.start_date ? format(new Date(a.start_date as string), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-sm">{(a.product as string) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-destructive" />
            Produtos Concorrentes
          </CardTitle>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateCompetitors([...competitors, { name: '', notes: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar concorrente
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Concorrente</TableHead>
                <TableHead>Notas</TableHead>
                {isOwner && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isOwner ? 3 : 2} className="text-center text-muted-foreground py-4">
                    Sem concorrentes registados
                  </TableCell>
                </TableRow>
              )}
              {competitors.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="align-top">
                    <InlineField
                      value={c.name}
                      placeholder="Nome do concorrente…"
                      bold
                      disabled={!isOwner}
                      onSave={v => {
                        const next = [...competitors];
                        next[i] = { ...next[i], name: v };
                        onUpdateCompetitors(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <InlineField
                      value={c.notes}
                      placeholder="Notas (opcional)…"
                      multiline
                      disabled={!isOwner}
                      onSave={v => {
                        const next = [...competitors];
                        next[i] = { ...next[i], notes: v };
                        onUpdateCompetitors(next);
                      }}
                    />
                  </TableCell>
                  {isOwner && (
                    <TableCell className="align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onUpdateCompetitors(competitors.filter((_, j) => j !== i))}
                        title="Remover concorrente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
