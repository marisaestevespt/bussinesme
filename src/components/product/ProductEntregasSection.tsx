import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, GripVertical } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description?: string;
  is_recurring?: boolean;
  sort_order?: number;
}

interface Props {
  deliverableTemplates: Template[];
  isOwner: boolean;
  productId: string;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

function DeliverableRow({
  template,
  index,
  isOwner,
  onUpdate,
  onDelete,
}: {
  template: Template;
  index: number;
  isOwner: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description || '');
  const nameRef = useRef(template.name);
  const descRef = useRef(template.description || '');

  // Sync from props only when the server value actually changes
  useEffect(() => {
    if (template.name !== nameRef.current) {
      nameRef.current = template.name;
      setName(template.name);
    }
  }, [template.name]);

  useEffect(() => {
    const d = template.description || '';
    if (d !== descRef.current) {
      descRef.current = d;
      setDesc(d);
    }
  }, [template.description]);

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (trimmed !== template.name) {
      nameRef.current = trimmed;
      onUpdate(template.id, { name: trimmed });
    }
  };

  const handleDescBlur = () => {
    if (desc !== (template.description || '')) {
      descRef.current = desc;
      onUpdate(template.id, { description: desc });
    }
  };

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}.</span>
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={handleNameBlur}
        className="flex-1 h-9 text-sm"
        placeholder="Nome da fase/entrega..."
        readOnly={!isOwner}
      />
      <Input
        value={desc}
        onChange={e => setDesc(e.target.value)}
        onBlur={handleDescBlur}
        className="flex-1 h-9 text-sm"
        placeholder="Descrição (opcional)"
        readOnly={!isOwner}
      />
      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-xs text-muted-foreground">
        <Checkbox
          checked={!!template.is_recurring}
          onCheckedChange={(checked) => onUpdate(template.id, { is_recurring: !!checked })}
          disabled={!isOwner}
        />
        Recorrente
      </label>
      {isOwner && (
        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => onDelete(template.id)}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function ProductEntregasSection({ deliverableTemplates, isOwner, onAdd, onUpdate, onDelete }: Props) {
  // Sort by sort_order to guarantee stable ordering
  const sorted = [...deliverableTemplates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Fases / Entregas do Produto</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Define as entregas-tipo deste produto. Serão importadas nos projetos associados.</p>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAdd}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center italic">Nenhuma fase definida. Adiciona as entregas-tipo que este produto inclui.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((t, i) => (
                <DeliverableRow
                  key={t.id}
                  template={t}
                  index={i}
                  isOwner={isOwner}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
