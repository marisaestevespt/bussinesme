// Nota: exceljs é importado dinamicamente dentro da função para manter
// fora do bundle inicial (lib pesada, só usada quando o utilizador exporta).
import type { Workbook } from 'exceljs';

const ML = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LOC: Record<string, string> = { portugal: 'Portugal', ue: 'UE', fora_ue: 'Fora UE' };

const num = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// Loose row shapes — these come from heterogeneous DB queries shaped at the call site.
// We keep them permissive (Record<string, unknown>) so that this exporter remains
// tolerant to schema additions without breaking. Numeric helpers go through `num()`.
type AnyRow = Record<string, unknown>;
interface BusinessShape extends AnyRow {
  business_legal_name?: string | null;
  nif?: string | null;
  niss?: string | null;
  cae_principal?: string | null;
  cae_secundarios?: string[] | string | null;
  regime_fiscal?: string | null;
  regime_iva?: string | null;
  cirs_code?: string | null;
  capital_social?: string | number | null;
  morada_fiscal?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  iban?: string | null;
  banco?: string | null;
  contabilista?: string | null;
  contabilista_contacto?: string | null;
  notas?: string | null;
}

export interface ContabilistaExportInput {
  businessName: string;
  label: string;
  period: { year: number; month?: number };
  business: BusinessShape | null;
  sales: AnyRow[];
  expenses: AnyRow[];
  documents: AnyRow[];
  payroll: AnyRow[];
  contractors: AnyRow[];
  clients: AnyRow[];
  suppliers: AnyRow[];
}

export function getMonthLabel(year: number, month: number) {
  return `${ML[month - 1]} ${year}`;
}

type Cell = string | number | null;

function addSheet(
  wb: Workbook,
  name: string,
  rows: Cell[][],
  widths: number[],
) {
  const ws = wb.addWorksheet(name);
  ws.columns = widths.map((w) => ({ width: w }));
  rows.forEach((r) => ws.addRow(r));
}

export async function exportContabilistaExcel(data: ContabilistaExportInput) {
  // Lazy import — evita meter exceljs no bundle inicial
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const { businessName, label, business, sales, expenses, documents, payroll, contractors, clients, suppliers } = data;

  const totalEnt = sales.reduce((s, v) => s + num(v.invoice_total), 0);
  const totalEntBase = sales.reduce((s, v) => s + num(v.base_value), 0);
  const totalIvaLiq = totalEnt - totalEntBase;
  const totalSai = expenses.reduce((s, v) => s + num(v.total_with_vat), 0);
  const totalSaiBase = expenses.reduce((s, v) => s + num(v.base_value), 0);
  const totalIvaDed = totalSai - totalSaiBase;
  const totalPayroll = payroll.reduce((s, v) => s + num(v.total_cost), 0);
  const totalContractors = contractors.reduce((s, v) => s + num(v.value), 0);

  // ─── Folha 1: Resumo ──────────────────────────────
  const resumo: Cell[][] = [
    ['EXPORTAÇÃO PARA CONTABILISTA'],
    [],
    ['Negócio', businessName],
    ['NIF', business?.nif || ''],
    ['Período', label],
    ['Data exportação', new Date().toLocaleDateString('pt-PT')],
    [],
    ['RESUMO FINANCEIRO'],
    ['Total Entradas (c/IVA)', totalEnt],
    ['  Base tributável', totalEntBase],
    ['  IVA liquidado', totalIvaLiq],
    [],
    ['Total Saídas (c/IVA)', totalSai],
    ['  Base tributável', totalSaiBase],
    ['  IVA dedutível', totalIvaDed],
    [],
    ['Salários (custo total)', totalPayroll],
    ['Prestadores de serviços', totalContractors],
    [],
    ['IVA a entregar / a receber', totalIvaLiq - totalIvaDed],
    ['Resultado bruto', totalEnt - totalSai - totalPayroll - totalContractors],
    [],
    ['CONTAGENS'],
    ['Nº de vendas', sales.length],
    ['Nº de despesas', expenses.length],
    ['Nº de salários', payroll.length],
    ['Nº de prestadores', contractors.length],
    ['Nº de clientes', clients.length],
    ['Nº de fornecedores', suppliers.length],
    ['Nº de documentos', documents.length],
  ];
  addSheet(wb, 'Resumo', resumo, [32, 24]);

  // ─── Folha 2: Negócio ──────────────────────────────
  const neg: Cell[][] = [
    ['DADOS DO NEGÓCIO'],
    [],
    ['Designação', business?.business_legal_name || businessName],
    ['NIF', business?.nif || ''],
    ['NISS', business?.niss || ''],
    ['CAE Principal', business?.cae_principal || ''],
    ['CAE Secundários', Array.isArray(business?.cae_secundarios) ? business.cae_secundarios.join(', ') : (business?.cae_secundarios || '')],
    ['Regime Fiscal', business?.regime_fiscal || ''],
    ['Regime IVA', business?.regime_iva || ''],
    ['Código CIRS', business?.cirs_code || ''],
    ['Capital Social', business?.capital_social || ''],
    ['Morada Fiscal', business?.morada_fiscal || ''],
    ['Email', business?.business_email || ''],
    ['Telefone', business?.business_phone || ''],
    ['Website', business?.business_website || ''],
    ['IBAN', business?.iban || ''],
    ['Banco', business?.banco || ''],
    ['Contabilista', business?.contabilista || ''],
    ['Contacto contabilista', business?.contabilista_contacto || ''],
    ['Notas', business?.notas || ''],
  ];
  addSheet(wb, 'Negócio', neg, [24, 60]);

  // ─── Folha 3: Vendas ──────────────────────────────
  const vendasHeaders = [
    'Nº Documento', 'Data Pagamento', 'Cliente', 'NIF Cliente', 'Email Cliente', 'Morada Cliente',
    'Produto', 'Descrição', 'Base s/IVA', 'IVA (€)', 'Total c/IVA',
    'Método Pagamento', 'Status', 'Fonte', 'Projeto ID', 'Oferta Especial',
  ];
  const vendasRows: Cell[][] = sales.map(s => {
    const cli = clients.find(c => c.full_name === s.client) || {};
    return [
      s.sale_id || '', s.payment_date || '', s.client || '', cli.nif || '', cli.email || '', cli.fiscal_address || '',
      s.product || '', s.description || '',
      num(s.base_value), num(s.invoice_total) - num(s.base_value), num(s.invoice_total),
      s.payment_method || '', s.status || '', s.source || '', s.project_id || '',
      s.is_special_offer ? `Sim (${s.special_offer_reason || ''})` : 'Não',
    ];
  });
  vendasRows.push([]);
  vendasRows.push(['', '', '', '', '', '', '', 'TOTAL', totalEntBase, totalIvaLiq, totalEnt, '', '', '', '', '']);
  addSheet(wb, 'Vendas', [vendasHeaders, ...vendasRows], [12, 12, 24, 12, 24, 30, 18, 28, 12, 10, 12, 16, 12, 14, 12, 18]);

  // ─── Folha 4: Despesas ──────────────────────────────
  const desHeaders = [
    'Nº Documento', 'Data', 'Descrição', 'Categoria', 'Departamento',
    'Fornecedor', 'NIF Fornecedor', 'Localização',
    'Base s/IVA', 'IVA (%)', 'IVA (€)', 'Total c/IVA',
    'Método Pagamento', 'Recorrente', 'Periodicidade', 'Status',
  ];
  const desRows: Cell[][] = expenses.map(e => {
    const sup = suppliers.find(s => s.id === e.supplier_id) || {};
    return [
      e.expense_id || '', e.expense_date || '', e.description || e.expense_name || '',
      e.category || '', e.department || '',
      e.supplier_name || sup.name || '', sup.nif || '',
      LOC[e.location] || e.location || '',
      num(e.base_value), num(e.vat_rate ?? 0),
      num(e.total_with_vat) - num(e.base_value), num(e.total_with_vat),
      e.payment_method || '', e.is_recurring ? 'Sim' : 'Não', e.periodicity || '', e.status || '',
    ];
  });
  desRows.push([]);
  desRows.push(['', '', '', '', '', '', '', 'TOTAL', totalSaiBase, '', totalIvaDed, totalSai, '', '', '', '']);
  addSheet(wb, 'Despesas', [desHeaders, ...desRows], [12, 12, 28, 16, 14, 22, 12, 12, 12, 8, 10, 12, 16, 10, 14, 12]);

  // ─── Folha 5: Salários ──────────────────────────────
  if (payroll.length > 0) {
    const payHeaders = [
      'Colaborador', 'Mês', 'Ano',
      'Salário Bruto', 'Retenção (%)', 'Retenção (€)',
      'SS Trabalhador', 'SS Empresa', 'Salário Líquido', 'Custo Total', 'Status',
    ];
    const payRows: Cell[][] = payroll.map(p => [
      p.collaborator_name || '', p.month || '', p.year || '',
      num(p.gross_salary), num(p.withholding_rate), num(p.withholding_value),
      num(p.ss_employee), num(p.ss_employer), num(p.net_salary), num(p.total_cost), p.status || '',
    ]);
    payRows.push([]);
    payRows.push(['TOTAL', '', '', '', '', '', '', '', '', totalPayroll, '']);
    addSheet(wb, 'Salários', [payHeaders, ...payRows], [24, 6, 6, 14, 12, 14, 14, 14, 14, 14, 12]);
  }

  // ─── Folha 6: Prestadores ──────────────────────────────
  if (contractors.length > 0) {
    const cHeaders = ['Prestador', 'Mês', 'Ano', 'Serviço', 'Valor', 'Localização', 'Status', 'Nº Documento'];
    const cRows: Cell[][] = contractors.map(c => [
      c.contractor_name || '', c.month || '', c.year || '',
      c.service || '', num(c.value), LOC[c.location] || c.location || '',
      c.status || '', c.expense_id || '',
    ]);
    cRows.push([]);
    cRows.push(['TOTAL', '', '', '', totalContractors, '', '', '']);
    addSheet(wb, 'Prestadores', [cHeaders, ...cRows], [24, 6, 6, 28, 12, 12, 12, 12]);
  }

  // ─── Folha 7: Clientes (envolvidos no período) ──────────
  if (clients.length > 0) {
    const cliHeaders = ['ID Cliente', 'Nome', 'NIF', 'Email', 'WhatsApp', 'Morada Fiscal', 'Status', 'Produto Atual'];
    const cliRows: Cell[][] = clients.map(c => [
      c.client_id || '', c.full_name || '', c.nif || '', c.email || '',
      c.whatsapp || '', c.fiscal_address || '', c.status || '', c.current_product || '',
    ]);
    addSheet(wb, 'Clientes', [cliHeaders, ...cliRows], [12, 24, 12, 24, 16, 30, 12, 18]);
  }

  // ─── Folha 8: Fornecedores (envolvidos no período) ──────
  if (suppliers.length > 0) {
    const sHeaders = ['Nome', 'NIF', 'Email', 'Telefone', 'Morada', 'Categoria', 'IBAN', 'Método Pagamento', 'IVA Pred. (%)', 'Website'];
    const sRows: Cell[][] = suppliers.map(s => [
      s.name || '', s.nif || '', s.email || '', s.phone || '',
      s.address || '', s.category || '', s.iban || '',
      s.payment_method || '', num(s.default_vat_rate ?? 0), s.website || '',
    ]);
    addSheet(wb, 'Fornecedores', [sHeaders, ...sRows], [24, 12, 24, 14, 30, 16, 24, 16, 10, 24]);
  }

  // ─── Folha 9: Documentos ──────────────────────────────
  if (documents.length > 0) {
    const dHeaders = ['Tipo', 'Nome', 'Período', 'Data', 'Status', 'URL', 'Notas'];
    const dRows: Cell[][] = documents.map(d => [
      d.doc_type || '', d.document_name || d.title || '',
      d.period_month && d.period_year ? `${d.period_month}/${d.period_year}` : '',
      d.period_start || '', d.status || '', d.document_url || '', d.notes || '',
    ]);
    addSheet(wb, 'Documentos', [dHeaders, ...dRows], [20, 28, 12, 12, 12, 50, 28]);
  }

  const safeLabel = label.replace(/\s/g, '_').replace(/[^\w\-_.]/g, '');
  // Gera o ficheiro como buffer e força download via blob (compatível com browser)
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contabilidade_${safeLabel}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
