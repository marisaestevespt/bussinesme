import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Check, X, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { SortableKanbanItem } from './SortableKanbanItem';
import type { KanbanGroup, KanbanItem } from './types';

interface Props {
  group: KanbanGroup;
  items: KanbanItem[];
  isOwner: boolean;
  reservedTitles: string[];
  addingToGroup: string | null;
  newItemTitle: string;
  setNewItemTitle: (v: string) => void;
  setAddingToGroup: (v: string | null) => void;
  onAddItem: () => void;
  onOpenItem: (item: KanbanItem) => void;
  onDeleteItem: (id: string) => void;
  onChangeEmoji: (id: string, emoji: string) => void;
  onRenameGroup?: (newLabel: string) => void | Promise<void>;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void | Promise<void>;
  onMoveRight?: () => void | Promise<void>;
}

export function KanbanColumn({
  group, items, isOwner, reservedTitles,
  addingToGroup, newItemTitle, setNewItemTitle, setAddingToGroup,
  onAddItem, onOpenItem, onDeleteItem, onChangeEmoji, onRenameGroup,
  canMoveLeft, canMoveRight, onMoveLeft, onMoveRight,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${group.key}` });
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(group.label);
  React.useEffect(() => { setLabelDraft(group.label); }, [group.label]);

  return (
    <div className="space-y-0 rounded-md overflow-hidden border-2 border-primary/25">
      <div className={cn('flex items-center justify-between px-3 py-2 border-b-2 border-primary/25', group.headerBg)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingLabel && isOwner && onRenameGroup ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={async () => {
                const v = labelDraft.trim();
                if (v && v !== group.label) await onRenameGroup(v);
                setEditingLabel(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const v = labelDraft.trim();
                  if (v && v !== group.label) await onRenameGroup(v);
                  setEditingLabel(false);
                } else if (e.key === 'Escape') {
                  setLabelDraft(group.label);
                  setEditingLabel(false);
                }
              }}
              className={cn('font-typewriter text-[11px] uppercase tracking-[0.2em] bg-transparent outline-none border-b border-current/40 w-full min-w-0', group.headerText)}
            />
          ) : (
            <button
              type="button"
              disabled={!isOwner || !onRenameGroup}
              onClick={() => isOwner && onRenameGroup && setEditingLabel(true)}
              className={cn('font-typewriter text-[11px] uppercase tracking-[0.2em] truncate text-left', group.headerText, isOwner && onRenameGroup && 'hover:underline cursor-pointer')}
              title={isOwner && onRenameGroup ? 'Clica para renomear' : undefined}
            >
              {group.label}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOwner && onMoveLeft && (
            <button
              type="button"
              onClick={() => canMoveLeft && onMoveLeft()}
              disabled={!canMoveLeft}
              className={cn(
                'h-5 w-5 rounded flex items-center justify-center transition-opacity',
                group.headerText,
                canMoveLeft ? 'opacity-60 hover:opacity-100 hover:bg-background/40' : 'opacity-20 cursor-not-allowed'
              )}
              title="Mover coluna para a esquerda"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {isOwner && onMoveRight && (
            <button
              type="button"
              onClick={() => canMoveRight && onMoveRight()}
              disabled={!canMoveRight}
              className={cn(
                'h-5 w-5 rounded flex items-center justify-center transition-opacity',
                group.headerText,
                canMoveRight ? 'opacity-60 hover:opacity-100 hover:bg-background/40' : 'opacity-20 cursor-not-allowed'
              )}
              title="Mover coluna para a direita"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={cn('font-display italic text-base ml-1', group.headerText)}>{items.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-0 bg-card min-h-[60px] transition-colors',
          isOver && 'bg-primary/5 ring-1 ring-primary/30'
        )}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableKanbanItem
              key={item.id}
              item={item}
              isOwner={isOwner}
              reservedTitles={reservedTitles}
              onOpen={onOpenItem}
              onDelete={onDeleteItem}
              onChangeEmoji={onChangeEmoji}
            />
          ))}
        </SortableContext>
        {isOwner && (
          addingToGroup === group.key ? (
            <div className="p-2 space-y-2">
              <Input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                placeholder="Nome do item..."
                className="h-8 text-xs"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && onAddItem()}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={onAddItem}>
                  <Check className="h-3 w-3 mr-1" />Adicionar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingToGroup(null); setNewItemTitle(''); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              className={cn('w-full text-left px-3 py-3 font-typewriter text-[11px] uppercase tracking-[0.18em] hover:bg-secondary/30 transition-colors border-t border-primary/15', group.addColor)}
              onClick={() => setAddingToGroup(group.key)}
            >
              + New page
            </button>
          )
        )}
      </div>
    </div>
  );
}