import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  deliverableTemplates: Array<{ id: string; name: string; description?: string; is_recurring?: boolean }>;
  isOwner: boolean;
  productId: string;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export function ProductEntregasSection({ deliverableTemplates, isOwner, onAdd, onUpdate, onDelete }: Props) {
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
          {deliverableTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center italic">Nenhuma fase definida. Adiciona as entregas-tipo que este produto inclui.</p>
          ) : (
            <div className="space-y-2">
              {deliverableTemplates.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 group">
                  <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">{i + 1}.</span>
                  <Input
                    defaultValue={t.name}
                    onBlur={e => onUpdate(t.id, { name: e.target.value })}
                    className="flex-1 h-9 text-sm"
                    placeholder="Nome da fase/entrega..."
                    readOnly={!isOwner}
                  />
                  <Input
                    defaultValue={t.description || ''}
                    onBlur={e => onUpdate(t.id, { description: e.target.value })}
                    className="flex-1 h-9 text-sm"
                    placeholder="Descrição (opcional)"
                    readOnly={!isOwner}
                  />
                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-xs text-muted-foreground">
                    <Checkbox
                      checked={!!t.is_recurring}
                      onCheckedChange={(checked) => onUpdate(t.id, { is_recurring: !!checked })}
                      disabled={!isOwner}
                    />
                    Recorrente
                  </label>
                  {isOwner && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => onDelete(t.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
