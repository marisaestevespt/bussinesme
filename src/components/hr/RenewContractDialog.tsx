import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTRACT_TYPES, labelFor } from '@/hooks/useTeamData';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  previousContract: any;
  memberName: string;
  onRenew: (newContract: any) => Promise<void> | void;
}

function nextDay(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function RenewContractDialog({ open, onClose, previousContract, memberName, onRenew }: Props) {
  const defaultStart = nextDay(previousContract?.end_date);
  const [form, setForm] = useState({
    contract_type: previousContract?.contract_type || 'contrato_trabalho',
    start_date: defaultStart,
    end_date: '',
    monthly_value: previousContract?.monthly_value || '',
    document_url: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.start_date) {
      toast.error('Indica a data de início da renovação');
      return;
    }
    setSaving(true);
    try {
      await onRenew({
        member_id: previousContract.member_id,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        monthly_value: form.monthly_value ? Number(form.monthly_value) : null,
        document_url: form.document_url || null,
        notes: form.notes || null,
        status: 'ativo',
        previous_contract_id: previousContract.id,
      });
      toast.success('Contrato renovado');
      onClose();
    } catch (e: any) {
      toast.error('Erro ao renovar contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renovar contrato — {memberName}</DialogTitle>
          <DialogDescription className="text-xs">
            O contrato anterior fica intacto no histórico. O novo contrato é criado como ativo e ligado ao anterior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Contrato anterior: </span>{labelFor(CONTRACT_TYPES, previousContract?.contract_type)}</div>
            <div><span className="text-muted-foreground">Período: </span>{previousContract?.start_date || '—'} → {previousContract?.end_date || '—'}</div>
            {previousContract?.monthly_value && <div><span className="text-muted-foreground">Valor: </span>€{Number(previousContract.monthly_value).toLocaleString()}/mês</div>}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Tipo de contrato</label>
            <Select value={form.contract_type} onValueChange={v => set('contract_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTRACT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Data de início</label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data de fim</label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Valor mensal (€)</label>
            <Input type="number" value={form.monthly_value} onChange={e => set('monthly_value', e.target.value)} placeholder="Mantém em branco para não gerar pagamentos" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Documento (URL)</label>
            <Input value={form.document_url} onChange={e => set('document_url', e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Notas (motivo da renovação, alterações)</label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-muted-foreground">
            ⚠️ O contrato anterior <strong>não</strong> é alterado automaticamente. Se quiseres marcá-lo como terminado, edita-o depois manualmente.
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>{saving ? 'A guardar…' : 'Renovar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}