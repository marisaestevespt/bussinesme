import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  para_criar: { label: 'Para criar', className: 'bg-muted text-muted-foreground' },
  em_progresso: { label: 'Em progresso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 border-green-200' },
  a_rever: { label: 'A rever', className: 'bg-amber-100 text-amber-800 border-amber-200' },
};

const FREQ_MAP: Record<string, string> = {
  todos_os_dias: 'Todos os dias',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  pontual: 'Pontual',
  dia_x_mes: 'Dia X do mês',
  segunda: '2ª feira',
  terca: '3ª feira',
  quarta: '4ª feira',
  quinta: '5ª feira',
  sexta: '6ª feira',
  primeiro_dia_util: '1º dia útil do mês',
};

export function CommercialProcessos() {
  const navigate = useNavigate();

  const sops = useQuery({
    queryKey: ['sops', 'comercial'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').eq('department', 'comercial').order('sop_id');
      return data || [];
    },
  });

  const routines = useQuery({
    queryKey: ['routines', 'comercial'],
    queryFn: async () => {
      const { data } = await supabase.from('routines').select('*, profiles:assigned_to(full_name)').eq('department', 'comercial').order('name');
      return data || [];
    },
  });

  return (
    <div className="space-y-8">
      {/* SOPs */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Processos (SOPs)</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Produto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sops.data || []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem processos neste departamento</TableCell></TableRow>
              )}
              {(sops.data || []).map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.para_criar;
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/hub/processos/${s.id}`)}>
                    <TableCell className="font-mono text-sm">{s.sop_id}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                    <TableCell>{s.product_name || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      <Separator />

      {/* Routines */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Rotinas</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(routines.data || []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem rotinas neste departamento</TableCell></TableRow>
              )}
              {(routines.data || []).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{FREQ_MAP[r.frequency] || r.frequency}</TableCell>
                  <TableCell>{(r.profiles as any)?.full_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
