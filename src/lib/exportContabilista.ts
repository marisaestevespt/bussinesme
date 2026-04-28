// Nota: exceljs é importado dinamicamente dentro da função para manter
// fora do bundle inicial (lib pesada, só usada quando o utilizador exporta).
import type { Workbook } from 'exceljs';

const ML = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LOC: Record<string, string> = { portugal: 'Portugal', ue: 'UE', fora_ue: 'Fora UE' };

const num = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** Coerce an arbitrary cell value to the spreadsheet `Cell` shape (string | number | null). */
const cell = (v: unknown): Cell => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};
/** Read a string field from a loose row, defaulting to ''. */
const s = (row: AnyRow, key: string): string => {
  const v = row[key];
  return v == null ? '' : String(v);
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
  const vendasRows: Cell[][] = sales.map(row => {
    const cli = clients.find(c => c.full_name === row.client) || {};
    return [
      s(row, 'sale_id'), s(row, 'payment_date'), s(row, 'client'), s(cli, 'nif'), s(cli, 'email'), s(cli, 'fiscal_address'),
      s(row, 'product'), s(row, 'description'),
      num(row.base_value), num(row.invoice_total) - num(row.base_value), num(row.invoice_total),
      s(row, 'payment_method'), s(row, 'status'), s(row, 'source'), s(row, 'project_id'),
      row.is_special_offer ? `Sim (${s(row, 'special_offer_reason')})` : 'Não',
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
    const sup = suppliers.find(sp => sp.id === e.supplier_id) || {};
    const loc = s(e, 'location');
    return [
      s(e, 'expense_id'), s(e, 'expense_date'), s(e, 'description') || s(e, 'expense_name'),
      s(e, 'category'), s(e, 'department'),
      s(e, 'supplier_name') || s(sup, 'name'), s(sup, 'nif'),
      LOC[loc] || loc,
      num(e.base_value), num(e.vat_rate ?? 0),
      num(e.total_with_vat) - num(e.base_value), num(e.total_with_vat),
      s(e, 'payment_method'), e.is_recurring ? 'Sim' : 'Não', s(e, 'periodicity'), s(e, 'status'),
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
      s(p, 'collaborator_name'), cell(p.month), cell(p.year),
      num(p.gross_salary), num(p.withholding_rate), num(p.withholding_value),
      num(p.ss_employee), num(p.ss_employer), num(p.net_salary), num(p.total_cost), s(p, 'status'),
    ]);
    payRows.push([]);
    payRows.push(['TOTAL', '', '', '', '', '', '', '', '', totalPayroll, '']);
    addSheet(wb, 'Salários', [payHeaders, ...payRows], [24, 6, 6, 14, 12, 14, 14, 14, 14, 14, 12]);
  }

  // ─── Folha 6: Prestadores ──────────────────────────────
  if (contractors.length > 0) {
    const cHeaders = ['Prestador', 'Mês', 'Ano', 'Serviço', 'Valor', 'Localização', 'Status', 'Nº Documento'];
    const cRows: Cell[][] = contractors.map(c => {
      const loc = s(c, 'location');
      return [
        s(c, 'contractor_name'), cell(c.month), cell(c.year),
        s(c, 'service'), num(c.value), LOC[loc] || loc,
        s(c, 'status'), s(c, 'expense_id'),
      ];
    });
    cRows.push([]);
    cRows.push(['TOTAL', '', '', '', totalContractors, '', '', '']);
    addSheet(wb, 'Prestadores', [cHeaders, ...cRows], [24, 6, 6, 28, 12, 12, 12, 12]);
  }

  // ─── Folha 7: Clientes (envolvidos no período) ──────────
  if (clients.length > 0) {
    const cliHeaders = ['ID Cliente', 'Nome', 'NIF', 'Email', 'WhatsApp', 'Morada Fiscal', 'Status', 'Produto Atual'];
    const cliRows: Cell[][] = clients.map(c => [
      s(c, 'client_id'), s(c, 'full_name'), s(c, 'nif'), s(c, 'email'),
      s(c, 'whatsapp'), s(c, 'fiscal_address'), s(c, 'status'), s(c, 'current_product'),
    ]);
    addSheet(wb, 'Clientes', [cliHeaders, ...cliRows], [12, 24, 12, 24, 16, 30, 12, 18]);
  }

  // ─── Folha 8: Fornecedores (envolvidos no período) ──────
  if (suppliers.length > 0) {
    const sHeaders = ['Nome', 'NIF', 'Email', 'Telefone', 'Morada', 'Categoria', 'IBAN', 'Método Pagamento', 'IVA Pred. (%)', 'Website'];
    const sRows: Cell[][] = suppliers.map(sup => [
      s(sup, 'name'), s(sup, 'nif'), s(sup, 'email'), s(sup, 'phone'),
      s(sup, 'address'), s(sup, 'category'), s(sup, 'iban'),
      s(sup, 'payment_method'), num(sup.default_vat_rate ?? 0), s(sup, 'website'),
    ]);
    addSheet(wb, 'Fornecedores', [sHeaders, ...sRows], [24, 12, 24, 14, 30, 16, 24, 16, 10, 24]);
  }

  // ─── Folha 9: Documentos ──────────────────────────────
  if (documents.length > 0) {
    const dHeaders = ['Tipo', 'Nome', 'Período', 'Data', 'Status', 'URL', 'Notas'];
    const dRows: Cell[][] = documents.map(d => [
      s(d, 'doc_type'), s(d, 'document_name') || s(d, 'title'),
      d.period_month && d.period_year ? `${d.period_month}/${d.period_year}` : '',
      s(d, 'period_start'), s(d, 'status'), s(d, 'document_url'), s(d, 'notes'),
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
