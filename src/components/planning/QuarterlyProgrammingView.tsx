import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Target, AlertTriangle, Flag, Sparkles, Briefcase, Megaphone, Wallet, Settings2, Users, Package, UserCog } from 'lucide-react';
import { PLAN_AREAS, planAreaLabel } from '@/hooks/usePlanningData';
import { useQuarterlyPlan, type QuarterStr, type QuarterItemKind } from '@/hooks/useQuarterlyPlan';
import { confirmDestructive } from '@/lib/confirmDestructive';
import { InlineEditableText } from '@/components/ui/inline-editable-text';

const AREA_ICONS: Record<string, any> = {
  comercial: Briefcase, marketing: Megaphone, financeiro: Wallet,
  operacao: Settings2, clientes: Users, produtos: Package,
  equipa: UserCog, geral: Target,
};

interface Props {
  year: number;
  quarter: QuarterStr;
}

export function QuarterlyProgrammingView({ year, quarter }: Props) {
  const { plans, items, upsertPlan, upsertItem, removeItem } = useQuarterlyPlan(year, quarter);

  const planFor = (area: string) => plans.find(p => p.area === area);
  const itemsFor = (area: string, kind: QuarterItemKind) =>
    items.filter(i => i.area === area && i.kind === kind);

  return (
    <div className="space-y-4">
      {PLAN_AREAS.map((a) => {
        const area = a.value;
        const Icon = AREA_ICONS[area] || Target;
        const plan = planFor(area);
        return (
          <Card key={area} className="hq-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider">{planAreaLabel(area)}</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">{quarter} · {year}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Tema do trimestre */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tema do trimestre</label>
                </div>
                <InlineEditableText
                  value={plan?.theme || ''}
                  emptyText="Define o foco principal deste trimestre"
                  placeholder="Uma frase: qual é o foco principal?"
                  onSave={(v) => upsertPlan.mutate({ area, year, quarter, theme: v })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Prioridades */}
                <ItemListSection
                  title="Top prioridades"
                  icon={<Target className="h-3.5 w-3.5" />}
                  emptyText="Define as 3 prioridades do trimestre."
                  items={itemsFor(area, 'priority')}
                  onAdd={(title) => upsertItem.mutate({ area, year, quarter, kind: 'priority', title, sort_order: itemsFor(area, 'priority').length })}
                  onRemove={(id) => removeItem.mutate(id)}
                  onUpdate={(it, patch) => upsertItem.mutate({ ...it, ...patch })}
                  placeholder="Ex.: Lançar nova campanha de leads"
                />

                {/* Marcos */}
                <ItemListSection
                  title="Marcos do trimestre"
                  icon={<Flag className="h-3.5 w-3.5" />}
                  emptyText="Datas-chave (lançamentos, eventos, deadlines)."
                  items={itemsFor(area, 'milestone')}
                  onAdd={(title) => upsertItem.mutate({ area, year, quarter, kind: 'milestone', title, sort_order: itemsFor(area, 'milestone').length })}
                  onRemove={(id) => removeItem.mutate(id)}
                  onUpdate={(it, patch) => upsertItem.mutate({ ...it, ...patch })}
                  placeholder="Ex.: Site novo em produção"
                  showDate
                />

                {/* Riscos */}
                <ItemListSection
                  title="Riscos & blockers"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  emptyText="O que pode descarrilar este trimestre?"
                  items={itemsFor(area, 'risk')}
                  onAdd={(title) => upsertItem.mutate({ area, year, quarter, kind: 'risk', title, severity: 'media', sort_order: itemsFor(area, 'risk').length })}
                  onRemove={(id) => removeItem.mutate(id)}
                  onUpdate={(it, patch) => upsertItem.mutate({ ...it, ...patch })}
                  placeholder="Ex.: Sem capacidade técnica para Y"
                  showSeverity
                  showMitigation
                />

                {/* Capacidade & Financeiro */}
                <div className="space-y-3">
                  <NotesEditor
                    label="Capacidade da equipa"
                    icon={<Users className="h-3.5 w-3.5" />}
                    value={plan?.capacity_notes || ''}
                    placeholder="Horas disponíveis, ausências, contratações…"
                    onSave={(v) => upsertPlan.mutate({ area, year, quarter, capacity_notes: v })}
                  />
                  <NotesEditor
                    label="Financeiro"
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    value={plan?.financial_notes || ''}
                    placeholder="Receita prevista, orçamento, custos críticos…"
                    onSave={(v) => upsertPlan.mutate({ area, year, quarter, financial_notes: v })}
                  />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NotesEditor({ label, icon, value, placeholder, onSave }: {
  label: string; icon: React.ReactNode; value: string; placeholder: string;
  onSave: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-border/60 p-2.5 space-y-1 bg-muted/10">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <InlineEditableText
        value={value}
        multiline
        rows={2}
        placeholder={placeholder}
        emptyText={placeholder}
        onSave={onSave}
      />
    </div>
  );
}

function ItemListSection({
  title, icon, items, emptyText, onAdd, onRemove, onUpdate, placeholder,
  showDate, showSeverity, showMitigation,
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  emptyText: string;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: any, patch: any) => void;
  placeholder: string;
  showDate?: boolean;
  showSeverity?: boolean;
  showMitigation?: boolean;
}) {
  const [newTitle, setNewTitle] = useState('');
  const add = () => {
    const t = newTitle.trim();
    if (!t) return;
    onAdd(t);
    setNewTitle('');
  };

  return (
    <div className="rounded-md border border-border/60 p-2.5 space-y-2 bg-muted/10">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{title}</span>
        <Badge variant="outline" className="text-[9px] ml-auto">{items.length}</Badge>
      </div>
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">{emptyText}</p>
      )}
      <div className="space-y-1.5">
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            onRemove={() => onRemove(it.id)}
            onUpdate={(patch) => onUpdate(it, patch)}
            showDate={showDate}
            showSeverity={showSeverity}
            showMitigation={showMitigation}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={add} disabled={!newTitle.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ItemRow({ item, onRemove, onUpdate, showDate, showSeverity, showMitigation }: {
  item: any;
  onRemove: () => void;
  onUpdate: (patch: any) => void;
  showDate?: boolean;
  showSeverity?: boolean;
  showMitigation?: boolean;
}) {
  const [dueDate, setDueDate] = useState(item.due_date || '');
  const [severity, setSeverity] = useState(item.severity || 'media');

  const sevColor = severity === 'alta' ? 'border-rose-500/40 text-rose-600' :
    severity === 'baixa' ? 'border-emerald-500/40 text-emerald-600' :
    'border-amber-500/40 text-amber-600';

  return (
    <div className="rounded border border-border/40 bg-background p-1.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <InlineEditableText
            value={item.title}
            onSave={(v) => { if (v !== item.title) onUpdate({ title: v }); }}
            displayClassName="text-xs"
          />
        </div>
        {showSeverity && (
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); onUpdate({ severity: e.target.value }); }}
            className={`h-6 text-[10px] rounded border bg-background px-1 ${sevColor}`}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        )}
        {showDate && (
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); onUpdate({ due_date: e.target.value || null }); }}
            className="h-6 text-[10px] w-32 px-1"
          />
        )}
        <Button
          size="icon" variant="ghost" className="h-5 w-5 text-destructive shrink-0"
          onClick={async () => {
            if (await confirmDestructive({ title: 'Remover item?' })) onRemove();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {showMitigation && (
        <InlineEditableText
          value={item.mitigation || ''}
          onSave={(v) => { if (v !== (item.mitigation || '')) onUpdate({ mitigation: v }); }}
          placeholder="Mitigação"
          emptyText="+ Adicionar mitigação"
          displayClassName="text-[11px]"
        />
      )}
    </div>
  );
}