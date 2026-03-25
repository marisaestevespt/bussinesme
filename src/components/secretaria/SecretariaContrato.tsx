import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { useMyTeamMember } from './secretaria-shared';

export default function SecretariaContrato() {
  const teamMember = useMyTeamMember();

  const contracts = useQuery({
    queryKey: ['my-contracts', teamMember.data?.id],
    enabled: !!teamMember.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_contracts').select('*').eq('member_id', teamMember.data!.id).order('start_date', { ascending: false });
      return data || [];
    },
  });

  const payments = useQuery({
    queryKey: ['my-payments', teamMember.data?.id],
    enabled: !!teamMember.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_payments').select('*').eq('member_id', teamMember.data!.id).order('year', { ascending: false });
      return data || [];
    },
  });

  const currentYear = new Date().getFullYear();
  const yearTotal = (payments.data || []).filter(p => p.year === currentYear && p.status === 'pago').reduce((s, p) => s + Number(p.net_value || 0), 0);
  const activeContract = (contracts.data || []).find(c => c.status === 'ativo');

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">O Meu Contrato</CardTitle></CardHeader>
        <CardContent>
          {!activeContract ? (
            <p className="text-sm text-muted-foreground">Sem contrato registado.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{activeContract.contract_type?.replace('_', ' ')}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de início</p><p className="font-medium">{activeContract.start_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de fim</p><p className="font-medium">{activeContract.end_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className="capitalize">{activeContract.status}</Badge></div>
              {activeContract.document_url && (
                <div className="col-span-full"><Button variant="outline" size="sm" asChild><a href={activeContract.document_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" /> Ver Documento</a></Button></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Os Meus Pagamentos</CardTitle>
            <Badge variant="outline">Total pago {currentYear}: {yearTotal.toFixed(2)} €</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments.data || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem pagamentos registados.</TableCell></TableRow>}
              {(payments.data || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.month}/{p.year}</TableCell>
                  <TableCell className="text-sm capitalize">{p.payment_type?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-sm">{Number(p.gross_value).toFixed(2)} €</TableCell>
                  <TableCell className="text-sm font-medium">{Number(p.net_value).toFixed(2)} €</TableCell>
                  <TableCell><Badge variant={p.status === 'pago' ? 'default' : 'outline'} className="text-[10px]">{p.status === 'pago' ? 'Pago' : 'Por Pagar'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
