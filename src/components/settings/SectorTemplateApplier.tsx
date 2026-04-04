import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, FileText, DollarSign, CalendarCheck, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { SECTOR_TEMPLATES } from '@/lib/sector-templates';
import { SECTOR_OPTIONS, type BusinessSector } from '@/lib/sector-config';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  sector: BusinessSector;
}

type TemplateCategory = 'sops' | 'categories' | 'routines';

const CATEGORY_META: Record<TemplateCategory, { label: string; icon: typeof FileText; description: string }> = {
  sops: { label: 'SOPs', icon: FileText, description: 'Procedimentos operacionais padrão' },
  categories: { label: 'Categorias Financeiras', icon: DollarSign, description: 'Categorias de receita e despesa' },
  routines: { label: 'Rotinas', icon: CalendarCheck, description: 'Rotinas recorrentes sugeridas' },
};

const FREQ_MAP: Record<string, string> = {
  diaria: 'daily',
  semanal: 'weekly',
  mensal: 'monthly',
  trimestral: 'quarterly',
};

export function SectorTemplateApplier({ sector }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<TemplateCategory>>(new Set(['sops', 'categories', 'routines']));
  const [expanded, setExpanded] = useState<TemplateCategory | null>(null);
  const [applying, setApplying] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const templates = SECTOR_TEMPLATES[sector];
  const sectorLabel = SECTOR_OPTIONS.find(s => s.value === sector)?.label || sector;

  const toggle = (cat: TemplateCategory) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const applyTemplates = async () => {
    if (selected.size === 0) { toast.error('Seleciona pelo menos uma categoria'); return; }
    setApplying(true);

    try {
      const userId = user?.id;
      let sopCount = 0, catCount = 0, routCount = 0;

      if (selected.has('sops') && templates.sops.length > 0) {
        for (const sop of templates.sops) {
          const { error } = await supabase.from('sops').insert({
            name: sop.title,
            department: sop.department,
            passos: sop.steps.map((s, i) => ({ id: crypto.randomUUID(), order: i + 1, text: s })),
            status: 'ativo',
            created_by: userId,
          });
          if (!error) sopCount++;
        }
      }

      if (selected.has('categories') && templates.categories.length > 0) {
        for (const cat of templates.categories) {
          const value = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          const { error } = await supabase.from('financial_categories').insert({
            label: cat.name,
            value,
            category_type: cat.type === 'receita' ? 'entrada' : 'saida',
          });
          if (!error) catCount++;
        }
      }

      if (selected.has('routines') && templates.routines.length > 0) {
        for (const routine of templates.routines) {
          const { error } = await supabase.from('planning_routines').insert({
            title: routine.name,
            recurrence_type: FREQ_MAP[routine.frequency] || 'weekly',
            department: routine.department,
            active: true,
            created_by: userId,
          });
          if (!error) routCount++;
        }
      }

      const parts: string[] = [];
      if (sopCount) parts.push(`${sopCount} SOPs`);
      if (catCount) parts.push(`${catCount} categorias`);
      if (routCount) parts.push(`${routCount} rotinas`);

      if (parts.length > 0) {
        toast.success(`Templates aplicados: ${parts.join(', ')}`);
      } else {
        toast.info('Nenhum template novo aplicado (podem já existir)');
      }

      setShowPanel(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aplicar templates');
    } finally {
      setApplying(false);
    }
  };

  // Combine all template items for display
  const displayItems: Record<TemplateCategory, Array<{ title?: string; name?: string; type?: string }>> = {
    sops: templates.sops,
    categories: templates.categories,
    routines: templates.routines,
  };

  if (!showPanel) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPanel(true)}
        className="gap-2 mt-2"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Aplicar templates do setor
      </Button>
    );
  }

  return (
    <Card className="mt-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Templates para {sectorLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pré-preenche o sistema com dados típicos do teu setor. Os templates são aditivos — não apagam dados existentes.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(CATEGORY_META) as TemplateCategory[]).map(cat => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const items = displayItems[cat];
          const isExpanded = expanded === cat;

          return (
            <div key={cat} className="rounded-lg border bg-background/50 overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <Checkbox
                  checked={selected.has(cat)}
                  onCheckedChange={() => toggle(cat)}
                />
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {items.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setExpanded(isExpanded ? null : cat)}
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {isExpanded && (
                <div className="border-t px-3 py-2 bg-muted/30">
                  <ul className="space-y-1">
                    {items.map((item: any, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span>
                        <span>
                          {item.title || item.name}
                          {item.type && (
                            <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">
                              {item.type === 'receita' ? 'receita' : 'despesa'}
                            </Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={applyTemplates} disabled={applying || selected.size === 0} className="gap-2">
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {applying ? 'A aplicar...' : 'Aplicar selecionados'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowPanel(false)} disabled={applying}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
