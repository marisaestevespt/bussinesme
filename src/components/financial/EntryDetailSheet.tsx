import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { InvoiceUpload, DocEntry } from './InvoiceUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ENTRY_STATUSES = [
  { value: 'aguarda_pagamento', label: 'Aguarda Pagamento', cls: 'bg-orange-100 text-orange-800' },
  { value: 'pagamento_em_atraso', label: 'Pagamento em Atraso', cls: 'bg-red-100 text-red-800' },
  { value: 'pago', label: 'Pago', cls: 'bg-green-100 text-green-800' },
  { value: 'fatura_recibo_enviado', label: 'Fatura-Recibo Enviado', cls: 'bg-blue-100 text-blue-800' },
  { value: 'tudo_ok', label: 'Tudo OK', cls: 'bg-emerald-100 text-emerald-800' },
] as const;

export function getEntryStatusBadge(status: string) {
  const found = ENTRY_STATUSES.find(s => s.value === status);
  return found || { value: status, label: status, cls: 'bg-muted text-muted-foreground' };
}

export { ENTRY_STATUSES };

type Sale = {
  id: string;
  sale_id: string;
  status: string;
  payment_date: string | null;
  description: string | null;
  base_value: number;
  invoice_total: number;
  product: string | null;
  client: string | null;
  source: string | null;
  sale_month: number | null;
  sale_quarter: number | null;
  sale_year: number | null;
  documents?: any;
};

interface Props {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function EntryDetailSheet({ sale, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(sale?.status || 'aguarda_pagamento');
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmNoDocsOpen, setConfirmNoDocsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  // Sync state when sale changes
  const [lastId, setLastId] = useState<string | null>(null);
  if (sale && sale.id !== lastId) {
    setLastId(sale.id);
    setStatus(sale.status || 'aguarda_pagamento');
    const rawDocs = sale.documents;
    setDocs(Array.isArray(rawDocs) ? rawDocs : []);
  }

  if (!sale) return null;

  const canBeOk = docs.length > 0;
  const statusBadge = getEntryStatusBadge(status);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('commercial_sales').update({
      status,
      documents: docs as any,
    }).eq('id', sale.id);
    if (error) {
      toast.error('Erro ao guardar');
    } else {
      toast.success('Entrada atualizada');
      qc.invalidateQueries({ queryKey: ['commercial'] });
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{sale.sale_id}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Status prominently on top — clickable dropdown */}
          <div className={`rounded-lg px-4 py-3 ${statusBadge.cls}`}>
            <p className="text-xs opacity-70 mb-1">Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 font-semibold text-base [&>svg]:ml-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_STATUSES.map(s => (
                  <SelectItem
                    key={s.value}
                    value={s.value}
                    disabled={s.value === 'tudo_ok' && !canBeOk}
                  >
                    <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>
                    {s.value === 'tudo_ok' && !canBeOk && <span className="text-xs text-muted-foreground ml-1">(anexar fatura)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description & Client */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Descrição</p>
              <p className="font-medium">{sale.description || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-medium">{sale.client || '—'}</p>
            </div>
          </div>

          {/* Other details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Produto</p>
              <p className="font-medium">{sale.product || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Origem</p>
              <p className="font-medium">{sale.source || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor Base</p>
              <p className="font-medium">{fmt(sale.base_value)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fatura Total</p>
              <p className="font-medium">{fmt(sale.invoice_total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Data Pagamento</p>
              <p className="font-medium">{sale.payment_date || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Período</p>
              <p className="font-medium">
                {sale.sale_month ? `Mês ${sale.sale_month}` : '—'} / T{sale.sale_quarter || '—'} / {sale.sale_year || '—'}
              </p>
            </div>
          </div>

          {/* Documents */}
          <InvoiceUpload
            documents={docs}
            onChange={setDocs}
            label="Ficheiros (faturas, comprovativos, recibos)"
          />

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'A guardar...' : 'Guardar alterações'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
