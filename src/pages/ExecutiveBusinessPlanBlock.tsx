import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Check, Trash2, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FIXED_COLUMNS, getColumnIcon } from './business-plan/columns';

export default function ExecutiveBusinessPlanBlock() {
  const { columnKey } = useParams<{ columnKey: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const customCols = useQuery({
    queryKey: ['bp', 'custom_columns'],
    queryFn: async () => {
      const { data } = await supabase.from('business_plan_custom_columns').select('*');
      return data || [];
    },
  });

  const cards = useQuery({
    queryKey: ['bp', 'cards', columnKey],
    queryFn: async () => {
      const { data } = await supabase.from('business_plan_cards').select('*').eq('column_key', columnKey!).order('sort_order');
      return data || [];
    },
    enabled: !!columnKey,
  });

  const allCols = [
    ...FIXED_COLUMNS,
    ...(customCols.data || []).map((c: any) => ({ key: c.column_key, label: c.label })),
  ];
  const col = allCols.find(c => c.key === columnKey);

  const addCard = useMutation({
    mutationFn: async () => {
      await supabase.from('business_plan_cards').insert({ column_key: columnKey!, content: '', sort_order: cards.data?.length || 0 });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards', columnKey] }),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await supabase.from('business_plan_cards').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards', columnKey] }),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('business_plan_cards').delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bp', 'cards', columnKey] }),
  });

  if (!col) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <BackNavigation />
          <p className="text-muted-foreground">Bloco não encontrado.</p>
          <Button onClick={() => navigate('/executive/business-plan')}>Voltar ao Canvas</Button>
        </div>
      </AppLayout>
    );
  }

  const Icon = getColumnIcon(col.key);

  return (
    <AppLayout>
      <div className="space-y-5 max-w-4xl mx-auto">
        <BackNavigation />
        <Button variant="ghost" size="sm" onClick={() => navigate('/executive/business-plan')} className="gap-2 -mt-2">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Canvas
        </Button>

        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-primary/10 p-4 text-primary shrink-0">
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:kpi-display-sm mt-1">{col.label}</h1>
            <p className="text-sm text-muted-foreground mt-1">Edita os pontos deste bloco do Business Model Canvas</p>
          </div>
        </div>

        <div className="space-y-3">
          {(cards.data || []).map((card: any) => (
            <BlockCard key={card.id} card={card} onUpdate={c => updateCard.mutate({ id: card.id, content: c })} onDelete={() => deleteCard.mutate(card.id)} />
          ))}

          <Button variant="outline" className="w-full" onClick={() => addCard.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar ponto
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function BlockCard({ card, onUpdate, onDelete }: { card: any; onUpdate: (c: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(!card.content);
  const [draft, setDraft] = useState(card.content || '');

  const save = () => {
    if (!draft.trim()) { onDelete(); return; }
    onUpdate(draft.trim());
    setEditing(false);
    toast.success('Guardado');
  };

  if (editing) {
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          <Textarea value={draft} onChange={e => setDraft(e.target.value)} className="min-h-[100px] text-sm" autoFocus placeholder="Escreve aqui..." />
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="h-3 w-3 mr-1" /> Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(card.content || ''); if (!card.content) onDelete(); else setEditing(false); }}>Cancelar</Button>
            <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3 mr-1" /> Apagar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setDraft(card.content || ''); setEditing(true); }}>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <p className="text-sm whitespace-pre-wrap flex-1">{card.content}</p>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
