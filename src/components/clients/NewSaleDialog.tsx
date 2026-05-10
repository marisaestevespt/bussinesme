import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { QuoteCalculatorDialog } from '@/components/product/QuoteCalculatorDialog';
import { ShoppingCart } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  onAccepted: (args: { id: string; total: number; productId: string }) => void;
}

export function NewSaleDialog({ open, onOpenChange, clientId, onAccepted }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('products')
      .select('id, name, ticket_type, sales_type, status')
      .neq('status', 'arquivado')
      .neq('status', 'off')
      .order('name')
      .then(({ data }) => setProducts(data || []));
  }, [open]);

  const handlePick = (id: string) => {
    setProductId(id);
    setCalcOpen(true);
  };

  const handleAccepted = (args: { id: string; total: number }) => {
    if (!productId) return;
    onAccepted({ ...args, productId });
    setCalcOpen(false);
    onOpenChange(false);
    setProductId(null);
  };

  return (
    <>
      <Dialog open={open && !calcOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Nova venda
            </DialogTitle>
            <DialogDescription>Escolhe o produto que estás a vender.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y -mx-6">
            {products.length === 0 && (
              <div className="px-6 py-8 text-sm text-muted-foreground text-center">Sem produtos disponíveis.</div>
            )}
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p.id)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-muted/50 hq-transition text-left"
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.sales_type?.replace(/_/g, ' ')}</div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {p.ticket_type === 'variavel' ? 'Variável' : 'Fixo'}
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {productId && (
        <QuoteCalculatorDialog
          open={calcOpen}
          onOpenChange={(v) => { setCalcOpen(v); if (!v) setProductId(null); }}
          productId={productId}
          clientId={clientId}
          onAccepted={handleAccepted}
        />
      )}
    </>
  );
}