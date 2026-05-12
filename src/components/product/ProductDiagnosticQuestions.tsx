import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, ClipboardList, Pencil, Check, X } from 'lucide-react';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { toast } from 'sonner';
import { EntityTabs, EntityTabsList, EntityTabsTrigger, EntityTabsContent } from '@/components/layout/entity/EntityTabs';

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

function QuestionRow({
  q,
  idx,
  isOwner,
  startInEdit,
  onSave,
  onDelete,
}: {
  q: Question;
  idx: number;
  isOwner: boolean;
  startInEdit: boolean;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void> | void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(startInEdit);
  const [draft, setDraft] = useState({
    question: q.question || '',
    internal_note: q.internal_note || '',
    answer_type: q.answer_type || 'text',
  });

  // Sincroniza com servidor quando q muda externamente e não estamos a editar.
  useEffect(() => {
    if (!editing) {
      setDraft({
        question: q.question || '',
        internal_note: q.internal_note || '',
        answer_type: q.answer_type || 'text',
      });
    }
  }, [q.question, q.internal_note, q.answer_type, editing]);

  const typeLabel = ANSWER_TYPES.find(t => t.value === q.answer_type)?.label || q.answer_type;

  const handleSave = async () => {
    await onSave(q.id, {
      question: draft.question,
      internal_note: draft.internal_note || null,
      answer_type: draft.answer_type,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({
      question: q.question || '',
      internal_note: q.internal_note || '',
      answer_type: q.answer_type || 'text',
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex gap-2 items-start group rounded-md hover:bg-muted/40 px-2 py-1.5 -mx-2 transition-colors">
        <span className="text-xs text-muted-foreground mt-1 w-5 shrink-0">{idx + 1}.</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm text-foreground flex-1 min-w-0 break-words">
              {q.question || <span className="italic text-muted-foreground">Sem texto</span>}
            </p>
            <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{typeLabel}</Badge>
          </div>
          {q.internal_note && (
            <p className="text-xs text-muted-foreground italic mt-0.5">{q.internal_note}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Editar"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Eliminar"
              onClick={() => onDelete(q.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start rounded-md bg-muted/30 px-2 py-2 -mx-2">
      <span className="text-xs text-muted-foreground mt-2.5 w-5 shrink-0">{idx + 1}.</span>
      <div className="flex-1 space-y-1.5 min-w-0">
        <Input
          value={draft.question}
          onChange={e => setDraft(d => ({ ...d, question: e.target.value }))}
          placeholder="Pergunta..."
          className="text-sm h-8"
          autoFocus
        />
        <div className="flex gap-2 items-center">
          <Input
            value={draft.internal_note}
            onChange={e => setDraft(d => ({ ...d, internal_note: e.target.value }))}
            placeholder="Nota interna (opcional)"
            className="text-xs h-7 flex-1 italic"
          />
          <Select
            value={draft.answer_type}
            onValueChange={v => setDraft(d => ({ ...d, answer_type: v }))}
          >
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="default"
          className="h-7 w-7"
          aria-label="Guardar"
          onClick={handleSave}
          disabled={!draft.question.trim()}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Cancelar"
          onClick={handleCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function GroupCard({ group, questions, isCollapsed, isOwner, justAddedId, onToggle, onAdd, onSave, onDelete }: {
  group: string;
  questions: Question[];
  isCollapsed: boolean;
  isOwner: boolean;
  justAddedId: string | null;
  onToggle: () => void;
  onAdd: () => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void> | void;
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
        <CardContent className="pt-0 px-4 pb-3 space-y-1">
          {questions.length === 0 && (
            <EmptyHint>Sem perguntas neste grupo</EmptyHint>
          )}
          {questions.map((q, idx) => (
            <QuestionRow
              key={q.id}
              q={q}
              idx={idx}
              isOwner={isOwner}
              startInEdit={q.id === justAddedId || !q.question}
              onSave={onSave}
              onDelete={onDelete}
            />
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
  const [collapsedInitialized, setCollapsedInitialized] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_diagnostic_questions')
        .select('*')
        .eq('product_id', productId)
        .order('group_sort_order')
        .order('sort_order');
      if (error) throw error;
      return data as Question[];
    },
  });

  // Inicializa todos os grupos como FECHADOS por defeito (uma única vez).
  useEffect(() => {
    if (collapsedInitialized || isLoading) return;
    const groups = Array.from(new Set(questions.map(q => q.question_group)));
    const all = new Set<string>([...DIAGNOSTIC_GROUPS, ...CONFIG_GROUPS, ...groups]);
    setCollapsedGroups(all);
    setCollapsedInitialized(true);
  }, [questions, isLoading, collapsedInitialized]);

  const addQuestion = useMutation({
    mutationFn: async (group: string) => {
      const maxOrder = questions.filter(q => q.question_group === group).reduce((max, q) => Math.max(max, q.sort_order), -1);
      const allGroups = [...DIAGNOSTIC_GROUPS, ...CONFIG_GROUPS];
      const groupSortOrder = allGroups.indexOf(group);
      const { data, error } = await supabase.from('product_diagnostic_questions').insert({
        product_id: productId,
        question_group: group,
        question: '',
        answer_type: 'text',
        sort_order: maxOrder + 1,
        group_sort_order: groupSortOrder >= 0 ? groupSortOrder : 99,
      }).select().single();
      if (error) throw error;
      // Abre o grupo onde a pergunta foi criada para ela ficar visível em modo edit.
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(group);
        return next;
      });
      setJustAddedId((data as Question).id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [k: string]: unknown }) => {
      const { error } = await supabase.from('product_diagnostic_questions').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key });
      if (justAddedId && vars.id === justAddedId) setJustAddedId(null);
      toast.success('Pergunta guardada');
    },
    onError: () => toast.error('Erro ao guardar pergunta'),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_diagnostic_questions').delete().eq('id', id);
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

  const handleSave = (id: string, data: Record<string, unknown>) =>
    updateQuestion.mutateAsync({ id, ...data });
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
          justAddedId={justAddedId}
          onToggle={() => toggleGroup(group)}
          onAdd={() => addQuestion.mutate(group)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Perguntas para o Cliente</h3>
        <p className="text-xs text-muted-foreground">Estas perguntas são importadas automaticamente para o portal de cada cliente deste produto.</p>
      </div>

      <EntityTabs defaultValue="diagnostico" className="space-y-4">
        <EntityTabsList className="w-full justify-start">
          <EntityTabsTrigger value="diagnostico">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5 inline" />
            Diagnóstico
            <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">{diagnosticGroups.reduce((n, g) => n + questions.filter(q => q.question_group === g).length, 0)}</Badge>
          </EntityTabsTrigger>
          <EntityTabsTrigger value="config">
            <Settings className="h-3.5 w-3.5 mr-1.5 inline" />
            Configuração do Sistema
            <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">{configGroups.reduce((n, g) => n + questions.filter(q => q.question_group === g).length, 0)}</Badge>
          </EntityTabsTrigger>
        </EntityTabsList>

        <EntityTabsContent value="diagnostico" className="mt-4">
          {renderSection(
            'Diagnóstico',
            <ClipboardList className="h-4 w-4 text-primary" />,
            'Perguntas sobre o negócio, equipa, processos e expectativas do cliente.',
            diagnosticGroups,
            DIAGNOSTIC_GROUPS,
          )}
        </EntityTabsContent>

        <EntityTabsContent value="config" className="mt-4">
          {renderSection(
            'Configuração do Sistema',
            <Settings className="h-4 w-4 text-muted-foreground" />,
            'Dados técnicos que precisas de recolher para configurar o sistema/contas do cliente.',
            configGroups,
            CONFIG_GROUPS,
          )}
        </EntityTabsContent>
      </EntityTabs>
    </div>
  );
}
