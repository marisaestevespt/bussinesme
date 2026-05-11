import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { InvoiceUpload, DocEntry } from './InvoiceUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useCommercialData } from '@/hooks/useCommercialData';
import { FileText, Copy, Trash2 } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import {
  SALE_STATUSES as CANONICAL_SALE_STATUSES,
  getSaleStatusInfo,
  getEffectiveSaleStatus,
} from '@/lib/saleStatus';

const ENTRY_STATUSES = CANONICAL_SALE_STATUSES;

export function getEntryStatusBadge(status: string) {
  return getSaleStatusInfo(status);
}

/** Returns the effective status, auto-upgrading to 'em_atraso' when overdue */
export function getEffectiveEntryStatus(status: string, paymentDate: string | null): string {
  return getEffectiveSaleStatus(status, paymentDate);
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
export function EntryDetailSheet({ sale, open, onOpenChange }: Props) {
  const { upsertSale, deleteSale } = useCommercialData();

  // Fetch client fiscal data for invoice emission
  const { data: clientData } = useQuery({
    queryKey: ['client-fiscal', sale?.client],
    queryFn: async () => {
      if (!sale?.client) return null;
      const { data } = await supabase
        .from('clients')
        .select('full_name, nif, fiscal_address, email, client_id')
        .eq('full_name', sale.client)
        .maybeSingle();
      return data;
    },
    enabled: !!sale?.client,
  });

  const [status, setStatus] = useState(sale?.status || 'aguarda_pagamento');
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [description, setDescription] = useState<string>(sale?.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmNoDocsOpen, setConfirmNoDocsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  // Sync state when sale changes
  const [lastId, setLastId] = useState<string | null>(null);
  if (sale && sale.id !== lastId) {
    setLastId(sale.id);
    setStatus(sale.status || 'aguarda_pagamento');
    setDescription(sale.description || '');
    const rawDocs = sale.documents;
    setDocs(Array.isArray(rawDocs) ? rawDocs : []);
  }

  if (!sale) return null;

  const canBeOk = docs.length > 0;
  const effectiveStatus = getEffectiveEntryStatus(status, sale?.payment_date ?? null);
  const statusBadge = getEntryStatusBadge(effectiveStatus);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSale.mutateAsync({ id: sale.id, status, description, documents: docs as any });
      toast.success('Entrada atualizada');
    } catch {
      toast.error('Não consegui guardar a entrada. Tenta novamente.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteSale.mutateAsync(sale.id);
      toast.success('Entrada eliminada');
      onOpenChange(false);
    } catch {
      toast.error('Não consegui eliminar a entrada. Tenta novamente.');
    }
  };

  return (
    <>
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
            <Select value={status} onValueChange={(val) => {
              if (val === 'tudo_ok' && !canBeOk) {
                setPendingStatus(val);
                setConfirmNoDocsOpen(true);
              } else {
                setStatus(val);
              }
            }}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 font-semibold text-base [&>svg]:ml-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description & Client */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-normal">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sem descrição"
                rows={2}
                className="text-sm"
              />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-medium">{sale.client || '—'}</p>
            </div>
          </div>

          {/* Client fiscal data for invoicing */}
          {clientData && (clientData.nif || clientData.fiscal_address) && (
            <>
              <Separator />
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 eyebrowr">
                  <FileText className="h-3.5 w-3.5" />
                  Dados para faturação
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs">Nome completo</p>
                      <p className="font-medium">{clientData.full_name || sale.client}</p>
                    </div>
                    <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(clientData.full_name || sale.client || ''); toast.success('Copiado'); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {clientData.nif && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">NIF</p>
                        <p className="font-medium font-mono">{clientData.nif}</p>
                      </div>
                      <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(clientData.nif); toast.success('NIF copiado'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {clientData.fiscal_address && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-xs">Morada fiscal</p>
                        <p className="font-medium">{clientData.fiscal_address}</p>
                      </div>
                      <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(clientData.fiscal_address); toast.success('Morada copiada'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
              <p className="font-medium">{formatEuro(sale.base_value)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fatura Total</p>
              <p className="font-medium">{formatEuro(sale.invoice_total)}</p>
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
            suggestedName={
              sale.sale_month && sale.sale_year && clientData?.client_id
                ? `${String(sale.sale_month).padStart(2, '0')}${sale.sale_year}_${clientData.client_id}`
                : undefined
            }
          />

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : 'Guardar alterações'}
            </Button>
            <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={confirmNoDocsOpen} onOpenChange={setConfirmNoDocsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nenhuma fatura anexada</AlertDialogTitle>
          <AlertDialogDescription>
            Nenhuma fatura está anexada a esta transação. De certeza que pretende finalizar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            if (pendingStatus) setStatus(pendingStatus);
            setPendingStatus(null);
            setConfirmNoDocsOpen(false);
          }}>
            Sim, finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar entrada</AlertDialogTitle>
          <AlertDialogDescription>
            Tens a certeza que queres eliminar esta entrada ({sale.sale_id})? Esta ação não pode ser revertida.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
