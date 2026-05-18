import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Check, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { FIXED_COLUMNS, getColumnIcon } from '@/pages/business-plan/columns';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

/**
 * Business Model Canvas — extraído de ExecutiveBusinessPlan para poder
 * ser embebido no Planeamento Estratégico sem duplicar lógica.
 *
 * Toda a edição de cada bloco continua a acontecer em
 * `/executive/business-plan/:columnKey` (via click no bloco).
 */
export function BusinessPlanCanvas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [newColLabel, setNewColLabel] = useState('');
  const [addingCol, setAddingCol] = useState(false);

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

  const addColumn = useMutation({
    mutationFn: async (label: string) => {
      await supabase.from('business_plan_custom_columns').insert({
        column_key: `custom_${Date.now()}`,
        label,
        sort_order: 100 + (customCols.data?.length || 0),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bp', 'custom_columns'] });
      setNewColLabel('');
      setAddingCol(false);
      toast.success('Coluna adicionada');
    },
  });

  const deleteColumn = useMutation({
    mutationFn: async ({ id, key }: { id: string; key: string }) => {
      await requireConfirm();
      await supabase.from('business_plan_cards').delete().eq('column_key', key);
      await supabase.from('business_plan_custom_columns').delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bp'] });
      toast.success('Coluna removida');
    },
  });

  const customColumns = (customCols.data || []).map((c: any) => ({
    key: c.column_key,
    label: c.label,
    custom: true,
    id: c.id,
  }));

  const cardsByCol = (key: string) => (cards.data || []).filter((c: any) => c.column_key === key);

  const PARCERIAS = FIXED_COLUMNS.find((c) => c.key === 'parcerias_chave')!;
  const ATIVIDADES = FIXED_COLUMNS.find((c) => c.key === 'atividades_chave')!;
  const RECURSOS = FIXED_COLUMNS.find((c) => c.key === 'recursos_chave')!;
  const PROPOSTA = FIXED_COLUMNS.find((c) => c.key === 'proposta_valor')!;
  const RELACOES = FIXED_COLUMNS.find((c) => c.key === 'relacoes_clientes')!;
  const CANAIS = FIXED_COLUMNS.find((c) => c.key === 'canais_divulgacao')!;
  const SEGMENTO = FIXED_COLUMNS.find((c) => c.key === 'segmento_mercado')!;
  const CUSTOS = FIXED_COLUMNS.find((c) => c.key === 'estrutura_custos')!;
  const RECEITA = FIXED_COLUMNS.find((c) => c.key === 'fonte_receita')!;

  const renderBlock = (
    col: { key: string; label: string; custom?: boolean; id?: string },
    className = '',
  ) => {
    const colCards = cardsByCol(col.key);
    const Icon = getColumnIcon(col.key);
    return (
      <div
        key={col.key}
        onClick={() => navigate(`/executive/business-plan/${col.key}`)}
        className={`group relative flex flex-col rounded-xl border bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wide truncate">{col.label}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground bg-background rounded px-1.5 py-0.5">
              {colCards.length}
            </span>
            {col.custom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteColumn.mutate({ id: col.id!, key: col.key });
                }}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex-1 p-2 space-y-1 overflow-hidden min-h-[100px]">
          {colCards.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic px-1 py-2">+ Adicionar</p>
          ) : (
            colCards.slice(0, 4).map((c: any) => (
              <div
                key={c.id}
                className="text-[11px] bg-muted/40 rounded px-1.5 py-1 line-clamp-2 leading-snug"
              >
                {c.content || <span className="italic text-muted-foreground">vazio</span>}
              </div>
            ))
          )}
          {colCards.length > 4 && (
            <p className="text-[10px] text-muted-foreground px-1">+{colCards.length - 4} mais…</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Canvas</h2>
        {addingCol ? (
          <div className="flex gap-2 items-center">
            <Input
              value={newColLabel}
              onChange={(e) => setNewColLabel(e.target.value)}
              placeholder="Nome do bloco"
              className="h-8 w-48 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && newColLabel.trim() && addColumn.mutate(newColLabel.trim())}
            />
            <Button size="sm" onClick={() => newColLabel.trim() && addColumn.mutate(newColLabel.trim())}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingCol(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingCol(true)}>
            <Plus className="h-3 w-3 mr-1" /> Novo Bloco
          </Button>
        )}
      </div>

      {/* CANVAS — Osterwalder original (5 colunas em cima, 2 em baixo) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {renderBlock(PARCERIAS, 'md:row-span-2')}
        {renderBlock(ATIVIDADES)}
        {renderBlock(PROPOSTA, 'md:row-span-2')}
        {renderBlock(RELACOES)}
        {renderBlock(SEGMENTO, 'md:row-span-2')}
        {renderBlock(RECURSOS)}
        {renderBlock(CANAIS)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderBlock(CUSTOS)}
        {renderBlock(RECEITA)}
      </div>

      {customColumns.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Blocos personalizados</h3>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customColumns.map((col) => renderBlock(col))}
          </div>
        </>
      )}
    </div>
  );
}