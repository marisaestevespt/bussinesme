import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';

export interface MentionItem {
  id: string;
  label: string;
}

interface Props {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<any, Props>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (i: number) => {
    const item = items[i];
    if (item) command({ id: item.id, label: item.label });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-popover px-2 py-1.5 text-sm text-muted-foreground shadow-md">
        Sem resultados
      </div>
    );
  }

  return (
    <div className="z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md">
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(i)}
          className={cn(
            'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
            i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = 'MentionList';