import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  value: string | null;
  onValueChange: (v: string | null) => void;
}

export function SupplierSelect({ value, onValueChange }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [nif, setNif] = useState('');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, nif')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ name: name.trim(), nif: nif || null })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        qc.invalidateQueries({ queryKey: ['suppliers-list'] });
        onValueChange(data.id);
        toast.success('Fornecedor criado');
        setOpen(false);
        setName('');
        setNif('');
      }
    },
    onError: () => toast.error('Erro ao criar fornecedor'),
  });

  return (
    <div className="flex gap-2">
      <Select value={value || '__none__'} onValueChange={v => onValueChange(v === '__none__' ? null : v)}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Sem fornecedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem fornecedor</SelectItem>
          {suppliers.map((s: any) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}{s.nif ? ` (${s.nif})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do fornecedor" /></div>
            <div><Label>NIF</Label><Input value={nif} onChange={e => setNif(e.target.value)} placeholder="Opcional" /></div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={!name.trim()}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
