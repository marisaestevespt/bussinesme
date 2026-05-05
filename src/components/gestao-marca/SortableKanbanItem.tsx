import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import type { KanbanItem } from './types';

interface Props {
  item: KanbanItem;
  isOwner: boolean;
  reservedTitles: string[];
  onOpen: (item: KanbanItem) => void;
  onDelete: (id: string) => void;
  onChangeEmoji: (id: string, emoji: string) => void;
}

export function SortableKanbanItem({
  item, isOwner, reservedTitles, onOpen, onDelete, onChangeEmoji,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition-colors group bg-background/0"
    >
      {isOwner ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={e => e.stopPropagation()}
              className="text-base leading-none hover:scale-110 transition-transform"
              title="Mudar emoji"
            >
              {item.emoji || '📄'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start" onClick={e => e.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={(data) => onChangeEmoji(item.id, data.emoji)}
              emojiStyle={EmojiStyle.NATIVE}
              theme={Theme.AUTO}
              height={400}
              width={320}
              searchPlaceholder="Procurar emoji..."
              previewConfig={{ showPreview: false }}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-base leading-none">{item.emoji || '📄'}</span>
      )}
      <button
        type="button"
        className="text-sm text-foreground flex-1 truncate text-left cursor-pointer"
        onClick={() => onOpen(item)}
      >
        {item.title}
      </button>
      {isOwner && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing px-1 opacity-0 group-hover:opacity-100"
          title="Arrastar"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      )}
      {isOwner && !reservedTitles.includes(item.title) && !item.is_system && (
        <Button
          variant="ghost"
          aria-label="Eliminar" size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}