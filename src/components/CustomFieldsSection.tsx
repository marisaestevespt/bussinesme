import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  entityType: string; // 'client', 'project', 'lead', 'product', 'member'
  entityId: string;
  showConfig?: boolean; // Show field management (admin only)
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'url', label: 'Link (URL)' },
  { value: 'select', label: 'Lista de opções' },
];

export function CustomFieldsSection({ entityType, entityId, showConfig = false }: Props) {
  const qc = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Fetch field definitions
  const { data: fields = [] } = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: async () => {
      const { data } = await (supabase.from('custom_fields' as any) as any)
        .select('*')
        .eq('entity_type', entityType)
        .order('sort_order');
      return data || [];
    },
  });

  // Fetch values for this entity
  const { data: values = [] } = useQuery({
    queryKey: ['custom-field-values', entityType, entityId],
    enabled: !!entityId && fields.length > 0,
    queryFn: async () => {
      const fieldIds = fields.map((f: any) => f.id);
      if (!fieldIds.length) return [];
      const { data } = await (supabase.from('custom_field_values' as any) as any)
        .select('*')
        .eq('entity_id', entityId)
        .in('field_id', fieldIds);
      return data || [];
    },
  });

  const upsertValue = useMutation({
    mutationFn: async ({ fieldId, value }: { fieldId: string; value: string }) => {
      const existing = values.find((v: any) => v.field_id === fieldId);
      if (existing) {
        await (supabase.from('custom_field_values' as any) as any).update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await (supabase.from('custom_field_values' as any) as any).insert({ field_id: fieldId, entity_id: entityId, value });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-field-values', entityType, entityId] }),
  });

  const addField = useMutation({
    mutationFn: async () => {
      if (!newFieldName.trim()) { toast.error('Nome obrigatório'); throw new Error(''); }
      const payload: any = {
        entity_type: entityType,
        field_name: newFieldName.trim(),
        field_type: newFieldType,
        sort_order: fields.length,
      };
      if (newFieldType === 'select' && newFieldOptions.trim()) {
        payload.field_options = newFieldOptions.split(',').map((o: string) => o.trim()).filter(Boolean);
      }
      const { error } = await (supabase.from('custom_fields' as any) as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', entityType] });
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions('');
      toast.success('Campo criado');
    },
    onError: (e: any) => { if (e.message) toast.error(e.message); },
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      await (supabase.from('custom_fields' as any) as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', entityType] });
      toast.success('Campo removido');
    },
  });

  const getFieldValue = (fieldId: string) => {
    const v = values.find((val: any) => val.field_id === fieldId);
    return v?.value || '';
  };

  if (fields.length === 0 && !showConfig) return null;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Campos Personalizados</CardTitle>
        {showConfig && (
          <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field: any) => (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.field_name}</Label>
            {field.field_type === 'boolean' ? (
              <Switch
                checked={getFieldValue(field.id) === 'true'}
                onCheckedChange={v => upsertValue.mutate({ fieldId: field.id, value: String(v) })}
              />
            ) : field.field_type === 'select' && field.field_options ? (
              <Select
                value={getFieldValue(field.id)}
                onValueChange={v => upsertValue.mutate({ fieldId: field.id, value: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(field.field_options as string[]).map((opt: string) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                defaultValue={getFieldValue(field.id)}
                onBlur={e => {
                  const val = e.target.value;
                  if (val !== getFieldValue(field.id)) {
                    upsertValue.mutate({ fieldId: field.id, value: val });
                  }
                }}
                placeholder={field.field_type === 'url' ? 'https://...' : ''}
              />
            )}
          </div>
        ))}

        {fields.length === 0 && showConfig && (
          <p className="text-sm text-muted-foreground">Ainda sem campos personalizados. Clica no ⚙️ para configurar.</p>
        )}
      </CardContent>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerir Campos Personalizados</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {fields.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                <div>
                  <p className="text-sm font-medium">{f.field_name}</p>
                  <p className="text-xs text-muted-foreground">{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</p>
                </div>
                <Button variant="ghost" aria-label="Eliminar" size="icon" onClick={() => deleteField.mutate(f.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Nome do campo</Label>
                <Input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Ex: NIF, Sector..." />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newFieldType} onValueChange={setNewFieldType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {newFieldType === 'select' && (
                <div>
                  <Label className="text-xs">Opções (separadas por vírgula)</Label>
                  <Input value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="Opção A, Opção B" />
                </div>
              )}
            </div>
            <Button className="w-full gap-1" onClick={() => addField.mutate()}>
              <Plus className="h-3.5 w-3.5" /> Adicionar Campo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
