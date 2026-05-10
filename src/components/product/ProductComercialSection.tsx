import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Editable } from '@/components/ui/editable';
import { Plus, Trash2, Zap, Swords } from 'lucide-react';
import { format } from 'date-fns';

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-destructive" />
            Produtos Concorrentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {competitors.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sem concorrentes registados.</p>
          )}
          {competitors.map((c, i) => (
            <div key={i} className="rounded-md border bg-card/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <Editable
                    display={c.name}
                    placeholder="Nome do concorrente…"
                    bold
                    multiline={false}
                    disabled={!isOwner}
                    render={({ stop, autoFocusRef }) => (
                      <Input
                        ref={autoFocusRef as any}
                        value={c.name}
                        onChange={e => {
                          const next = [...competitors];
                          next[i] = { ...next[i], name: e.target.value };
                          onUpdateCompetitors(next);
                        }}
                        onBlur={stop}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); stop(); } }}
                        className="h-8 text-sm font-medium"
                      />
                    )}
                  />
                  <Editable
                    display={c.notes}
                    placeholder="Notas sobre este concorrente…"
                    disabled={!isOwner}
                    render={({ stop, autoFocusRef }) => (
                      <Textarea
                        ref={autoFocusRef as any}
                        value={c.notes}
                        onChange={e => {
                          const next = [...competitors];
                          next[i] = { ...next[i], notes: e.target.value };
                          onUpdateCompetitors(next);
                        }}
                        onBlur={stop}
                        placeholder="Notas sobre este concorrente…"
                        className="min-h-[100px] text-sm"
                      />
                    )}
                  />
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onUpdateCompetitors(competitors.filter((_, j) => j !== i))}
                    title="Remover concorrente"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => onUpdateCompetitors([...competitors, { name: '', notes: '' }])}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar concorrente
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
