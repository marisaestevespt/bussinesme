import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { AnyView } from '@/hooks/useUserViews';
import { cn } from '@/lib/utils';

interface ViewTabsProps {
  views: AnyView[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd: (label: string) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  /** Optional element rendered to the right of the "Nova vista" button (e.g. filters trigger). */
  trailing?: React.ReactNode;
}

export function ViewTabs({ views, activeKey, onSelect, onAdd, onRename, onDelete, trailing }: ViewTabsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAdd(newLabel.trim());
    setNewLabel('');
    setAddOpen(false);
  };

  const handleRename = () => {
    if (!editingId || !editLabel.trim()) return;
    onRename(editingId, editLabel.trim());
    setEditingId(null);
    setEditLabel('');
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin sm:flex-wrap sm:overflow-visible">
        {views.map(v => (
          <div key={v.key} className="flex items-center group">
            <Button
              variant={activeKey === v.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect(v.key)}
              className="gap-2 shrink-0"
            >
              {v.isDefault && (v as any).icon}
              {v.label}
            </Button>
            {!v.isDefault && 'id' in v && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-6 px-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity -ml-1 shrink-0"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => { setEditingId((v as any).id); setEditLabel(v.label); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete((v as any).id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nova vista
        </Button>
        {trailing}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova visualização</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome da visualização"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <Button className="w-full" onClick={handleAdd} disabled={!newLabel.trim()}>
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editingId} onOpenChange={v => { if (!v) setEditingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renomear visualização</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <Button className="w-full" onClick={handleRename} disabled={!editLabel.trim()}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
