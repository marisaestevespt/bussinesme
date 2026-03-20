import { useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, GripVertical, Pencil, Check, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FIXED_COLUMNS = [
  { key: 'proposta_valor', label: 'Proposta de Valor' },
  { key: 'segmento_mercado', label: 'Segmento de Mercado' },
  { key: 'recursos_chave', label: 'Recursos Chave' },
  { key: 'fonte_receita', label: 'Fonte de Receita' },
  { key: 'canais_divulgacao', label: 'Canais & Divulgação' },
  { key: 'estrutura_custos', label: 'Estrutura de Custos' },
  { key: 'concorrencia', label: 'Concorrência' },
];

export default function ExecutiveBusinessPlan() {
  const qc = useQueryClient();
  const [editingVP, setEditingVP] = useState(false);
  const [vpDraft, setVpDraft] = useState('');
  const [newColLabel, setNewColLabel] = useState('');
  const [addingCol, setAddingCol] = useState(false);

  // Queries
  const settings = useQuery({
    queryKey: ['bp', 'settings'],
    queryFn: async () => {
      const { data } = await supabase.from('business_plan_settings').select('*').limit(1).maybeSingle();
      return data;
    },
  });

  const cards = useQuery({
    queryKey: ['bp', 'cards'],
    queryFn: async () => {
      const { data } = await supabase.from('business_plan_cards').select('*').order('sort_order');
      return data || [];
    },
  });

  const customCols = useQuery({
    queryKey: ['bp', 'custom_columns'],
    queryFn: async () => {
      const { data } = await supabase.from('business_plan_custom_columns').select('*').order('sort_order');
      return data || [];
    },
  });

  const allColumns = [
    ...FIXED_COLUMNS,
    ...(customCols.data || []).map((c: any) => ({ key: c.column_key, label: c.label, custom: true, id: c.id })),
  ];

  // Mutations
  const saveVP = useMutation({
    mutationFn: async (text: string) => {
      if (settings.data?.id) {
        await supabase.from('business_plan_settings').update({ value_proposition: text, updated_at: new Date().toISOString() }).eq('id', settings.data.id);
      } else {
        await supabase.from('business_plan_settings').insert({ value_proposition: text });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bp', 'settings'] }); setEditingVP(false); toast.success('Guardado'); },
  });

  const addCard = useMutation({
    mutationFn: async (column_key: string) => {
      const colCards = (cards.data || []).filter((c: any) => c.column_key === column_key);
      await supabase.from('business_plan_cards').insert({ column_key, content: '', sort_order: colCards.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards'] }),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await supabase.from('business_plan_cards').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards'] }),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('business_plan_cards').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards'] }),
  });

  const addColumn = useMutation({
    mutationFn: async (label: string) => {
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      await supabase.from('business_plan_custom_columns').insert({ column_key: `custom_${Date.now()}`, label, sort_order: 100 + (customCols.data?.length || 0) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bp', 'custom_columns'] }); setNewColLabel(''); setAddingCol(false); toast.success('Coluna adicionada'); },
  });

  const deleteColumn = useMutation({
    mutationFn: async ({ id, key }: { id: string; key: string }) => {
      await supabase.from('business_plan_cards').delete().eq('column_key', key);
      await supabase.from('business_plan_custom_columns').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bp'] }); toast.success('Coluna removida'); },
  });

  const vp = settings.data?.value_proposition || '';

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Plano & Modelo de Negócio" subtitle="Visão estratégica do modelo de negócio" />

        {/* Value Proposition Callout */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            {editingVP ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proposta de Valor</label>
                <Textarea value={vpDraft} onChange={e => setVpDraft(e.target.value)} placeholder="Descreve a proposta de valor do teu negócio..." className="min-h-[80px]" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveVP.mutate(vpDraft)}><Check className="h-3 w-3 mr-1" /> Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingVP(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => { setVpDraft(vp); setEditingVP(true); }}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Proposta de Valor</p>
                  {vp ? <p className="text-sm">{vp}</p> : <p className="text-sm text-muted-foreground italic">Clica para definir a proposta de valor...</p>}
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Board | Business Plan</h2>
          {addingCol ? (
            <div className="flex gap-2 items-center">
              <Input value={newColLabel} onChange={e => setNewColLabel(e.target.value)} placeholder="Nome da coluna" className="h-8 w-48 text-sm" onKeyDown={e => e.key === 'Enter' && newColLabel.trim() && addColumn.mutate(newColLabel.trim())} />
              <Button size="sm" onClick={() => newColLabel.trim() && addColumn.mutate(newColLabel.trim())}><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingCol(false)}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingCol(true)}><Plus className="h-3 w-3 mr-1" /> Nova Coluna</Button>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {allColumns.map(col => {
            const colCards = (cards.data || []).filter((c: any) => c.column_key === col.key);
            return (
              <div key={col.key} className="min-w-[260px] w-[260px] shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{colCards.length}</span>
                    {'custom' in col && (
                      <button onClick={() => deleteColumn.mutate({ id: (col as any).id, key: col.key })} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {colCards.map((card: any) => (
                    <KanbanCard key={card.id} card={card} onUpdate={(content) => updateCard.mutate({ id: card.id, content })} onDelete={() => deleteCard.mutate(card.id)} />
                  ))}
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground text-xs" onClick={() => addCard.mutate(col.key)}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar card
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function KanbanCard({ card, onUpdate, onDelete }: { card: any; onUpdate: (c: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(!card.content);
  const [draft, setDraft] = useState(card.content || '');

  const save = () => {
    if (!draft.trim()) { onDelete(); return; }
    onUpdate(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-2">
          <Textarea value={draft} onChange={e => setDraft(e.target.value)} className="min-h-[60px] text-xs border-none shadow-none p-0 focus-visible:ring-0" autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }} />
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={save}><Check className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setDraft(card.content || ''); setEditing(true); }}>
      <CardContent className="p-3">
        <p className="text-xs whitespace-pre-wrap">{card.content}</p>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </CardContent>
    </Card>
  );
}
