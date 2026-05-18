import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';
import { Plus, Pencil, Trash2, GripVertical, MessageSquare, Heart, X } from 'lucide-react';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  productId: string;
  productName: string;
  isOwner: boolean;
}

type Kind = 'nps' | 'feedback';
interface Question { id?: string; text: string; required?: boolean }
interface RecolhaConfig {
  id?: string;
  product_id: string;
  kind: Kind;
  title: string;
  cadence_days: number;
  collection_message: string | null;
  responsible_id: string | null;
  nps_form_url: string | null;
  questions: Question[] | null;
  sort_order: number;
}

const emptyConfig = (productId: string, sortOrder: number): RecolhaConfig => ({
  product_id: productId,
  kind: 'nps',
  title: '',
  cadence_days: 90,
  collection_message: '',
  responsible_id: null,
  nps_form_url: '',
  questions: [],
  sort_order: sortOrder,
});

export function ProductCustomerSuccess({ productId, productName, isOwner }: Props) {
  const qc = useQueryClient();
  const { members } = useTeamData({ members: true });
  const teamMembers = members.data || [];

  const { data: configs = [] } = useQuery({
    queryKey: ['product-recolhas', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_nps_config' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      return ((data || []) as any[]).map((row): RecolhaConfig => ({
        id: row.id,
        product_id: row.product_id,
        kind: (row.kind || 'nps') as Kind,
        title: row.title || (row.kind === 'feedback' ? 'Feedback' : 'NPS'),
        cadence_days: row.cadence_days ?? 90,
        collection_message: row.collection_message,
        responsible_id: row.responsible_id,
        nps_form_url: row.nps_form_url,
        questions: Array.isArray(row.questions) ? (row.questions as Question[]) : [],
        sort_order: row.sort_order ?? 0,
      }));
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecolhaConfig>(emptyConfig(productId, 0));

  const openNew = () => {
    setForm(emptyConfig(productId, configs.length));
    setDialogOpen(true);
  };
  const openEdit = (c: RecolhaConfig) => {
    setForm({ ...c, questions: c.questions || [] });
    setDialogOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        product_id: productId,
        kind: form.kind,
        title: form.title || (form.kind === 'feedback' ? 'Feedback' : 'NPS'),
        cadence_days: Number(form.cadence_days) || 90,
        collection_message: form.collection_message || null,
        responsible_id: form.responsible_id || null,
        nps_form_url: form.nps_form_url || null,
        questions: form.kind === 'feedback' ? (form.questions || []) : null,
        sort_order: form.sort_order ?? 0,
      };
      if (form.id) {
        const { error } = await supabase.from('product_nps_config' as any).update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_nps_config' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-recolhas', productId] });
      setDialogOpen(false);
      toast.success('Recolha guardada');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('product_nps_config' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-recolhas', productId] });
      toast.success('Recolha eliminada');
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Recolhas de Feedback</CardTitle>
              <CardDescription>
                Define as recolhas que serão pedidas ao cliente ao longo do ciclo do produto. Podem ser uma nota NPS simples ou um feedback estruturado com perguntas + nota final.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNew} disabled={!isOwner}>
              <Plus className="h-4 w-4 mr-1.5" />Nova recolha
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Sem recolhas configuradas. Adiciona uma para que apareça automaticamente no portal do cliente.
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 border rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {c.kind === 'feedback'
                      ? <MessageSquare className="h-4 w-4 text-primary" />
                      : <Heart className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{c.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {c.kind === 'feedback' ? 'Feedback + NPS' : 'NPS'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A cada {c.cadence_days} dias
                      {c.kind === 'feedback' && c.questions && c.questions.length > 0 && (
                        <> · {c.questions.length} pergunta{c.questions.length === 1 ? '' : 's'}</>
                      )}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} disabled={!isOwner}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={!isOwner}
                    onClick={() => { if (confirm('Eliminar esta recolha?')) c.id && remove.mutate(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar recolha' : 'Nova recolha'}</DialogTitle>
            <DialogDescription>
              Configura como e quando esta recolha é pedida ao cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nps">NPS · só nota 0–10</SelectItem>
                    <SelectItem value="feedback">Feedback · perguntas + NPS final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cadência (dias após início)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.cadence_days}
                  onChange={(e) => setForm({ ...form, cadence_days: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder={form.kind === 'feedback' ? 'Ex: Feedback final' : 'Ex: NPS 30 dias'}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">É este nome que o cliente vê no portal.</p>
            </div>

            {form.kind === 'feedback' && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Perguntas</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({
                      ...form,
                      questions: [...(form.questions || []), { text: '', required: false }],
                    })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
                {(form.questions?.length || 0) === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Sem perguntas. O cliente verá apenas a escala NPS final.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(form.questions || []).map((q, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <Textarea
                            rows={2}
                            placeholder={`Pergunta ${i + 1}`}
                            value={q.text}
                            onChange={(e) => {
                              const next = [...(form.questions || [])];
                              next[i] = { ...next[i], text: e.target.value };
                              setForm({ ...form, questions: next });
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`req-${i}`}
                              checked={!!q.required}
                              onCheckedChange={(v) => {
                                const next = [...(form.questions || [])];
                                next[i] = { ...next[i], required: v };
                                setForm({ ...form, questions: next });
                              }}
                            />
                            <Label htmlFor={`req-${i}`} className="text-xs cursor-pointer">Obrigatória</Label>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            const next = (form.questions || []).filter((_, idx) => idx !== i);
                            setForm({ ...form, questions: next });
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Responsável de Customer Success</Label>
              <Select
                value={form.responsible_id || 'none'}
                onValueChange={(v) => setForm({ ...form, responsible_id: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem responsável —</SelectItem>
                  {teamMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mensagem (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Texto interno ou para enviar ao cliente quando se pede esta recolha..."
                value={form.collection_message || ''}
                onChange={(e) => setForm({ ...form, collection_message: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}