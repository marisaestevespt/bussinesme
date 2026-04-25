import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usePublicoAlvoSections, useUpdateSection, useDeleteSection, useAddSection, PASection } from '@/hooks/usePublicoAlvoData';
import { SectionRenderer } from '@/components/publico-alvo/SectionRenderer';
import { EditableText } from '@/components/publico-alvo/EditableText';
import { Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export default function MarketingPublicoAlvo() {
  const { data: sections, isLoading } = usePublicoAlvoSections();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const addSection = useAddSection();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // The "definicao" section is always pinned at the top, outside the tab system.
  const overviewSection = useMemo(
    () => sections?.find(s => s.section_key === 'definicao'),
    [sections]
  );
  const tabSections = useMemo(
    () => sections?.filter(s => s.section_key !== 'definicao') ?? [],
    [sections]
  );

  // Group remaining sections by nav_group preserving order
  const navGroups = useMemo(() => {
    const groups: { label: string; items: PASection[] }[] = [];
    const seen = new Set<string>();
    for (const s of tabSections) {
      if (!seen.has(s.nav_group)) {
        seen.add(s.nav_group);
        groups.push({ label: s.nav_group, items: [] });
      }
      groups.find(g => g.label === s.nav_group)!.items.push(s);
    }
    return groups;
  }, [tabSections]);

  const allItems = useMemo(() => navGroups.flatMap(g => g.items), [navGroups]);
  const currentKey = activeKey || tabSections[0]?.section_key;
  const currentIndex = allItems.findIndex(i => i.section_key === currentKey);
  const activeSection = tabSections.find(s => s.section_key === currentKey);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) setActiveKey(allItems[currentIndex - 1].section_key);
  }, [currentIndex, allItems]);

  const goToNext = useCallback(() => {
    if (currentIndex < allItems.length - 1) setActiveKey(allItems[currentIndex + 1].section_key);
  }, [currentIndex, allItems]);

  const debouncedUpdate = useCallback((id: string, patch: Partial<PASection>) => {
    if (debounceRef.current[id]) clearTimeout(debounceRef.current[id]);
    debounceRef.current[id] = setTimeout(() => {
      updateSection.mutate({ id, ...patch } as any);
    }, 800);
  }, [updateSection]);

  const handleContentChange = useCallback((sectionId: string, content: Json) => {
    debouncedUpdate(sectionId, { content });
  }, [debouncedUpdate]);

  const handleDeleteSection = (id: string) => {
    deleteSection.mutate(id, {
      onSuccess: () => toast.success('Secção eliminada'),
    });
  };

  const handleAddSection = () => {
    const lastGroup = navGroups[navGroups.length - 1]?.label || 'Decisão e Comunicação';
    const maxOrder = sections?.reduce((max, s) => Math.max(max, s.sort_order), 0) || 0;
    const key = `section-${Date.now()}`;
    addSection.mutate({
      section_key: key,
      title: 'Nova secção',
      nav_group: lastGroup,
      sort_order: maxOrder + 1,
      content: { blocks: [{ type: 'note', text: 'Conteúdo da nova secção...' }] } as unknown as Json,
    }, {
      onSuccess: () => {
        setActiveKey(key);
        toast.success('Secção adicionada');
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Mapa de Público-Alvo" subtitle="Personas, dores, desejos e comunicação estratégica." />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          {/* ═══ OVERVIEW (always visible at top) ═══ */}
          {overviewSection && (
            <section className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[2px] text-primary/60 mb-1.5">Visão geral</p>
                  <EditableText
                    value={overviewSection.title}
                    onSave={t => updateSection.mutate({ id: overviewSection.id, title: t })}
                    as="h2"
                    className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight"
                  />
                  <div className="w-10 h-0.5 bg-primary mt-2 mb-2" />
                  {overviewSection.subtitle && (
                    <EditableText
                      value={overviewSection.subtitle}
                      onSave={t => updateSection.mutate({ id: overviewSection.id, subtitle: t })}
                      className="text-sm text-muted-foreground leading-relaxed max-w-[680px]"
                      multiline
                    />
                  )}
                </div>
              </div>
              <SectionRenderer
                content={overviewSection.content}
                onContentChange={c => handleContentChange(overviewSection.id, c)}
              />
            </section>
          )}

          {overviewSection && tabSections.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-[2px] text-muted-foreground/70 mb-2">Aprofundar</p>
            </div>
          )}

          {/* ═══ TAB NAV ═══ */}
          <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm border-b">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                disabled={currentIndex <= 0}
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <ScrollArea className="flex-1">
                <div className="flex items-center gap-1">
                  {navGroups.map((group, gi) => (
                    <div key={group.label} className="flex items-center gap-1">
                      {gi > 0 && <div className="w-px h-5 bg-border mx-1 shrink-0" />}
                      {group.items.map(item => (
                        <button
                          key={item.section_key}
                          onClick={() => setActiveKey(item.section_key)}
                          className={cn(
                            'whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md transition-colors shrink-0',
                            currentKey === item.section_key
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={handleAddSection}
                    className="whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Secção
                  </button>
                </div>
                <ScrollBar orientation="horizontal" className="h-1" />
              </ScrollArea>
              <button
                onClick={goToNext}
                disabled={currentIndex >= allItems.length - 1}
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ═══ ACTIVE SECTION CONTENT ═══ */}
          {activeSection && (
            <div className="min-h-[400px]">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <EditableText
                    value={activeSection.title}
                    onSave={t => updateSection.mutate({ id: activeSection.id, title: t })}
                    as="h3"
                    className="text-xl sm:text-2xl font-semibold text-foreground leading-tight"
                  />
                  <div className="w-10 h-0.5 bg-primary mt-2 mb-2" />
                  {activeSection.subtitle && (
                    <EditableText
                      value={activeSection.subtitle}
                      onSave={t => updateSection.mutate({ id: activeSection.id, subtitle: t })}
                      className="text-sm text-muted-foreground leading-relaxed max-w-[680px]"
                      multiline
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  aria-label="Eliminar" size="icon"
                  className="text-destructive/40 hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleDeleteSection(activeSection.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <SectionRenderer
                content={activeSection.content}
                onContentChange={c => handleContentChange(activeSection.id, c)}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
