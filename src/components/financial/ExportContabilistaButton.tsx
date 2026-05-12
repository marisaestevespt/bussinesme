import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { excludeCancelled } from '@/lib/utils';
import { exportPdf } from '@/lib/exportPdf';
import { exportContabilistaExcel, getMonthLabel } from '@/lib/exportContabilista';
import { toast } from 'sonner';
import { sumRevenue } from '@/lib/salesCalculations';
import { formatEuro } from '@/lib/formatting';
import { locationLabel, regimeIvaLabel, regimeIrsLabel } from '@/lib/labelMaps';

interface Props { year: number; month: number; }

export function ExportContabilistaButton({ year, month }: Props) {
  const { settings } = useBusinessSettings();
  const fin = useFinancialData({ expenses: true, recurring: false, documents: true, payroll: true, contractors: true });
  const com = useCommercialData(year);

  const { data: businessSetup } = useQuery({
    queryKey: ['business-setup-export-contabilista'],
    queryFn: async () => {
      const { data } = await supabase.from('business_setup').select('*').limit(1).maybeSingle();
      return data;
    },
  });

  // Combina: business_setup (NIF, NISS, CAE, CIRS, IBAN, morada) + business_settings (regimes IVA/IRS, tipo)
  const s: any = settings || {};
  const bs: any = businessSetup || {};
  // IBAN vem dos métodos de pagamento configurados (business_setup.payment_methods)
  const paymentMethods: any[] = Array.isArray(bs.payment_methods) ? bs.payment_methods : [];
  const ibanMethod = paymentMethods.find((m: any) => m?.type === 'iban' && m?.value);
  const ibanFromMethods = ibanMethod?.value || '';
  const bancoFromMethods = ibanMethod?.label || '';
  const business: any = {
    ...bs,
    business_legal_name: bs.business_legal_name || s.business_name,
    nif: bs.nif,
    niss: bs.niss,
    cae_principal: bs.cae_principal,
    cae_secundarios: bs.cae_secundarios,
    cirs_code: bs.cirs_code,
    iban: bs.iban || ibanFromMethods,
    banco: bs.banco || bancoFromMethods,
    morada_fiscal: bs.morada_fiscal,
    regime_iva: regimeIvaLabel(s.tax_iva_regime),
    regime_fiscal: regimeIrsLabel(s.tax_irs_regime),
    payment_methods: paymentMethods,
  };

  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);
  const documents = fin.documents.data || [];
  const payrollAll = fin.payroll.data || [];
  const contractorsAll = fin.contractors.data || [];

  const { data: clientsAll = [] } = useQuery({
    queryKey: ['clients-export-contabilista'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, client_id, full_name, nif, email, whatsapp, fiscal_address, status, current_product');
      return data || [];
    },
  });

  const { data: suppliersAll = [] } = useQuery({
    queryKey: ['suppliers-export-contabilista'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*');
      return data || [];
    },
  });

  const monthSales = useMemo(
    () => sales.filter((s: any) => s.sale_year === year && s.sale_month === month),
    [sales, year, month],
  );
  const monthExpenses = useMemo(
    () => expenses.filter((e: any) => e.expense_year === year && e.expense_month === month),
    [expenses, year, month],
  );
  const monthDocs = useMemo(
    () => documents.filter((d: any) => d.period_year === year && d.period_month === month),
    [documents, year, month],
  );
  const monthPayroll = useMemo(
    () => payrollAll.filter((p: any) => p.year === year && p.month === month),
    [payrollAll, year, month],
  );
  const monthContractors = useMemo(
    () => contractorsAll.filter((c: any) => c.year === year && c.month === month),
    [contractorsAll, year, month],
  );

  // Apenas clientes/fornecedores envolvidos neste período
  const involvedClients = useMemo(() => {
    const names = new Set(monthSales.map((s: any) => s.client).filter(Boolean));
    return (clientsAll as any[]).filter(c => names.has(c.full_name));
  }, [clientsAll, monthSales]);

  const involvedSuppliers = useMemo(() => {
    const ids = new Set(monthExpenses.map((e: any) => e.supplier_id).filter(Boolean));
    const names = new Set(monthExpenses.map((e: any) => e.supplier_name).filter(Boolean));
    return (suppliersAll as any[]).filter(s => ids.has(s.id) || names.has(s.name));
  }, [suppliersAll, monthExpenses]);

  const label = getMonthLabel(year, month);
  const businessName = settings?.business_name || business?.business_legal_name || 'Negócio';

  const totalEnt = sumRevenue(monthSales);
  const totalEntBase = monthSales.reduce((s, v) => s + (v.base_value || 0), 0);
  const totalSai = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const totalSaiBase = monthExpenses.reduce((s, v) => s + (v.base_value || 0), 0);
  const totalPay = monthPayroll.reduce((s, v) => s + (v.total_cost || 0), 0);
  const totalCtr = monthContractors.reduce((s, v) => s + (v.value || 0), 0);

  const handleExcel = async () => {
    try {
      await exportContabilistaExcel({
        businessName, label, period: { year, month },
        business,
        sales: monthSales, expenses: monthExpenses, documents: monthDocs,
        payroll: monthPayroll, contractors: monthContractors,
        clients: involvedClients, suppliers: involvedSuppliers,
      });
      toast.success('Excel exportado (.xlsx)');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Falha ao gerar o Excel.');
    }
  };

  const handlePdf = () => {
    exportPdf(`Contabilidade — ${label}`, `contabilista-export-${year}-${month}`);
    toast.success('PDF a gerar...');
  };

  const exportId = `contabilista-export-${year}-${month}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-3.5 w-3.5" /> Exportar p/ contabilista
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePdf} className="gap-2">
            <FileText className="h-4 w-4" /> PDF (completo)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx, multi-folha)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden export area for PDF — completo */}
      <div id={exportId} className="hidden print:block text-xs">
        {/* Cabeçalho do negócio */}
        <div style={{ marginBottom: 18, padding: '14px 16px', background: '#f8fafc', borderLeft: '4px solid #0f172a', borderRadius: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1220', marginBottom: 4 }}>{businessName}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>
            NIF {business?.nif || '—'} {business?.niss ? ` • NISS ${business.niss}` : ''} • Período <strong style={{ color: '#0f172a' }}>{label}</strong>
          </div>
        </div>

        {/* Totais destacados */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 6, borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 600 }}>Entradas</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1220', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalEnt)}</div>
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>{monthSales.length} venda{monthSales.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 6, borderTop: '3px solid #ef4444' }}>
            <div style={{ fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 600 }}>Saídas</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1220', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalSai + totalPay + totalCtr)}</div>
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>Despesas + Salários + Prestadores</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 6, borderTop: '3px solid #0f172a' }}>
            <div style={{ fontSize: 7.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 600 }}>Resultado</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: totalEnt - totalSai - totalPay - totalCtr >= 0 ? '#10b981' : '#ef4444', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalEnt - totalSai - totalPay - totalCtr)}</div>
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>Bruto do período</div>
          </div>
        </div>

        {/* Resumo detalhado */}
        <h2>Resumo Financeiro</h2>
        <table className="pdf-summary-table">
          <tbody>
            <tr><td>Total Entradas</td><td className="text-right">{formatEuro(totalEnt)}</td><td>Total Saídas</td><td className="text-right">{formatEuro(totalSai)}</td></tr>
            <tr><td>Salários (custo total)</td><td className="text-right">{formatEuro(totalPay)}</td><td>Prestadores</td><td className="text-right">{formatEuro(totalCtr)}</td></tr>
          </tbody>
        </table>

        {/* Negócio */}
        <h2>Dados do Negócio</h2>
        <table className="pdf-summary-table"><tbody>
          <tr><td>NIF</td><td>{business?.nif || '—'}</td><td>NISS</td><td>{business?.niss || '—'}</td></tr>
          <tr><td>CAE</td><td>{business?.cae_principal || '—'}</td><td>Regime IVA</td><td>{business?.regime_iva || '—'}</td></tr>
          <tr><td>Regime Fiscal</td><td>{business?.regime_fiscal || '—'}</td><td>CIRS</td><td>{business?.cirs_code || '—'}</td></tr>
          <tr><td>IBAN</td><td colSpan={3}>{business?.iban || '—'} {business?.banco ? `(${business.banco})` : ''}</td></tr>
          <tr><td>Morada</td><td colSpan={3}>{business?.morada_fiscal || '—'}</td></tr>
        </tbody></table>

        {/* Vendas */}
        <h2>Entradas / Vendas <span style={{ color: '#94a3b8', fontWeight: 500 }}>({monthSales.length})</span></h2>
        <table>
          <thead><tr><th>Doc</th><th>Data</th><th>Cliente</th><th>NIF</th><th>Produto</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead>
          <tbody>
            {monthSales.map((s: any) => {
              const cli = involvedClients.find((c: any) => c.full_name === s.client) || {};
              return (
                <tr key={s.id}>
                  <td>{s.sale_id}</td><td>{s.payment_date}</td>
                  <td>{s.client}</td><td>{cli.nif || ''}</td>
                  <td>{s.product || s.description}</td>
                  <td className="text-right">{formatEuro(s.base_value || 0)}</td>
                  <td className="text-right">{formatEuro((s.invoice_total || 0) - (s.base_value || 0))}</td>
                  <td className="text-right">{formatEuro(s.invoice_total || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Despesas */}
        <h2>Saídas / Despesas <span style={{ color: '#94a3b8', fontWeight: 500 }}>({monthExpenses.length})</span></h2>
        <table>
          <thead><tr><th>Doc</th><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th>NIF</th><th>Loc.</th><th>Base</th><th>IVA%</th><th>Total</th><th>Fatura</th></tr></thead>
          <tbody>
            {monthExpenses.map((e: any) => {
              const sup = involvedSuppliers.find((s: any) => s.id === e.supplier_id) || {};
              const docs: any[] = Array.isArray(e.documents) ? e.documents : [];
              return (
                <tr key={e.id}>
                  <td>{e.expense_id}</td><td>{e.expense_date}</td>
                  <td>{e.description}</td><td>{e.category}</td>
                  <td>{e.supplier_name || sup.name || ''}</td><td>{sup.nif || ''}</td>
                  <td>{locationLabel(e.location, true)}</td>
                  <td className="text-right">{formatEuro(e.base_value || 0)}</td>
                  <td className="text-right">{e.vat_rate ?? 0}%</td>
                  <td className="text-right">{formatEuro(e.total_with_vat || 0)}</td>
                  <td>{docs.length > 0 ? docs.map((d, i) => (
                    <span key={i}>{i > 0 ? ', ' : ''}<a href={d.url} style={{ color: '#2563eb', textDecoration: 'underline' }}>Ver</a></span>
                  )) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Anexos das faturas de despesas — lista dedicada para o contabilista */}
        {monthExpenses.some((e: any) => Array.isArray(e.documents) && e.documents.length > 0) && (<>
          <h2>Anexos de faturas de despesas</h2>
          <table>
            <thead><tr><th>Doc</th><th>Data</th><th>Fornecedor</th><th>Total</th><th>Ficheiro</th><th>Link</th></tr></thead>
            <tbody>
              {monthExpenses.flatMap((e: any) => {
                const docs: any[] = Array.isArray(e.documents) ? e.documents : [];
                if (docs.length === 0) return [];
                return docs.map((d, i) => (
                  <tr key={e.id + '-' + i}>
                    <td>{e.expense_id}</td>
                    <td>{e.expense_date}</td>
                    <td>{e.supplier_name || ''}</td>
                    <td className="text-right">{formatEuro(e.total_with_vat || 0)}</td>
                    <td>{d.name || '—'}</td>
                    <td><a href={d.url} style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>{d.url}</a></td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </>)}

        {/* Salários */}
        {monthPayroll.length > 0 && (<>
          <h2>Salários <span style={{ color: '#94a3b8', fontWeight: 500 }}>({monthPayroll.length})</span></h2>
          <table>
            <thead><tr><th>Colaborador</th><th>Bruto</th><th>Ret.</th><th>SS Trab.</th><th>SS Emp.</th><th>Líquido</th><th>Custo Total</th></tr></thead>
            <tbody>
              {monthPayroll.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.collaborator_name}</td>
                  <td className="text-right">{formatEuro(p.gross_salary || 0)}</td>
                  <td className="text-right">{formatEuro(p.withholding_value || 0)}</td>
                  <td className="text-right">{formatEuro(p.ss_employee || 0)}</td>
                  <td className="text-right">{formatEuro(p.ss_employer || 0)}</td>
                  <td className="text-right">{formatEuro(p.net_salary || 0)}</td>
                  <td className="text-right">{formatEuro(p.total_cost || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {/* Prestadores */}
        {monthContractors.length > 0 && (<>
          <h2>Prestadores de Serviços <span style={{ color: '#94a3b8', fontWeight: 500 }}>({monthContractors.length})</span></h2>
          <table>
            <thead><tr><th>Prestador</th><th>Serviço</th><th>Localização</th><th>Valor</th></tr></thead>
            <tbody>
              {monthContractors.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.contractor_name}</td><td>{c.service}</td>
                  <td>{locationLabel(c.location, true)}</td>
                  <td className="text-right">{formatEuro(c.value || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {/* Clientes envolvidos */}
        {involvedClients.length > 0 && (<>
          <h2>Clientes do período <span style={{ color: '#94a3b8', fontWeight: 500 }}>({involvedClients.length})</span></h2>
          <table>
            <thead><tr><th>ID</th><th>Nome</th><th>NIF</th><th>Email</th><th>Morada Fiscal</th></tr></thead>
            <tbody>
              {involvedClients.map((c: any) => (
                <tr key={c.id}><td>{c.client_id}</td><td>{c.full_name}</td><td>{c.nif || ''}</td><td>{c.email || ''}</td><td>{c.fiscal_address || ''}</td></tr>
              ))}
            </tbody>
          </table>
        </>)}

        {/* Fornecedores envolvidos */}
        {involvedSuppliers.length > 0 && (<>
          <h2>Fornecedores do período <span style={{ color: '#94a3b8', fontWeight: 500 }}>({involvedSuppliers.length})</span></h2>
          <table>
            <thead><tr><th>Nome</th><th>NIF</th><th>Email</th><th>IBAN</th><th>Categoria</th></tr></thead>
            <tbody>
              {involvedSuppliers.map((s: any) => (
                <tr key={s.id}><td>{s.name}</td><td>{s.nif || ''}</td><td>{s.email || ''}</td><td>{s.iban || ''}</td><td>{s.category || ''}</td></tr>
              ))}
            </tbody>
          </table>
        </>)}

        {/* Documentos */}
        {monthDocs.length > 0 && (<>
          <h2>Documentos <span style={{ color: '#94a3b8', fontWeight: 500 }}>({monthDocs.length})</span></h2>
          <table>
            <thead><tr><th>Tipo</th><th>Nome</th><th>URL</th></tr></thead>
            <tbody>
              {monthDocs.map((d: any) => (
                <tr key={d.id}><td>{d.doc_type}</td><td>{d.document_name || d.title}</td><td>{d.document_url || ''}</td></tr>
              ))}
            </tbody>
          </table>
        </>)}
      </div>
    </>
  );
}
