import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FinDoc {
  id: string;
  title: string;
  doc_type: string;
  period_start: string | null;
  period_end: string | null;
  period_month: number | null;
  period_year: number | null;
  due_date: string | null;
  status: string;
  document_url: string | null;
}

interface SaleRow {
  id: string;
  sale_id: string;
  client: string | null;
  status: string;
  documents: any;
}

interface ExpenseRow {
  id: string;
  expense_id: string;
  expense_name: string | null;
  description: string | null;
  status: string;
  documents: any;
}

type DiffType =
  | 'declaration_no_file'
  | 'declaration_no_period'
  | 'declaration_overdue'
  | 'declaration_invalid_period'
  | 'sale_paid_no_doc'
  | 'expense_paid_no_doc'
  | 'duplicate_attachment'
  | 'malformed_attachments';

interface Diff {
  key: string;
  type: DiffType;
  refLabel: string;
  details: string;
  fixable: boolean;
  fix?: () => Promise<void>;
}

const TYPE_LABELS: Record<DiffType, string> = {
  declaration_no_file: 'Declaração sem ficheiro',
  declaration_no_period: 'Declaração sem período',
  declaration_overdue: 'Declaração atrasada',
  declaration_invalid_period: 'Período inválido',
  sale_paid_no_doc: 'Venda paga sem doc',
  expense_paid_no_doc: 'Despesa paga sem doc',
  duplicate_attachment: 'Anexo duplicado',
  malformed_attachments: 'Anexos malformados',
};

const TYPE_COLORS: Record<DiffType, string> = {
  declaration_no_file: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  declaration_no_period: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  declaration_overdue: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
  declaration_invalid_period: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
  sale_paid_no_doc: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  expense_paid_no_doc: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  duplicate_attachment: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
  malformed_attachments: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
};

function extractUrls(documents: any): string[] {
  if (!Array.isArray(documents)) return [];
  return documents
    .map(d => (typeof d === 'string' ? d : d?.url || d?.document_url || ''))
    .filter(u => typeof u === 'string' && u.length > 0);
}

function isMalformed(documents: any): boolean {
  if (documents === null || documents === undefined) return false;
  if (!Array.isArray(documents)) return true;
  return documents.some(d => {
    if (typeof d === 'string') return d.length === 0;
    if (typeof d !== 'object' || d === null) return true;
    const url = d.url || d.document_url;
    return !url || typeof url !== 'string';
  });
}

export function FinAuditoriaDocumentos() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [docs, setDocs] = useState<FinDoc[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [d, s, e] = await Promise.all([
        supabase.from('financial_documents').select('id,title,doc_type,period_start,period_end,period_month,period_year,due_date,status,document_url'),
        supabase.from('commercial_sales').select('id,sale_id,client,status,documents'),
        supabase.from('financial_expenses').select('id,expense_id,expense_name,description,status,documents'),
      ]);
      if (d.error) throw d.error;
      setDocs((d.data as unknown as FinDoc[]) || []);
      setSales((s.data as unknown as SaleRow[]) || []);
      setExpenses((e.data as unknown as ExpenseRow[]) || []);
    } catch (e: any) {
      toast.error(`Erro a carregar: ${e.message || ''}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const diffs = useMemo<Diff[]>(() => {
    const out: Diff[] = [];
    const today = new Date().toISOString().slice(0, 10);

    docs.forEach(d => {
      const isSubmitted = ['submetido', 'pago', 'concluido'].includes((d.status || '').toLowerCase());

      if (isSubmitted && !d.document_url) {
        out.push({
          key: `dnf-${d.id}`,
          type: 'declaration_no_file',
          refLabel: d.title,
          details: `Declaração "${d.doc_type}" marcada como submetida sem ficheiro anexo.`,
          fixable: false,
        });
      }

      if (!d.period_year || !d.period_month) {
        out.push({
          key: `dnp-${d.id}`,
          type: 'declaration_no_period',
          refLabel: d.title,
          details: 'Declaração sem mês/ano de referência.',
          fixable: false,
        });
      }

      if (d.due_date && !isSubmitted && d.due_date < today) {
        out.push({
          key: `dov-${d.id}`,
          type: 'declaration_overdue',
          refLabel: d.title,
          details: `Prazo (${d.due_date}) ultrapassado. Status: ${d.status}.`,
          fixable: false,
        });
      }

      if (d.period_start && d.period_end && d.period_end < d.period_start) {
        out.push({
          key: `dip-${d.id}`,
          type: 'declaration_invalid_period',
          refLabel: d.title,
          details: `Fim (${d.period_end}) anterior ao início (${d.period_start}).`,
          fixable: false,
        });
      }
    });

    // Cross-table: paid sales/expenses without attached docs
    sales.forEach(s => {
      const sStatus = (s.status || '').toLowerCase();
      const paid = sStatus === 'tudo_ok' || sStatus === 'pago_falta_fatura' || sStatus === 'pago';
      if (paid && extractUrls(s.documents).length === 0) {
        out.push({
          key: `spnd-${s.id}`,
          type: 'sale_paid_no_doc',
          refLabel: s.sale_id,
          details: `Venda paga (cliente: ${s.client || '—'}) sem fatura/recibo anexado.`,
          fixable: false,
        });
      }
      if (isMalformed(s.documents)) {
        out.push({
          key: `sma-${s.id}`,
          type: 'malformed_attachments',
          refLabel: s.sale_id,
          details: 'Campo de anexos da venda está malformado.',
          fixable: true,
          fix: async () => {
            const clean = Array.isArray(s.documents)
              ? s.documents.filter((x: any) => (typeof x === 'string' && x) || (x && (x.url || x.document_url)))
              : [];
            const { error } = await supabase.from('commercial_sales').update({ documents: clean }).eq('id', s.id);
            if (error) throw error;
          },
        });
      }
    });

    expenses.forEach(e => {
      const paid = (e.status || '').toLowerCase() === 'pago';
      if (paid && extractUrls(e.documents).length === 0) {
        out.push({
          key: `epnd-${e.id}`,
          type: 'expense_paid_no_doc',
          refLabel: e.expense_id,
          details: `Despesa paga (${e.expense_name || e.description || '—'}) sem fatura anexada.`,
          fixable: false,
        });
      }
      if (isMalformed(e.documents)) {
        out.push({
          key: `ema-${e.id}`,
          type: 'malformed_attachments',
          refLabel: e.expense_id,
          details: 'Campo de anexos da despesa está malformado.',
          fixable: true,
          fix: async () => {
            const clean = Array.isArray(e.documents)
              ? e.documents.filter((x: any) => (typeof x === 'string' && x) || (x && (x.url || x.document_url)))
              : [];
            const { error } = await supabase.from('financial_expenses').update({ documents: clean }).eq('id', e.id);
            if (error) throw error;
          },
        });
      }
    });

    // Duplicate attachments across all sources
    const urlMap = new Map<string, { source: string; ref: string }[]>();
    sales.forEach(s => extractUrls(s.documents).forEach(url => {
      const arr = urlMap.get(url) || [];
      arr.push({ source: 'venda', ref: s.sale_id });
      urlMap.set(url, arr);
    }));
    expenses.forEach(e => extractUrls(e.documents).forEach(url => {
      const arr = urlMap.get(url) || [];
      arr.push({ source: 'despesa', ref: e.expense_id });
      urlMap.set(url, arr);
    }));
    docs.forEach(d => {
      if (d.document_url) {
        const arr = urlMap.get(d.document_url) || [];
        arr.push({ source: 'declaração', ref: d.title });
        urlMap.set(d.document_url, arr);
      }
    });
    urlMap.forEach((refs, url) => {
      if (refs.length > 1) {
        out.push({
          key: `dup-${btoa(url).slice(0, 16)}`,
          type: 'duplicate_attachment',
          refLabel: refs.map(r => `${r.source}:${r.ref}`).join(', '),
          details: `Mesmo URL anexado em ${refs.length} registos diferentes.`,
          fixable: false,
        });
      }
    });

    return out;
  }, [docs, sales, expenses]);

  const counts = useMemo(() => {
    const c: Record<DiffType, number> = {
      declaration_no_file: 0, declaration_no_period: 0, declaration_overdue: 0, declaration_invalid_period: 0,
      sale_paid_no_doc: 0, expense_paid_no_doc: 0, duplicate_attachment: 0, malformed_attachments: 0,
    };
    diffs.forEach(d => { c[d.type] += 1; });
    return c;
  }, [diffs]);

  async function reconcile(diff: Diff) {
    if (!diff.fix) return;
    setReconciling(diff.key);
    try {
      await diff.fix();
      toast.success('Registo reconciliado');
      await load();
    } catch (e: any) {
      toast.error(`Erro: ${e.message || ''}`);
    } finally {
      setReconciling(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fixableCount = diffs.filter(d => d.fixable).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(TYPE_LABELS) as DiffType[]).map(t => (
          <Card key={t}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">{TYPE_LABELS[t]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${counts[t] > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className="text-2xl font-semibold">{counts[t]}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Diferenças encontradas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {diffs.length === 0
                ? 'Documentos financeiros estão 100% íntegros.'
                : `${diffs.length} diferença${diffs.length === 1 ? '' : 's'}. ${fixableCount} reconciliáve${fixableCount === 1 ? 'l' : 'is'} automaticamente.`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-3" />
              <p className="font-medium">Tudo em ordem</p>
              <p className="text-sm text-muted-foreground">Todos os documentos estão consistentes.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffs.map(d => (
                  <TableRow key={d.key}>
                    <TableCell><Badge variant="secondary" className={TYPE_COLORS[d.type]}>{TYPE_LABELS[d.type]}</Badge></TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={d.refLabel}>{d.refLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.details}</TableCell>
                    <TableCell className="text-right">
                      {d.fixable ? (
                        <Button size="sm" variant="outline" onClick={() => reconcile(d)} disabled={reconciling === d.key}>
                          {reconciling === d.key ? 'A reconciliar...' : 'Reconciliar'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Revisão manual</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
