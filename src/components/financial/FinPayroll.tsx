import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEuro } from '@/lib/formatting';
import { CONTRACT_TYPES } from '@/hooks/useTeamData';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CONTRACT_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACT_TYPES.map(c => [c.value, c.label])
);

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-success/10 text-success' },
  terminado: { label: 'Terminado', className: 'bg-muted text-muted-foreground' },
  suspenso: { label: 'Suspenso', className: 'bg-warning/10 text-warning' },
};

interface Props {
  currentYear: number;
}

type ContractWithMember = {
  id: string;
  contract_type: string;
  contracted_hours: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_value: number | null;
  payment_day: number | null;
  status: string;
  notes: string | null;
  member_id: string;
  team_members: {
    id: string;
    full_name: string;
    role_title: string | null;
    department: string | null;
    ss_employer_rate: number | null;
  } | null;
};

export function FinPayroll({ currentYear }: Props) {
  const { data: contracts = [] } = useQuery({
    queryKey: ['member-contracts-with-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name, role_title, department, ss_employer_rate)')
        .order('start_date', { ascending: false });
      return (data || []) as ContractWithMember[];
    },
  });

  // Filter active contracts (or ones that were active during the current year)
  const relevantContracts = useMemo(() => {
    return contracts.filter(c => {
      if (c.status === 'ativo') return true;
      // Show terminated contracts if they ended during or after current year
      if (c.end_date) {
        const endYear = parseInt(c.end_date.slice(0, 4));
        return endYear >= currentYear;
      }
      return false;
    });
  }, [contracts, currentYear]);

  const grouped = useMemo(() => {
    const groups: Record<string, ContractWithMember[]> = {};
    relevantContracts.forEach(c => {
      const type = c.contract_type || 'outro';
      if (!groups[type]) groups[type] = [];
      groups[type].push(c);
    });
    return groups;
  }, [relevantContracts]);

  const hasContratoTrabalho = (grouped['contrato_trabalho'] || []).length > 0;
  const hasPrestacao = (grouped['contrato_prestacao'] || []).length > 0;
  const hasAcordo = (grouped['acordo'] || []).length > 0;
  const hasOutro = (grouped['outro'] || []).length > 0;

  const totalMensal = relevantContracts
    .filter(c => c.status === 'ativo')
    .reduce((s, c) => s + (c.monthly_value || 0), 0);

  const totalTrabalho = (grouped['contrato_trabalho'] || [])
    .filter(c => c.status === 'ativo')
    .reduce((s, c) => s + (c.monthly_value || 0), 0);

  const totalTrabalhoCusto = (grouped['contrato_trabalho'] || [])
    .filter(c => c.status === 'ativo')
    .reduce((s, c) => {
      const rate = c.team_members?.ss_employer_rate ?? 0.2375;
      return s + (c.monthly_value || 0) * (1 + Number(rate));
    }, 0);

  const totalPrestacao = (grouped['contrato_prestacao'] || [])
    .filter(c => c.status === 'ativo')
    .reduce((s, c) => s + (c.monthly_value || 0), 0);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const renderSection = (type: string, contracts: ContractWithMember[]) => (
    <div key={type}>
      <h3 className="text-lg font-semibold mb-3">{CONTRACT_LABELS[type] || type}</h3>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Valor Mensal</TableHead>
                {type === 'contrato_trabalho' && <TableHead className="text-right">SS Empresa</TableHead>}
                {type === 'contrato_trabalho' && <TableHead className="text-right">Custo Total</TableHead>}
                <TableHead>Dia Pgto.</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow><TableCell colSpan={type === 'contrato_trabalho' ? 10 : 8} className="text-center text-muted-foreground py-8">Sem registos</TableCell></TableRow>
              ) : contracts.map(c => {
                const st = STATUS_LABELS[c.status] || { label: c.status, className: '' };
                const ssRate = Number(c.team_members?.ss_employer_rate ?? 0.2375);
                const ssValue = (c.monthly_value || 0) * ssRate;
                const totalCost = (c.monthly_value || 0) + ssValue;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.team_members?.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.team_members?.role_title || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{c.monthly_value ? formatEuro(c.monthly_value) : '—'}</TableCell>
                    {type === 'contrato_trabalho' && (
                      <TableCell className="text-right text-muted-foreground">
                        {c.monthly_value ? `${formatEuro(ssValue)} (${(ssRate * 100).toFixed(2)}%)` : '—'}
                      </TableCell>
                    )}
                    {type === 'contrato_trabalho' && (
                      <TableCell className="text-right font-semibold">{c.monthly_value ? formatEuro(totalCost) : '—'}</TableCell>
                    )}
                    <TableCell>{c.payment_day ? `Dia ${c.payment_day}` : '—'}</TableCell>
                    <TableCell>{formatDate(c.start_date)}</TableCell>
                    <TableCell>{formatDate(c.end_date)}</TableCell>
                    <TableCell>{c.contracted_hours || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Mensal (Ativos)</p><p className="text-lg font-bold">{formatEuro(totalMensal)}</p></CardContent></Card>
        {hasContratoTrabalho && (
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Colaboradores Internos</p>
            <p className="text-lg font-bold">{formatEuro(totalTrabalhoCusto)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Custo total c/ SS empresa · bruto: {formatEuro(totalTrabalho)}</p>
          </CardContent></Card>
        )}
        {hasPrestacao && (
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Prestadores de Serviços</p><p className="text-lg font-bold">{formatEuro(totalPrestacao)}</p></CardContent></Card>
        )}
      </div>

      {/* Sections by contract type — only show if there are contracts */}
      {hasContratoTrabalho && renderSection('contrato_trabalho', grouped['contrato_trabalho'])}
      {hasPrestacao && renderSection('contrato_prestacao', grouped['contrato_prestacao'])}
      {hasAcordo && renderSection('acordo', grouped['acordo'])}
      {hasOutro && renderSection('outro', grouped['outro'])}

      {relevantContracts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Sem contratos configurados.</p>
            <p className="text-sm mt-1">Adicione membros de equipa e os seus contratos na secção Pessoas.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
