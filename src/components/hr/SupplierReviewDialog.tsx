import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SupplierDraft } from '@/hooks/useMemberSave';

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferência' },
  { value: 'mbway', label: 'MB WAY' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'numerario', label: 'Numerário' },
  { value: 'debito_direto', label: 'Débito Direto' },
  { value: 'outro', label: 'Outro' },
];

const CATEGORIES = [
  { value: 'freelancer', label: 'Freelancer / Prestador' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  open: boolean;
  initial: SupplierDraft;
  memberName: string;
  onCancel: () => void;
  onConfirm: (draft: SupplierDraft) => Promise<void> | void;
}

/**
 * Dialog que abre logo após gravar um membro como prestador de serviços.
 * Mostra a "ficha de fornecedor" pré-preenchida a partir dos campos do
 * membro para o owner confirmar/completar antes de gerar despesas com IVA.
 */
export function SupplierReviewDialog({ open, initial, memberName, onCancel, onConfirm }: Props) {
  const [draft, setDraft] = useState<SupplierDraft>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(initial); }, [initial]);

  const set = <K extends keyof SupplierDraft>(k: K, v: SupplierDraft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha de Fornecedor — {memberName}</DialogTitle>
          <DialogDescription>
            Confirma ou completa os dados fiscais. Ao guardar, o fornecedor é criado e os pagamentos
            futuros passam a ser registados como despesa com IVA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome / Razão social *</label>
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">NIF</label>
              <Input value={draft.nif} onChange={(e) => set('nif', e.target.value)} placeholder="9 dígitos" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">IVA (%)</label>
              <Input
                type="number"
                value={String(draft.default_vat_rate)}
                onChange={(e) => set('default_vat_rate', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={draft.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telefone</label>
              <Input value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">IBAN</label>
            <Input value={draft.iban} onChange={(e) => set('iban', e.target.value)} placeholder="PT50 ..." />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Morada fiscal</label>
            <Textarea rows={2} value={draft.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Método de pagamento</label>
              <Select value={draft.payment_method || ''} onValueChange={(v) => set('payment_method', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={draft.category || 'freelancer'} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Serviço prestado</label>
            <Input
              value={draft.service}
              onChange={(e) => set('service', e.target.value)}
              placeholder="Ex: Contabilidade, Design, Consultoria…"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Mais tarde</Button>
            <Button onClick={handleConfirm} disabled={saving || !draft.name.trim()}>
              {saving ? 'A criar…' : 'Criar fornecedor e gerar despesas'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}