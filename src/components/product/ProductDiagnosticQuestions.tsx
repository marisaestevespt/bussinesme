import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, ClipboardList } from 'lucide-react';

interface Props {
  productId: string;
  isOwner: boolean;
}

const ANSWER_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Escolha' },
  { value: 'file', label: 'Ficheiro' },
];

const DIAGNOSTIC_GROUPS = [
  'O Negócio',
  'Equipa',
  'Operação e Processos',
  'Ferramentas Atuais',
  'Dificuldades e Visão',
  'Expectativas e Prioridades',
];

const CONFIG_GROUPS = [
  'Config. Sistema — Dados da Empresa',
  'Config. Sistema — Contactos',
  'Config. Sistema — Tipo de Negócio',
  'Config. Sistema — Identificação Fiscal',
  'Config. Sistema — Configuração Fiscal',
  'Config. Sistema — Equipa & Contabilista',
  'Config. Sistema — Métodos de Pagamento',
  'Config. Sistema — Canais de Marketing',
  'Config. Sistema — Identidade Visual',
];

type Question = {
  id: string;
  product_id: string;
  question_group: string;
  question: string;
  internal_note: string | null;
  answer_type: string;
  sort_order: number;
};

function isConfigGroup(group: string) {
  return group.startsWith('Config. Sistema');
}

function GroupCard({ group, questions, isCollapsed, isOwner, onToggle, onAdd, onUpdate, onDelete }: {
  group: string;
  questions: Question[];
  isCollapsed: boolean;
  isOwner: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const displayName = group.replace('Config. Sistema — ', '');

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-sm">{displayName}</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{questions.length}</Badge>
        </div>
        {isOwner && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onAdd(); }}>
            <Plus className="h-3 w-3 mr-1" /> Pergunta
          </Button>
        )}
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0 px-4 pb-3 space-y-2">
          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Sem perguntas neste grupo</p>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="flex gap-2 items-start group">
              <span className="text-xs text-muted-foreground mt-2.5 w-5 shrink-0">{idx + 1}.</span>
              <div className="flex-1 space-y-1">
                <Input
                  defaultValue={q.question}
                  placeholder="Pergunta..."
                  className="text-sm h-8"
                  onBlur={e => {
                    if (e.target.value !== q.question) onUpdate(q.id, { question: e.target.value });
                  }}
                  readOnly={!isOwner}
                />
                <div className="flex gap-2 items-center">
                  <Input
                    defaultValue={q.internal_note || ''}
                    placeholder="Nota interna (opcional)"
                    className="text-xs h-7 flex-1 text-muted-foreground italic"
                    onBlur={e => {
                      if (e.target.value !== (q.internal_note || '')) onUpdate(q.id, { internal_note: e.target.value || null });
                    }}
                    readOnly={!isOwner}
                  />
                  {isOwner && (
                    <Select
                      value={q.answer_type}
                      onValueChange={v => onUpdate(q.id, { answer_type: v })}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANSWER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" onClick={() => onDelete(q.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function ProductDiagnosticQuestions({ productId, isOwner }: Props) {
  const qc = useQueryClient();
  const key = ['product_diagnostic_questions', productId];
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: questions = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_diagnostic_questions')
        .select('*')
        .eq('product_id', productId)
        .order('group_sort_order')
        .order('sort_order');
      if (error) throw error;
      return data as Question[];
    },
  });

  const addQuestion = useMutation({
    mutationFn: async (group: string) => {
      const maxOrder = questions.filter(q => q.question_group === group).reduce((max, q) => Math.max(max, q.sort_order), -1);
      const allGroups = [...DIAGNOSTIC_GROUPS, ...CONFIG_GROUPS];
      const groupSortOrder = allGroups.indexOf(group);
      const { error } = await (supabase as any).from('product_diagnostic_questions').insert({
        product_id: productId,
        question_group: group,
        question: '',
        answer_type: 'text',
        sort_order: maxOrder + 1,
        group_sort_order: groupSortOrder >= 0 ? groupSortOrder : 99,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [k: string]: unknown }) => {
      const { error } = await (supabase as any).from('product_diagnostic_questions').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('product_diagnostic_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const allGroups = Array.from(new Set(questions.map(q => q.question_group)));
  const diagnosticGroups = allGroups.filter(g => !isConfigGroup(g));
  const configGroups = allGroups.filter(g => isConfigGroup(g));

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleUpdate = (id: string, data: Record<string, unknown>) => updateQuestion.mutate({ id, ...data });
  const handleDelete = (id: string) => deleteQuestion.mutate(id);

  if (isLoading) return <div className="text-sm text-muted-foreground">A carregar...</div>;

  const renderSection = (title: string, icon: React.ReactNode, description: string, groups: string[], defaultGroupList: string[]) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="text-sm font-semibold">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {isOwner && (
          <Select onValueChange={group => addQuestion.mutate(group)}>
            <SelectTrigger className="h-8 text-xs w-[200px]">
              <SelectValue placeholder="+ Pergunta em grupo..." />
            </SelectTrigger>
            <SelectContent>
              {defaultGroupList.map(g => (
                <SelectItem key={g} value={g}>{g.replace('Config. Sistema — ', '')}</SelectItem>
              ))}
              {groups.filter(g => !defaultGroupList.includes(g)).map(g => (
                <SelectItem key={g} value={g}>{g.replace('Config. Sistema — ', '')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {groups.length === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sem perguntas nesta secção.</CardContent></Card>
      )}
      {groups.map(group => (
        <GroupCard
          key={group}
          group={group}
          questions={questions.filter(q => q.question_group === group)}
          isCollapsed={collapsedGroups.has(group)}
          isOwner={isOwner}
          onToggle={() => toggleGroup(group)}
          onAdd={() => addQuestion.mutate(group)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold">Perguntas de Diagnóstico</h3>
        <p className="text-xs text-muted-foreground">Estas perguntas serão automaticamente importadas para o portal de cada cliente deste produto.</p>
      </div>

      {renderSection(
        'Diagnóstico',
        <ClipboardList className="h-4 w-4 text-primary" />,
        'Perguntas sobre o negócio, equipa, processos e expectativas',
        diagnosticGroups,
        DIAGNOSTIC_GROUPS,
      )}

      {renderSection(
        'Configuração do Sistema',
        <Settings className="h-4 w-4 text-muted-foreground" />,
        'Dados necessários para configurar o sistema do cliente',
        configGroups,
        CONFIG_GROUPS,
      )}
    </div>
  );
}
