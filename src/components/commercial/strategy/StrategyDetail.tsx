import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { Plus, FileDown, Check, Loader2, ArrowLeft, CalendarIcon, X, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
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

  // Linked projects
  const { data: linkedProjects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['strategy-projects', strategyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_strategy_projects')
        .select('id, project_id, projects(id, name, client_name, status)')
        .eq('strategy_id', strategyId) as any;
      return (data || []).map((r: any) => ({
        linkId: r.id,
        ...r.projects,
      }));
    },
  });

  // All projects for picker
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects-for-strategy'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_name, status')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  useEffect(() => {
    if (strategy) {
      setTitle(strategy.title);
      setStartDate(strategy.start_date ? new Date(strategy.start_date) : undefined);
      setEndDate(strategy.end_date ? new Date(strategy.end_date) : undefined);
      const s = (strategy.sections as Section[]) || [];
      setSections(s.length > 0 ? s : DEFAULT_SECTIONS.map(d => ({ ...d, id: generateId() })));
    }
  }, [strategy]);

  const save = useCallback(async (t: string, sd: Date | undefined, ed: Date | undefined, s: Section[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('commercial_strategy')
        .update({
          title: t,
          start_date: sd ? format(sd, 'yyyy-MM-dd') : null,
          end_date: ed ? format(ed, 'yyyy-MM-dd') : null,
          sections: s as any,
          updated_at: new Date().toISOString(),
        } as any)
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

  const debouncedSave = useCallback((t: string, sd: Date | undefined, ed: Date | undefined, s: Section[]) => {
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(t, sd, ed, s), 1500);
  }, [save]);

  const updateSection = (id: string, content: string) => {
    const next = sections.map(s => s.id === id ? { ...s, content } : s);
    setSections(next);
    debouncedSave(title, startDate, endDate, next);
  };

  const updateSectionTitle = (id: string, newTitle: string) => {
    const next = sections.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setSections(next);
    debouncedSave(title, startDate, endDate, next);
  };

  const addSection = () => {
    const next = [...sections, { id: generateId(), title: 'Nova Secção', content: '', is_custom: true }];
    setSections(next);
    debouncedSave(title, startDate, endDate, next);
  };

  const handleTitleChange = (v: string) => {
    setTitle(v);
    debouncedSave(v, startDate, endDate, sections);
  };

  const handleStartDateChange = (d: Date | undefined) => {
    setStartDate(d);
    debouncedSave(title, d, endDate, sections);
  };

  const handleEndDateChange = (d: Date | undefined) => {
    setEndDate(d);
    debouncedSave(title, startDate, d, sections);
  };

  const handleLinkProject = async (projectId: string) => {
    if (linkedProjects.some((p: any) => p.id === projectId)) return;
    const { error } = await supabase
      .from('commercial_strategy_projects')
      .insert({ strategy_id: strategyId, project_id: projectId } as any);
    if (error) {
      toast.error('Erro ao associar projeto');
      return;
    }
    refetchProjects();
    setProjectPickerOpen(false);
  };

  const handleUnlinkProject = async (linkId: string) => {
    const { error } = await supabase
      .from('commercial_strategy_projects')
      .delete()
      .eq('id', linkId);
    if (error) {
      toast.error('Erro ao desassociar projeto');
      return;
    }
    refetchProjects();
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
  const linkedProjectIds = new Set(linkedProjects.map((p: any) => p.id));
  const availableProjects = allProjects.filter((p: any) => !linkedProjectIds.has(p.id));

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
              <h2 className="kpi-display-sm mt-1">{title}</h2>
            )}

            {/* Date range */}
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Início:</span>
                {isOwner ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-2 font-normal", !startDate && "text-muted-foreground")}>
                        {startDate ? format(startDate, "d MMM yyyy", { locale: pt }) : "Definir"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={handleStartDateChange} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="font-medium text-foreground">{startDate ? format(startDate, "d MMM yyyy", { locale: pt }) : "—"}</span>
                )}
              </div>
              <span className="text-border">→</span>
              <div className="flex items-center gap-2">
                <span>Fim:</span>
                {isOwner ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-2 font-normal", !endDate && "text-muted-foreground")}>
                        {endDate ? format(endDate, "d MMM yyyy", { locale: pt }) : "Definir"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={handleEndDateChange} disabled={(date) => startDate ? date < startDate : false} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="font-medium text-foreground">{endDate ? format(endDate, "d MMM yyyy", { locale: pt }) : "—"}</span>
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
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
              <FileDown className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Linked projects */}
        <div className="flex items-center gap-2 flex-wrap">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Projetos:</span>
          {linkedProjects.map((p: any) => (
            <Badge key={p.linkId} variant="secondary" className="gap-1 text-xs">
              {p.name}
              {isOwner && (
                <button onClick={() => handleUnlinkProject(p.linkId)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {isOwner && (
            <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
                  <Plus className="h-3 w-3" /> Associar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Pesquisar projeto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {availableProjects.map((p: any) => (
                        <CommandItem key={p.id} value={p.name} onSelect={() => handleLinkProject(p.id)}>
                          <span className="truncate">{p.name}</span>
                          {p.client_name && <span className="ml-auto text-xs text-muted-foreground truncate">{p.client_name}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {linkedProjects.length === 0 && !isOwner && (
            <span className="text-xs text-muted-foreground">Nenhum projeto associado</span>
          )}
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
          <Button variant="outline" size="sm" onClick={addSection} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Adicionar secção
          </Button>
        </div>
      )}
    </div>
  );
}
