import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { resolveProductId } from '@/lib/productResolver';
import { confirmNoClientDuplicates } from '@/lib/clientDuplicateCheck';
import { isConfirmCancelled } from '@/lib/confirmDestructive';

interface AddLegacyClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY = {
  full_name: '',
  whatsapp: '',
  email: '',
  fiscal_address: '',
  legacy_product_description: '',
};

export function AddLegacyClientDialog({ open, onOpenChange }: AddLegacyClientDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const ok = await confirmNoClientDuplicates({ email: form.email });
      if (!ok) { setSaving(false); return; }
      const productId = form.legacy_product_description.trim()
        ? await resolveProductId(form.legacy_product_description.trim())
        : null;

      const { error } = await supabase.from('clients').insert({
        full_name: form.full_name.trim(),
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        fiscal_address: form.fiscal_address.trim() || null,
        legacy_product_description: form.legacy_product_description.trim() || null,
        current_product_id: productId,
        is_legacy: true,
        status: 'terminado',
      } as any);
      if (error) throw error;
      toast.success('Cliente histórico adicionado');
      qc.invalidateQueries({ queryKey: ['clients'] });
      onOpenChange(false);
    } catch (e: any) {
      if (isConfirmCancelled(e)) { setSaving(false); return; }
      toast.error(e.message || 'Não foi possível guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-4 w-4" /> Adicionar cliente histórico
          </DialogTitle>
          <DialogDescription>
            Regista um cliente que já passou pelo negócio. Não cria projeto, venda nem portal — fica apenas como registo de arquivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lc-name">Nome *</Label>
            <Input id="lc-name" value={form.full_name} onChange={e => set('full_name', e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-phone">Telemóvel</Label>
              <Input id="lc-phone" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-email">Email</Label>
              <Input id="lc-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-address">Morada fiscal</Label>
            <Textarea id="lc-address" rows={2} value={form.fiscal_address} onChange={e => set('fiscal_address', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-product">Produto/serviço</Label>
            <Input
              id="lc-product"
              placeholder="Nome do produto ou serviço que comprou"
              value={form.legacy_product_description}
              onChange={e => set('legacy_product_description', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Se o nome corresponder a um produto atual, é ligado automaticamente.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}