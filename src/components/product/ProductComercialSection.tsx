import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Editable } from '@/components/ui/editable';
import { Plus, Trash2, X, UserCircle, Zap, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface ClientProfileData {
  [key: string]: string[];
}

interface Props {
  clientProfile: ClientProfileData;
  competitors: Array<{ name: string; notes: string }>;
  salesActions: Array<Record<string, unknown>>;
  isOwner: boolean;
  productName: string;
  onUpdateClientProfile: (key: string, val: string[]) => void;
  onUpdateCompetitors: (c: Array<{ name: string; notes: string }>) => void;
  onAddSalesAction: () => void;
}

export function ProductComercialSection({
  clientProfile, competitors, salesActions, isOwner, productName,
  onUpdateClientProfile, onUpdateCompetitors, onAddSalesAction,
}: Props) {
  const navigate = useNavigate();

  const profileGroups = [
    [
      { key: 'dificuldades', label: 'Dificuldades', hint: 'O que acontece no dia a dia' },
      { key: 'dores', label: 'Dores', hint: 'Impacto emocional e mental' },
      { key: 'desejo', label: 'Desejo', hint: 'O que quer concretizar ao comprar' },
    ],
    [
      { key: 'pensa', label: 'O que ela pensa', hint: 'Pensamentos recorrentes' },
      { key: 'expressoes', label: 'Expressões que usa', hint: 'Linguagem real' },
      { key: 'ouve', label: 'O que ela ouve', hint: 'Contexto externo' },
    ],
  ];

  const languageGroups = [
    { key: 'linguagem_nucleo', label: 'Núcleo (usar sempre)' },
    { key: 'linguagem_apoio', label: 'Apoio (usar quando faz sentido)' },
    { key: 'linguagem_evitar', label: 'Evitar' },
  ];

  const renderProfileGroup = (items: typeof profileGroups[0]) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map(({ key, label, hint }) => (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {(clientProfile[key] || []).map((item: string, i: number) => (
            <div key={i} className="flex gap-1 items-start group/row">
              <div className="flex-1 min-w-0">
                <Editable
                  display={item}
                  disabled={!isOwner}
                  placeholder="Escrever..."
                  className="text-sm leading-snug"
                  render={({ stop, autoFocusRef }) => (
                    <Textarea
                      ref={autoFocusRef as any}
                      value={item}
                      onBlur={stop}
                      onChange={e => {
                        const arr = [...(clientProfile[key] || [])];
                        arr[i] = e.target.value;
                        onUpdateClientProfile(key, arr);
                      }}
                      className="text-sm min-h-[80px] resize-y leading-snug"
                    />
                  )}
                />
              </div>
              {isOwner && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => onUpdateClientProfile(key, (clientProfile[key] || []).filter((_: string, j: number) => j !== i))}><X className="h-3 w-3" /></Button>}
            </div>
          ))}
          {isOwner && <Button variant="ghost" size="sm" className="text-xs" onClick={() => onUpdateClientProfile(key, [...(clientProfile[key] || []), ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
        </div>
      ))}
    </div>
  );

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
