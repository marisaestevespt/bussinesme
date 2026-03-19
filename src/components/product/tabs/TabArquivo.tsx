import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Product } from '@/hooks/useProducts';

interface Props {
  form: Partial<Product>;
  update: (field: string, value: any) => void;
  isOwner: boolean;
  id: string;
  costs: any[];
  addRow: any;
  updateRow: any;
  deleteRow: any;
}

export function TabArquivo({ form, update, isOwner, id, costs, addRow, updateRow, deleteRow }: Props) {
  return (
    <div className="space-y-6">
      {/* Biblioteca */}
      <Card>
        <CardHeader><CardTitle className="text-base">Biblioteca</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4"><p className="text-sm font-medium mb-1">Estratégias</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
            <Card className="p-4"><p className="text-sm font-medium mb-1">Conteúdos</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
          </div>
        </CardContent>
      </Card>

      {/* Brainstorming */}
      <Card>
        <CardHeader><CardTitle className="text-base">Brainstorming</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor content={form.brainstorming_content || ''} onChange={v => update('brainstorming_content', v)} editable={isOwner} />
        </CardContent>
      </Card>

      {/* Custos do Produto */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Custos do Produto</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_costs', data: { product_id: id, name: '', usage_desc: '', value: 0 } })}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Utilização</TableHead>
                <TableHead>Valor (€)</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem custos</TableCell></TableRow>}
              {costs.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Input defaultValue={c.name} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={c.usage_desc} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { usage_desc: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input type="number" defaultValue={c.value} onBlur={e => updateRow.mutate({ table: 'product_costs', id: c.id, data: { value: Number(e.target.value) } })} className="border-none shadow-none h-auto p-0 text-sm w-20" readOnly={!isOwner} /></TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_costs', id: c.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
