import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { useCrmLabels, type CrmLabel } from '@/hooks/useCrmLabels';
import { useConfirm } from '@/components/ui/confirm-dialog';

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

interface CrmLabelPickerProps {
  leadId: string;
  selectedLabelIds: string[];
}

export function CrmLabelPicker({ leadId, selectedLabelIds }: CrmLabelPickerProps) {
  const { labels, createLabel, deleteLabel, toggleLeadLabel } = useCrmLabels();
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const handleToggle = (labelId: string, checked: boolean) => {
    toggleLeadLabel.mutate({ leadId, labelId, active: checked });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createLabel.mutate({ name: newName.trim(), color: newColor }, {
      onSuccess: () => { setNewName(''); setCreating(false); },
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="h-3.5 w-3.5" /> Etiquetas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-semibold mb-2">Etiquetas</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {labels.map(label => (
            <div key={label.id} className="flex items-center gap-2 group">
              <Checkbox
                checked={selectedLabelIds.includes(label.id)}
                onCheckedChange={(c) => handleToggle(label.id, !!c)}
              />
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
              <span className="text-sm flex-1 truncate">{label.name}</span>
              <Button
                variant="ghost" size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                aria-label="Eliminar etiqueta"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Eliminar etiqueta?',
                    description: `A etiqueta "${label.name}" será removida de todas as leads.`,
                    confirmText: 'Eliminar',
                    variant: 'destructive',
                  });
                  if (ok) deleteLabel.mutate(label.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {creating ? (
          <div className="mt-3 space-y-2 border-t pt-2">
            <Input placeholder="Nome..." value={newName} onChange={e => setNewName(e.target.value)} className="h-7 text-sm" />
            <div className="flex gap-1">
              {LABEL_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant="soft" size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setCreating(true)}>
            <Plus className="h-3 w-3 mr-1" /> Nova etiqueta
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Small inline label badges for cards */
export function CrmLabelBadges({ labelIds, labels }: { labelIds: string[]; labels: CrmLabel[] }) {
  if (!labelIds?.length) return null;
  const matched = labels.filter(l => labelIds.includes(l.id));
  if (!matched.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {matched.map(l => (
        <Badge key={l.id} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium border" style={{ borderColor: l.color, color: l.color }}>
          {l.name}
        </Badge>
      ))}
    </div>
  );
}
