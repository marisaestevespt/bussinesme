import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CreditCard, ChevronRight, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import type { PortalPayment } from '@/types/portal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  payments: PortalPayment[];
  selectedPayment: PortalPayment | null;
  setSelectedPayment: (p: PortalPayment | null) => void;
  pc: string;
  statusLabel: (s: string) => { text: string; cls: string };
  portalToken?: string;
}

export function PortalPaymentsSection({ payments, selectedPayment, setSelectedPayment, pc, statusLabel, portalToken }: Props) {
  const handleDownload = async (saleId: string, fileUrl: string, name: string) => {
    if (!portalToken) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('portal-payment-file', {
        body: { token: portalToken, sale_id: saleId, file_url: fileUrl },
      });
      if (error || !data?.url) {
        toast.error('Não foi possível abrir o documento');
        return;
      }
      window.open(data.url as string, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Não foi possível abrir o documento');
    }
    void name;
  };
  return (
    <>
      <div className="space-y-5">
        <SectionTitle icon={CreditCard}>Pagamentos</SectionTitle>
        {payments.length === 0 ? (
          <SectionCard className="p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <EmptyHint>Sem pagamentos registados.</EmptyHint>
          </SectionCard>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const st = statusLabel(p.status || '');
              return (
                <SectionCard key={p.id} className="p-5 cursor-pointer" onClick={() => setSelectedPayment(p)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${st.cls}`}>{st.text}</Badge>
                      <div>
                        <p className="text-sm font-medium">
                          {p.sale_month ? MONTH_NAMES[p.sale_month - 1] : '—'}
                          {p.payment_date && <span className="text-muted-foreground font-normal"> · {format(parseISO(p.payment_date), "d MMM yyyy", { locale: pt })}</span>}
                        </p>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: pc }}>
                        {typeof p.invoice_total === 'number' ? `${p.invoice_total.toFixed(2)} €` : '—'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Detalhe do Pagamento</DialogTitle></DialogHeader>
          {selectedPayment && ((): JSX.Element => {
            const p = selectedPayment;
            const st = statusLabel(p.status || '');
            const docs = Array.isArray(p.documents) ? p.documents : [];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`${st.cls}`}>{st.text}</Badge>
                  <span className="text-lg font-bold" style={{ color: pc }}>
                    {typeof p.invoice_total === 'number' ? `${p.invoice_total.toFixed(2)} €` : '—'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/20"><span className="text-muted-foreground">Mês</span><span className="font-medium">{p.sale_month ? MONTH_NAMES[p.sale_month - 1] : '—'}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-border/20"><span className="text-muted-foreground">Data de pagamento</span><span className="font-medium">{p.payment_date ? format(parseISO(p.payment_date), "d 'de' MMMM yyyy", { locale: pt }) : '—'}</span></div>
                  {p.description && (<div className="flex justify-between py-1.5 border-b border-border/20"><span className="text-muted-foreground">Descrição</span><span className="font-medium text-right max-w-[200px]">{p.description}</span></div>)}
                  {p.payment_method && (<div className="flex justify-between py-1.5 border-b border-border/20"><span className="text-muted-foreground">Método</span><span className="font-medium uppercase">{p.payment_method}</span></div>)}
                </div>
                {docs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Documentos</p>
                    {docs.map((d, i) => {
                      const url = (d as { url?: string }).url || (typeof d === 'string' ? d : '');
                      const name = (d as { name?: string; file_name?: string }).name || (d as { file_name?: string }).file_name || `Documento ${i + 1}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleDownload(p.id, url, name)}
                          className="flex items-center gap-2 text-sm hover:underline py-1 text-left"
                          style={{ color: pc }}
                        >
                          <Download className="h-3.5 w-3.5" />{name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}