import { exportCsv } from './exportCsv';

const ML = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const LOC: Record<string, string> = { portugal: 'Portugal', ue: 'UE', fora_ue: 'Fora UE' };

export interface ExportData {
  businessName: string;
  label: string;
  sales: any[];
  expenses: any[];
  documents: any[];
}

export function buildContabilistaCsv({ businessName, label, sales, expenses, documents }: ExportData) {
  const salesHeaders = ['Data', 'Descrição', 'Produto', 'Cliente', 'NIF Cliente', 'Valor s/IVA', 'IVA', 'Valor c/IVA', 'Nº Documento'];
  const salesRows = sales.map(s => [
    s.payment_date || '', s.description || '', s.product || '', s.client || '', s.client_nif || '',
    s.base_value, s.invoice_total - s.base_value, s.invoice_total, s.sale_id,
  ]);

  const expHeaders = ['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Localização', 'Valor s/IVA', 'IVA (%)', 'IVA (€)', 'Valor c/IVA', 'Departamento', 'Nº Documento'];
  const expRows = expenses.map(e => [
    e.expense_date || '', e.description || '', e.category || '', e.supplier_name || '',
    LOC[e.location] || e.location || '', e.base_value, e.vat_rate ?? 0,
    e.total_with_vat - e.base_value, e.total_with_vat, e.department || '', e.expense_id,
  ]);

  const totalEnt = sales.reduce((s, v) => s + v.invoice_total, 0);
  const totalSai = expenses.reduce((s, v) => s + v.total_with_vat, 0);

  const colCount = Math.max(salesHeaders.length, expHeaders.length) + 1;
  const pad = (arr: any[], len: number) => [...arr, ...Array(Math.max(0, len - arr.length)).fill('')];

  const allHeaders = ['Secção', ...expHeaders];
  const allRows: (string | number)[][] = [
    pad(['RESUMO', businessName], colCount),
    pad(['', 'Período', label], colCount),
    pad(['', 'Total Entradas', '', '', '', fmt(totalEnt)], colCount),
    pad(['', 'Total Saídas', '', '', '', fmt(totalSai)], colCount),
    pad(['', 'Resultado', '', '', '', fmt(totalEnt - totalSai)], colCount),
    pad([], colCount),
    pad(['ENTRADAS', ...salesHeaders], colCount),
    ...salesRows.map(r => pad(['', ...r], colCount)),
    pad([], colCount),
    ['SAÍDAS', ...expHeaders],
    ...expRows.map(r => ['', ...r]),
  ];

  const bankDocs = documents.filter(d => d.doc_type === 'extrato_bancario');
  const metaDocs = documents.filter(d => d.doc_type === 'meta_ads_report');
  const otherDocs = documents.filter(d => d.doc_type !== 'extrato_bancario' && d.doc_type !== 'meta_ads_report');

  if (bankDocs.length > 0) {
    allRows.push(pad([], colCount));
    allRows.push(pad(['EXTRATOS BANCÁRIOS', 'Nome', 'Mês', 'URL'], colCount));
    bankDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', `${d.period_month}/${d.period_year}`, d.document_url || ''], colCount)));
  }
  if (metaDocs.length > 0) {
    allRows.push(pad([], colCount));
    allRows.push(pad(['RELATÓRIOS META ADS', 'Nome', 'Mês', 'URL'], colCount));
    metaDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', `${d.period_month}/${d.period_year}`, d.document_url || ''], colCount)));
  }
  if (otherDocs.length > 0) {
    allRows.push(pad([], colCount));
    allRows.push(pad(['DOCUMENTOS', 'Nome', 'Data'], colCount));
    otherDocs.forEach(d => allRows.push(pad(['', d.document_name || d.title || '', d.period_start || ''], colCount)));
  }

  return { headers: allHeaders, rows: allRows };
}

export function exportContabilistaCsv(data: ExportData) {
  const { headers, rows } = buildContabilistaCsv(data);
  const safeLabel = data.label.replace(/\s/g, '_').replace(/[^\w\-_.]/g, '');
  exportCsv(`contabilidade_${safeLabel}.csv`, headers, rows);
}

export function getMonthLabel(year: number, month: number) {
  return `${ML[month - 1]} ${year}`;
}