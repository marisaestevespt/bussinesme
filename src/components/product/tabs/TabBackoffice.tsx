import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Product } from '@/hooks/useProducts';

interface Props {
  form: Partial<Product>;
  update: (field: string, value: any) => void;
  isOwner: boolean;
  id: string;
  usefulLinks: any[];
  sops: any[];
  addRow: any;
  updateRow: any;
  deleteRow: any;
}

export function TabBackoffice({ form, update, isOwner, id, usefulLinks, sops, addRow, updateRow, deleteRow }: Props) {
  // Clients filtered by product
  const { data: clients = [] } = useQuery({
    queryKey: ['product-clients', form.name],
    queryFn: async () => {
      if (!form.name) return [];
      const { data } = await supabase.from('clients').select('*').eq('current_product', form.name).order('full_name');
      return data || [];
    },
    enabled: !!form.name,
  });

  return (
    <div className="space-y-6">
      {/* Links Úteis */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Links Úteis</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_useful_links', data: { product_id: id, name: '', url: '' } })}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Link</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {usefulLinks.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem links</TableCell></TableRow>}
              {usefulLinks.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell><Input defaultValue={l.name} onBlur={e => updateRow.mutate({ table: 'product_useful_links', id: l.id, data: { name: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  <TableCell><Input defaultValue={l.url} onBlur={e => updateRow.mutate({ table: 'product_useful_links', id: l.id, data: { url: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} /></TableCell>
                  {isOwner && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow.mutate({ table: 'product_useful_links', id: l.id })}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lista de Clientes & Alunos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Lista de Clientes & Alunos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead>Fim de Ciclo</TableHead>
                <TableHead>F. Pagamento</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Whatsapp</TableHead>
                <TableHead>Aniversário</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-4">Sem clientes associados</TableCell></TableRow>}
              {clients.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{c.client_id}</TableCell>
                  <TableCell className="font-medium text-sm">{c.full_name}</TableCell>
                  <TableCell className="text-sm">{c.start_date || '—'}</TableCell>
                  <TableCell className="text-sm">{c.end_of_cycle || '—'}</TableCell>
                  <TableCell className="text-sm">{c.payment_method || '—'}</TableCell>
                  <TableCell className="text-sm">{c.email || '—'}</TableCell>
                  <TableCell className="text-sm">{c.whatsapp || '—'}</TableCell>
                  <TableCell className="text-sm">{c.birthday || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.observations || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Melhorias */}
      <Card>
        <CardHeader><CardTitle className="text-base">Melhorias</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor content={form.improvements_content || ''} onChange={v => update('improvements_content', v)} editable={isOwner} />
        </CardContent>
      </Card>

      {/* Processos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Processos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Produto/Serviço</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sops.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem processos para este produto</TableCell></TableRow>}
              {sops.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-mono">{s.sop_id}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.product_name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.updated_at), 'dd/MM/yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
