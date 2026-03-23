import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, FileDown, Check, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface Section {
  id: string;
  title: string;
  content: string;
  is_custom: boolean;
}

const DEFAULT_SECTIONS: Omit<Section, 'id'>[] = [
  { title: 'Posicionamento Comercial', content: '', is_custom: false },
  { title: 'Produtos Estrela', content: '', is_custom: false },
  { title: 'Público-alvo', content: '', is_custom: false },
  { title: 'Objeções Frequentes', content: '', is_custom: false },
  { title: 'Argumentos de Venda', content: '', is_custom: false },
  { title: 'Canais de Venda', content: '', is_custom: false },
  { title: 'Processo de Venda', content: '', is_custom: false },
  { title: 'Metas e Foco do Período', content: '', is_custom: false },
  { title: 'Notas e Revisões', content: '', is_custom: false },
];

const SECTION_HINTS: Record<string, string> = {
  'Posicionamento Comercial': 'O que vendemos, para quem, e de que forma. Como nos posicionamos no mercado face à concorrência.',
  'Produtos Estrela': 'Quais os produtos ou serviços prioritários para este período. Porquê.',
  'Público-alvo': 'Perfil detalhado de quem queremos atingir. Características, contexto, necessidades principais.',
  'Objeções Frequentes': 'Lista das principais objeções encontradas no processo de venda e como as endereçar.',
  'Argumentos de Venda': 'Os argumentos centrais que sustentam a decisão de compra. O que diferencia a oferta.',
  'Canais de Venda': 'Onde e como chegamos aos clientes. Canais principais e papel de cada um no processo comercial.',
  'Processo de Venda': 'Descrição do fluxo desde o primeiro contacto até ao fecho. Etapas, ferramentas e responsáveis.',
  'Metas e Foco do Período': 'Síntese dos objetivos comerciais para este período e prioridades de atuação.',
  'Notas e Revisões': 'Espaço livre para anotações, ideias, aprendizagens ou revisões à estratégia ao longo do tempo.',
};

function generateId() {
  return crypto.randomUUID();
}

interface Props {
  strategyId: string;
  onBack: () => void;
}

export function StrategyDetail({ strategyId, onBack }: Props) {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['commercial-strategy', strategyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_strategy')
        .select('*')
        .eq('id', strategyId)
        .maybeSingle();
      if (!data) return null;
      return {
        ...data,
        sections: (data.sections as unknown as Section[]) || [],
      };
    },
  });

  useEffect(() => {
    if (strategy) {
      setTitle(strategy.title);
      setPeriod(strategy.period);
      const s = (strategy.sections as Section[]) || [];
      setSections(s.length > 0 ? s : DEFAULT_SECTIONS.map(d => ({ ...d, id: generateId() })));
    }
  }, [strategy]);

  const save = useCallback(async (t: string, p: string, s: Section[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('commercial_strategy')
        .update({ title: t, period: p, sections: s as any, updated_at: new Date().toISOString() } as any)
        .eq('id', strategyId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['commercial-strategy', strategyId] });
      setDirty(false);
    } catch {
      toast.error('Erro ao guardar estratégia');
    } finally {
      setSaving(false);
    }
  }, [strategyId, queryClient]);

  const debouncedSave = useCallback((t: string, p: string, s: Section[]) => {
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(t, p, s), 1500);
  }, [save]);

  const updateSection = (id: string, content: string) => {
    const next = sections.map(s => s.id === id ? { ...s, content } : s);
    setSections(next);
    debouncedSave(title, period, next);
  };

  const updateSectionTitle = (id: string, newTitle: string) => {
    const next = sections.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setSections(next);
    debouncedSave(title, period, next);
  };

  const addSection = () => {
    const next = [...sections, { id: generateId(), title: 'Nova Secção', content: '', is_custom: true }];
    setSections(next);
    debouncedSave(title, period, next);
  };

  const handleTitleChange = (v: string) => {
    setTitle(v);
    debouncedSave(v, period, sections);
  };

  const handlePeriodChange = (v: string) => {
    setPeriod(v);
    debouncedSave(title, v, sections);
  };

  const handleExportPdf = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const updatedAt = strategy?.updated_at ? format(new Date(strategy.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt }) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar à galeria
      </Button>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {isOwner ? (
              <Input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                className="text-2xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Título do documento"
              />
            ) : (
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Período:</span>
                {isOwner ? (
                  <Input
                    value={period}
                    onChange={e => handlePeriodChange(e.target.value)}
                    className="w-32 h-7 text-sm border-dashed"
                    placeholder="Ex: 2026, Q1 2026"
                  />
                ) : (
                  <span className="font-medium text-foreground">{period}</span>
                )}
              </div>
              {updatedAt && (
                <>
                  <span className="text-border">•</span>
                  <span>Atualizado: {updatedAt}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {dirty && (
              <span className="text-xs text-muted-foreground animate-pulse">A guardar...</span>
            )}
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!dirty && !saving && strategy && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3" /> Guardado
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <Separator />
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {sections.map((section, idx) => (
          <div key={section.id} className="space-y-3">
            <div className="space-y-1">
              {section.is_custom && isOwner ? (
                <Input
                  value={section.title}
                  onChange={e => updateSectionTitle(section.id, e.target.value)}
                  className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                  placeholder="Título da secção"
                />
              ) : (
                <h3 className="text-lg font-semibold tracking-tight">
                  {idx + 1}. {section.title}
                </h3>
              )}
              {SECTION_HINTS[section.title] && (
                <p className="text-xs text-muted-foreground">{SECTION_HINTS[section.title]}</p>
              )}
            </div>
            <RichTextEditor
              content={section.content}
              onChange={html => updateSection(section.id, html)}
              editable={isOwner}
            />
          </div>
        ))}
      </div>

      {/* Add section */}
      {isOwner && (
        <div className="pt-4 pb-10">
          <Button variant="outline" size="sm" onClick={addSection} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar secção
          </Button>
        </div>
      )}
    </div>
  );
}
