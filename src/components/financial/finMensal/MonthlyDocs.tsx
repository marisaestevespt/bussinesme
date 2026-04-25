import { useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUp, ExternalLink, Trash2 as TrashIcon, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { type FiscalConfig } from '@/lib/fiscalDeadlines';
import { MONTHS } from './helpers';
import { EmptyHint } from '@/components/ui/loading-skeletons';

type DocRow = { id: string; document_url?: string | null; document_name?: string | null; title?: string | null };
type FiscalCheckRow = { id: string; check_key: string; checked: boolean };
type DeadlineCompletionRow = { id: string; deadline_key: string };

export function MonthlyDocUpload({ title, icon, docs, accept, onUpload, onDelete }: {
  title: string;
  icon: React.ReactNode;
  docs: DocRow[];
  docType: string;
  accept: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            <span>{title}</span>
          </div>
          <div>
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5 mr-1" />
              {uploading ? 'A carregar...' : 'Upload'}
            </Button>
          </div>
        </div>
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm rounded-md bg-muted/50 px-3 py-1.5">
                <a href={doc.document_url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0 hover:underline text-foreground">
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.document_name || doc.title}</span>
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onDelete(doc.id)}>
                  <TrashIcon className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint>Nenhum ficheiro carregado para este mês.</EmptyHint>
        )}
      </CardContent>
    </Card>
  );
}

export function FiscalChecklistCard({ month, year }: { month: number; year: number }) {
  const { settings } = useBusinessSettings();
  const qc = useQueryClient();
  const s = settings as Record<string, unknown> | null;

  const fiscalConfig: FiscalConfig = useMemo(() => ({
    taxIvaRegime: (s?.tax_iva_regime as FiscalConfig['taxIvaRegime']) || 'trimestral',
    taxIrsRegime: (s?.tax_irs_regime as FiscalConfig['taxIrsRegime']) || 'simplificado',
    ssExempt: (s?.ss_exempt as boolean) ?? false,
    ivaExempt: (s?.iva_exempt as boolean) ?? false,
    ivaExemptionEndDate: (s?.iva_exemption_end_date as string | null) || null,
    ssExemptionEndDate: (s?.ss_exemption_end_date as string | null) || null,
    hasAccountant: (s?.has_accountant as boolean) ?? false,
  }), [s]);

  const isContabOrganizada = fiscalConfig.taxIrsRegime === 'contabilidade_organizada';

  const checkItems = useMemo(() => {
    const items: { key: string; label: string }[] = [];

    const monthDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const isAfterIvaEnd = !fiscalConfig.ivaExemptionEndDate || monthDateStr >= fiscalConfig.ivaExemptionEndDate;
    const isAfterSsEnd = !fiscalConfig.ssExemptionEndDate || monthDateStr >= fiscalConfig.ssExemptionEndDate;

    if (!fiscalConfig.ssExempt && isAfterSsEnd) {
      const refMonth = month === 1 ? 12 : month - 1;
      const refYear = month === 1 ? year - 1 : year;
      items.push({ key: 'ss_payment', label: `SS Pagamento — ${MONTHS[refMonth - 1]} ${refYear} (até dia 20)` });
    }

    if (!fiscalConfig.ivaExempt && fiscalConfig.taxIvaRegime === 'trimestral' && isAfterIvaEnd) {
      const qMonths: Record<number, string> = { 2: `4º Trim ${year - 1}`, 5: `1º Trim ${year}`, 8: `2º Trim ${year}`, 11: `3º Trim ${year}` };
      if (qMonths[month]) {
        items.push({ key: `iva_decl_q_${month}`, label: `IVA Declaração — ${qMonths[month]} (até dia 20)` });
        items.push({ key: `iva_pay_q_${month}`, label: `IVA Pagamento — ${qMonths[month]} (até dia 25)` });
      }
    }

    if (!fiscalConfig.ivaExempt && fiscalConfig.taxIvaRegime === 'mensal' && isAfterIvaEnd) {
      const refMonth = month <= 2 ? 10 + month : month - 2;
      const refYear = month <= 2 ? year - 1 : year;
      items.push({ key: 'iva_decl_m', label: `IVA Declaração — ${MONTHS[refMonth - 1]} ${refYear} (até dia 20)` });
      items.push({ key: 'iva_pay_m', label: `IVA Pagamento — ${MONTHS[refMonth - 1]} ${refYear} (até dia 25)` });
    }

    items.push({ key: 'bank_statement', label: 'Extrato bancário carregado' });

    return items;
  }, [month, year, fiscalConfig]);

  const toDeadlineKey = (key: string): string | null => {
    if (key === 'ss_payment') {
      const refMonth = month === 1 ? 12 : month - 1;
      const refYear = month === 1 ? year - 1 : year;
      return `ss-${refYear}-${refMonth}`;
    }
    if (key.startsWith('iva_decl_q_') || key.startsWith('iva_pay_q_')) {
      const isPay = key.startsWith('iva_pay_q_');
      const map: Record<number, { q: number; y: number }> = {
        2: { q: 4, y: year - 1 },
        5: { q: 1, y: year },
        8: { q: 2, y: year },
        11: { q: 3, y: year },
      };
      const m = map[month];
      if (!m) return null;
      return `iva-${isPay ? 'pay' : 'decl'}-q${m.q}-${m.y}`;
    }
    if (key === 'iva_decl_m' || key === 'iva_pay_m') {
      const isPay = key === 'iva_pay_m';
      const refMonth = month <= 2 ? 10 + month : month - 2;
      const refYear = month <= 2 ? year - 1 : year;
      return `iva-${isPay ? 'pay' : 'decl'}-m${refMonth}-${refYear}`;
    }
    return null;
  };

  const { data: checks = [] } = useQuery({
    queryKey: ['fiscal-checks', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('fiscal_monthly_checks')
        .select('*')
        .eq('year', year)
        .eq('month', month);
      return data || [];
    },
  });

  const { data: deadlineCompletions = [] } = useQuery<DeadlineCompletionRow[]>({
    queryKey: ['fiscal-deadline-completions', year],
    queryFn: async () => {
      const { data } = await supabase
        // Table not yet in generated Supabase types — typing the response shape locally
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('fiscal_deadline_completions' as any)
        .select('*')
        .eq('year', year);
      return (data || []) as unknown as DeadlineCompletionRow[];
    },
  });
  const completedDeadlineKeys = useMemo(
    () => new Set(deadlineCompletions.map((c) => c.deadline_key)),
    [deadlineCompletions],
  );

  const checkedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    (checks as FiscalCheckRow[]).forEach((c) => { map[c.check_key] = c.checked; });
    checkItems.forEach(item => {
      const dk = toDeadlineKey(item.key);
      if (dk && completedDeadlineKeys.has(dk)) map[item.key] = true;
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks, checkItems, completedDeadlineKeys, month, year]);

  const toggleCheck = useMutation({
    mutationFn: async ({ key, checked }: { key: string; checked: boolean }) => {
      const deadlineKey = toDeadlineKey(key);
      if (deadlineKey) {
        const existing = deadlineCompletions.find((c) => c.deadline_key === deadlineKey);
        if (checked && !existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from as any)('fiscal_deadline_completions')
            .insert({ deadline_key: deadlineKey, year, completed_by: (await supabase.auth.getUser()).data.user?.id });
        } else if (!checked && existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from as any)('fiscal_deadline_completions').delete().eq('id', existing.id);
        }
        return;
      }
      const existing = (checks as FiscalCheckRow[]).find((c) => c.check_key === key);
      if (existing) {
        await supabase.from('fiscal_monthly_checks').update({ checked, checked_at: checked ? new Date().toISOString() : null }).eq('id', existing.id);
      } else {
        await supabase.from('fiscal_monthly_checks').insert({ year, month, check_key: key, checked, checked_at: checked ? new Date().toISOString() : null });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-checks', year, month] });
      qc.invalidateQueries({ queryKey: ['fiscal-deadline-completions', year] });
    },
  });

  if (checkItems.length === 0) return null;

  const doneCount = checkItems.filter(i => checkedMap[i.key]).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Obrigações Fiscais — {MONTHS[month - 1]}
          <Badge variant="secondary" className="ml-auto text-xs">{doneCount}/{checkItems.length}</Badge>
        </CardTitle>
        {isContabOrganizada && (
          <p className="text-xs text-muted-foreground">O teu contabilista trata destas obrigações — usa esta checklist como guia.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {checkItems.map(item => (
          <label key={item.key} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={checkedMap[item.key] || false}
              onCheckedChange={(v) => toggleCheck.mutate({ key: item.key, checked: !!v })}
            />
            <span className={cn('text-sm', checkedMap[item.key] && 'line-through text-muted-foreground')}>{item.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}