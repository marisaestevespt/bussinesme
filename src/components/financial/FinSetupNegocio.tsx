import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface SetupData {
  id?: string;
  business_legal_name: string;
  nif: string;
  cae_principal: string;
  cae_secundarios: string;
  regime_iva: string;
  regime_fiscal: string;
  morada_fiscal: string;
  capital_social: string;
  iban: string;
  banco: string;
  contabilista: string;
  contabilista_contacto: string;
  notas: string;
}

const EMPTY: SetupData = {
  business_legal_name: '',
  nif: '',
  cae_principal: '',
  cae_secundarios: '',
  regime_iva: '',
  regime_fiscal: '',
  morada_fiscal: '',
  capital_social: '',
  iban: '',
  banco: '',
  contabilista: '',
  contabilista_contacto: '',
  notas: '',
};

const REGIME_IVA_OPTIONS = [
  'Regime Normal',
  'Regime de Isenção (Art. 53)',
  'Regime Trimestral',
  'Regime Mensal',
];

const REGIME_FISCAL_OPTIONS = [
  'Regime Simplificado',
  'Contabilidade Organizada',
  'Regime de Transparência Fiscal',
];

export function FinSetupNegocio() {
  const qc = useQueryClient();

  const { data: setup, isLoading } = useQuery({
    queryKey: ['business-setup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_setup' as any)
        .select('*')
        .maybeSingle();
      return (data as any as SetupData) || null;
    },
  });

  const [form, setForm] = useState<SetupData | null>(null);
  const current = form ?? setup ?? EMPTY;

  if (setup && !form) {
    setTimeout(() => setForm(setup), 0);
  }

  const update = (key: keyof SetupData, value: string) => {
    setForm(prev => ({ ...(prev ?? setup ?? EMPTY), [key]: value }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...current };
      delete (payload as any).id;
      if (setup?.id) {
        const { error } = await supabase.from('business_setup' as any).update(payload).eq('id', setup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('business_setup' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-setup'] });
      toast.success('Setup guardado');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  return (
    <div className="space-y-6">
      {/* Dados da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome Legal / Firma</Label>
            <Input value={current.business_legal_name} onChange={e => update('business_legal_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">NIF</Label>
            <Input value={current.nif} onChange={e => update('nif', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CAE Principal</Label>
            <Input value={current.cae_principal} onChange={e => update('cae_principal', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CAEs Secundários</Label>
            <Input value={current.cae_secundarios} onChange={e => update('cae_secundarios', e.target.value)} placeholder="Separados por vírgula" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Capital Social</Label>
            <Input value={current.capital_social} onChange={e => update('capital_social', e.target.value)} placeholder="€" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Morada Fiscal</Label>
            <Input value={current.morada_fiscal} onChange={e => update('morada_fiscal', e.target.value)} />
          </div>
        </CardContent>
      </Card>


      {/* Dados Bancários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Bancários</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">IBAN</Label>
            <Input value={current.iban} onChange={e => update('iban', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Banco</Label>
            <Input value={current.banco} onChange={e => update('banco', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Contabilista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contabilista</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={current.contabilista} onChange={e => update('contabilista', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contacto</Label>
            <Input value={current.contabilista_contacto} onChange={e => update('contabilista_contacto', e.target.value)} placeholder="Email ou telefone" />
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={current.notas} onChange={e => update('notas', e.target.value)} rows={4} placeholder="Observações gerais sobre o setup do negócio..." />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {save.isPending ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
