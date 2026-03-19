import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Product } from '@/hooks/useProducts';

interface Props {
  form: Partial<Product>;
  update: (field: string, value: any) => void;
  isOwner: boolean;
  id: string;
  salesActions: any[];
  funnels: any[];
  automations: any[];
  trafficAds: any[];
  addRow: any;
  updateRow: any;
  deleteRow: any;
}

export function TabComercialMarketing({ form, update, isOwner, id, salesActions, funnels, automations, trafficAds, addRow, updateRow, deleteRow }: Props) {
  const competitors: { name: string; notes: string }[] = Array.isArray(form.competitors) ? form.competitors : [];
  const updateCompetitors = (c: any[]) => update('competitors', c);

  return (
    <div className="space-y-6">
      {/* KPIs & Relatórios */}
      <Card>
        <CardHeader><CardTitle className="text-base">KPIs & Relatórios</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Análises por meses — vista em construção</p>
        </CardContent>
      </Card>

      {/* Ações de Venda */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ações de Venda</CardTitle></CardHeader>
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
              {salesActions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem ações para este produto</TableCell></TableRow>}
              {salesActions.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                  <TableCell className="font-medium">{a.action_name}</TableCell>
                  <TableCell className="text-sm">{a.start_date ? format(new Date(a.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-sm">{a.product || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Funis */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Funis</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_funnels', data: { product_id: id, name: '' } })}><Plus className="h-3 w-3 mr-1" /> Novo Funil</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Criação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ponto(s) de Entrada</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Oferta Final</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Plataforma(s)</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Atualização</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-4">Sem funis</TableCell></TableRow>}
              {funnels.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(f.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Select defaultValue={f.status} onValueChange={v => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { status: v } })} disabled={!isOwner}>
                      <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['em_ideia', 'ativo', 'pausado', 'arquivo'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input defaultValue={f.entry_points || ''} onBlur={e => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { entry_points: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={f.name} onBlur={e => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={f.final_offer || ''} onBlur={e => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { final_offer: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={f.objective || ''} onBlur={e => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { objective: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={f.platforms || ''} onBlur={e => updateRow.mutate({ table: 'product_funnels', id: f.id, data: { platforms: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell className="text-sm">{f.funnel_type || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(f.updated_at), 'dd/MM/yyyy')}</TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_funnels', id: f.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Automações */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Automações</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_automations', data: { product_id: id, name: '' } })}><Plus className="h-3 w-3 mr-1" /> Nova Automação</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Criação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Oferta Final</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead>Notas</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-4">Sem automações</TableCell></TableRow>}
              {automations.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Select defaultValue={a.status} onValueChange={v => updateRow.mutate({ table: 'product_automations', id: a.id, data: { status: v } })} disabled={!isOwner}>
                      <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['em_desenho', 'ativo', 'pausado', 'arquivo'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input defaultValue={a.name} onBlur={e => updateRow.mutate({ table: 'product_automations', id: a.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={a.final_offer || ''} onBlur={e => updateRow.mutate({ table: 'product_automations', id: a.id, data: { final_offer: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell className="text-sm">{a.platform || '—'}</TableCell>
                  <TableCell className="text-sm">{a.objective || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(a.updated_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><Input defaultValue={a.notes || ''} onBlur={e => updateRow.mutate({ table: 'product_automations', id: a.id, data: { notes: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_automations', id: a.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Produtos Concorrentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Produtos Concorrentes</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {competitors.map((c, i) => (
              <AccordionItem key={i} value={`comp-${i}`}>
                <AccordionTrigger className="text-sm">
                  <Input value={c.name} onChange={e => { const next = [...competitors]; next[i] = { ...next[i], name: e.target.value }; updateCompetitors(next); }} className="border-none shadow-none h-auto p-0 focus-visible:ring-0 text-sm font-medium" onClick={e => e.stopPropagation()} readOnly={!isOwner} />
                </AccordionTrigger>
                <AccordionContent>
                  <Textarea value={c.notes} onChange={e => { const next = [...competitors]; next[i] = { ...next[i], notes: e.target.value }; updateCompetitors(next); }} placeholder="Notas sobre este concorrente..." className="min-h-[80px]" readOnly={!isOwner} />
                  {isOwner && <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => updateCompetitors(competitors.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button>}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {isOwner && <Button variant="outline" size="sm" className="mt-2" onClick={() => updateCompetitors([...competitors, { name: '', notes: '' }])}><Plus className="h-3 w-3 mr-1" /> Adicionar concorrente</Button>}
        </CardContent>
      </Card>

      {/* Tráfego Pago */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tráfego Pago</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_traffic_ads', data: { product_id: id } })}><Plus className="h-3 w-3 mr-1" /> Novo Anúncio</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Início</TableHead>
                <TableHead>Criativo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Oferta Goal</TableHead>
                <TableHead>Link</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trafficAds.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">Sem anúncios</TableCell></TableRow>}
              {trafficAds.map((ad: any) => (
                <TableRow key={ad.id}>
                  <TableCell className="text-sm">{ad.start_date || '—'}</TableCell>
                  <TableCell>{ad.creative_url ? <a href={ad.creative_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs"><ExternalLink className="h-3 w-3" /></a> : '—'}</TableCell>
                  <TableCell className="text-sm">{ad.status || '—'}</TableCell>
                  <TableCell className="text-sm">{ad.format || '—'}</TableCell>
                  <TableCell className="text-sm">{ad.objective || '—'}</TableCell>
                  <TableCell className="text-sm">{ad.offer_goal || '—'}</TableCell>
                  <TableCell>{ad.link ? <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-primary text-xs"><ExternalLink className="h-3 w-3" /></a> : '—'}</TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_traffic_ads', id: ad.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
