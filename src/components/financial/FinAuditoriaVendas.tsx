import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SaleRow {
  id: string;
  sale_id: string;
  status: string;
  payment_date: string | null;
  base_value: number | null;
  invoice_total: number | null;
  product: string | null;
  product_id: string | null;
  client: string | null;
  project_id: string | null;
  documents: any;
  sale_month: number | null;
  sale_year: number | null;
}

interface ClientRow { id: string; full_name: string | null; }
interface ProjectRow { id: string; name: string | null; }
interface ProductRow { id: string; name: string | null; }

type DiffType =
  | 'paid_no_date'
  | 'value_inconsistent'
  | 'no_client'
  | 'paid_no_doc'
  | 'orphan_client'
  | 'orphan_project'
  | 'orphan_product'
  | 'product_name_drift'
  | 'date_period_mismatch'
  | 'duplicate_sale';

interface Diff {
  key: string;
  type: DiffType;
  sale: SaleRow;
  details: string;
  fixable: boolean;
  fix?: () => Promise<void>;
}

const TYPE_LABELS: Record<DiffType, string> = {
  paid_no_date: 'Pago sem data',
  value_inconsistent: 'Valores inconsistentes',
  no_client: 'Sem cliente',
  paid_no_doc: 'Pago sem documento',
  orphan_client: 'Cliente inexistente',
  orphan_project: 'Projeto inexistente',
  orphan_product: 'Produto inexistente',
  product_name_drift: 'Nome de produto desatualizado',
  date_period_mismatch: 'Período divergente da data',
  duplicate_sale: 'Venda duplicada',
};

const TYPE_COLORS: Record<DiffType, string> = {
  paid_no_date: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  value_inconsistent: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
  no_client: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  paid_no_doc: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  orphan_client: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
  orphan_project: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  orphan_product: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  product_name_drift: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
  date_period_mismatch: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  duplicate_sale: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
};

function normName(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function FinAuditoriaVendas() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [reconcilingAll, setReconcilingAll] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [s, c, pr, pd] = await Promise.all([
        supabase.from('commercial_sales').select('id,sale_id,status,payment_date,base_value,invoice_total,product,product_id,client,project_id,documents,sale_month,sale_year'),
        supabase.from('clients').select('id,full_name'),
        supabase.from('projects').select('id,name'),
        supabase.from('products').select('id,name'),
      ]);
      if (s.error) throw s.error;
      setSales((s.data as unknown as SaleRow[]) || []);
      setClients((c.data as unknown as ClientRow[]) || []);
      setProjects((pr.data as unknown as ProjectRow[]) || []);
      setProducts((pd.data as unknown as ProductRow[]) || []);
    } catch (e: any) {
      toast.error(`Erro a carregar vendas: ${e.message || ''}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const diffs = useMemo<Diff[]>(() => {
    const out: Diff[] = [];
    const clientByName = new Map<string, ClientRow>();
    clients.forEach(c => clientByName.set(normName(c.full_name), c));
    const projectById = new Map(projects.map(p => [p.id, p]));
    const productById = new Map(products.map(p => [p.id, p]));

    // Duplicate detection
    const saleIdGroups = new Map<string, SaleRow[]>();
    const fingerprintGroups = new Map<string, SaleRow[]>();
    sales.forEach(s => {
      if (s.sale_id) {
        const arr = saleIdGroups.get(s.sale_id) || [];
        arr.push(s);
        saleIdGroups.set(s.sale_id, arr);
      }
      const fp = `${normName(s.client)}|${s.product_id || normName(s.product)}|${s.sale_year}|${s.sale_month}|${Number(s.invoice_total || 0).toFixed(2)}`;
      const arr2 = fingerprintGroups.get(fp) || [];
      arr2.push(s);
      fingerprintGroups.set(fp, arr2);
    });

    sales.forEach(s => {
      const sStatus = (s.status || '').toLowerCase();
      const isPaid = sStatus === 'tudo_ok' || sStatus === 'pago_falta_fatura' || sStatus === 'pago';

      if (isPaid && !s.payment_date) {
        out.push({
          key: `pnd-${s.id}`,
          type: 'paid_no_date',
          sale: s,
          details: 'Venda marcada como paga mas sem data de pagamento.',
          fixable: false,
        });
      }

      const base = Number(s.base_value || 0);
      const total = Number(s.invoice_total || 0);
      if (total > 0 && base > total + 0.01) {
        out.push({
          key: `vi-${s.id}`,
          type: 'value_inconsistent',
          sale: s,
          details: `Base (${base.toFixed(2)}€) > Total (${total.toFixed(2)}€).`,
          fixable: false,
        });
      }

      if (!s.client || !s.client.trim()) {
        out.push({
          key: `nc-${s.id}`,
          type: 'no_client',
          sale: s,
          details: 'Venda sem cliente identificado.',
          fixable: false,
        });
      } else {
        const matched = clientByName.get(normName(s.client));
        if (!matched) {
          out.push({
            key: `oc-${s.id}`,
            type: 'orphan_client',
            sale: s,
            details: `Cliente "${s.client}" não existe na base de clientes.`,
            fixable: false,
          });
        }
      }

      if (isPaid) {
        const docs = Array.isArray(s.documents) ? s.documents : [];
        if (docs.length === 0) {
          out.push({
            key: `pndoc-${s.id}`,
            type: 'paid_no_doc',
            sale: s,
            details: 'Venda paga mas sem documento (fatura/recibo) anexado.',
            fixable: false,
          });
        }
      }

      if (s.project_id && !projectById.has(s.project_id)) {
        out.push({
          key: `op-${s.id}`,
          type: 'orphan_project',
          sale: s,
          details: 'Projeto associado já não existe.',
          fixable: true,
          fix: async () => {
            const { error } = await supabase.from('commercial_sales').update({ project_id: null }).eq('id', s.id);
            if (error) throw error;
          },
        });
      }

      if (s.product_id) {
        const prod = productById.get(s.product_id);
        if (!prod) {
          out.push({
            key: `oprod-${s.id}`,
            type: 'orphan_product',
            sale: s,
            details: 'Produto associado já não existe.',
            fixable: true,
            fix: async () => {
              const { error } = await supabase.from('commercial_sales').update({ product_id: null }).eq('id', s.id);
              if (error) throw error;
            },
          });
        } else if (prod.name && s.product && prod.name !== s.product) {
          out.push({
            key: `pnd-prod-${s.id}`,
            type: 'product_name_drift',
            sale: s,
            details: `Nome em cache: "${s.product}" · Atual: "${prod.name}".`,
            fixable: true,
            fix: async () => {
              const { error } = await supabase.from('commercial_sales').update({ product: prod.name }).eq('id', s.id);
              if (error) throw error;
            },
          });
        }
      }

      if (s.payment_date && (s.sale_month || s.sale_year)) {
        const d = new Date(s.payment_date);
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        if ((s.sale_month && s.sale_month !== m) || (s.sale_year && s.sale_year !== y)) {
          out.push({
            key: `dpm-${s.id}`,
            type: 'date_period_mismatch',
            sale: s,
            details: `Data ${s.payment_date} mas registada em ${s.sale_month}/${s.sale_year}.`,
            fixable: true,
            fix: async () => {
              const q = (Math.ceil(m / 3));
              const { error } = await supabase.from('commercial_sales').update({ sale_month: m, sale_year: y, sale_quarter: q }).eq('id', s.id);
              if (error) throw error;
            },
          });
        }
      }
    });

    // Duplicates
    saleIdGroups.forEach((arr, sid) => {
      if (arr.length > 1) {
        arr.forEach(s => {
          out.push({
            key: `dup-id-${s.id}`,
            type: 'duplicate_sale',
            sale: s,
            details: `Mesmo sale_id "${sid}" repetido ${arr.length}x.`,
            fixable: false,
          });
        });
      }
    });
    fingerprintGroups.forEach((arr, fp) => {
      if (arr.length > 1 && fp.split('|').filter(x => x && x !== '0.00').length >= 4) {
        arr.forEach(s => {
          if (out.some(d => d.key === `dup-id-${s.id}`)) return;
          out.push({
            key: `dup-fp-${s.id}`,
            type: 'duplicate_sale',
            sale: s,
            details: `Possível duplicado: mesmo cliente/produto/período/valor (${arr.length} registos).`,
            fixable: false,
          });
        });
      }
    });

    return out;
  }, [sales, clients, projects, products]);

  const counts = useMemo(() => {
    const c: Record<DiffType, number> = {
      paid_no_date: 0, value_inconsistent: 0, no_client: 0, paid_no_doc: 0,
      orphan_client: 0, orphan_project: 0, orphan_product: 0,
      product_name_drift: 0, date_period_mismatch: 0, duplicate_sale: 0,
    };
    diffs.forEach(d => { c[d.type] += 1; });
    return c;
  }, [diffs]);

  async function reconcile(diff: Diff) {
    if (!diff.fix) {
      toast.info('Esta diferença requer revisão manual.');
      return;
    }
    setReconciling(diff.key);
    try {
      await diff.fix();
      toast.success('Registo reconciliado');
      await load();
    } catch (e: any) {
      toast.error(`Erro: ${e.message || 'desconhecido'}`);
    } finally {
      setReconciling(null);
    }
  }

  async function reconcileAll() {
    const fixable = diffs.filter(d => d.fixable && d.fix);
    if (fixable.length === 0) return;
    setReconcilingAll(true);
    let ok = 0, fail = 0;
    for (const d of fixable) {
      try { await d.fix!(); ok++; } catch { fail++; }
    }
    setReconcilingAll(false);
    toast.success(`Reconciliação: ${ok} sucesso, ${fail} falhas`);
    await load();
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                ? 'Vendas e entradas financeiras estão 100% íntegras.'
                : `${diffs.length} diferença${diffs.length === 1 ? '' : 's'}. ${fixableCount} reconciliáve${fixableCount === 1 ? 'l' : 'is'} automaticamente.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading || reconcilingAll}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            {fixableCount > 0 && (
              <Button size="sm" onClick={reconcileAll} disabled={reconcilingAll}>
                <Wand2 className="h-4 w-4 mr-2" />
                {reconcilingAll ? 'A reconciliar...' : `Reconciliar (${fixableCount})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-3" />
              <p className="font-medium">Tudo em ordem</p>
              <p className="text-sm text-muted-foreground">Vendas estão consistentes com as entradas financeiras.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffs.map(d => (
                  <TableRow key={d.key}>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[d.type]}>{TYPE_LABELS[d.type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{d.sale.sale_id}</TableCell>
                    <TableCell>{d.sale.client || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.details}</TableCell>
                    <TableCell className="text-right">
                      {d.fixable ? (
                        <Button size="sm" variant="outline" onClick={() => reconcile(d)} disabled={reconciling === d.key || reconcilingAll}>
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
