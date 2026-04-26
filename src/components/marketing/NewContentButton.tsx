import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Loader2 } from 'lucide-react';
import { CONTENT_TEMPLATES, type ContentTemplate } from './CONTENT_TEMPLATES';

interface Props {
  onPick: (tpl: ContentTemplate) => void;
  loading?: boolean;
  size?: 'sm' | 'default';
  label?: string;
}

export function NewContentButton({ onPick, loading, size = 'sm', label = 'Novo Conteúdo' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          {loading ? 'A criar...' : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="px-2 pt-1 pb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Escolhe um template</div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {CONTENT_TEMPLATES.map(tpl => (
            <button
              key={tpl.key}
              onClick={() => { setOpen(false); onPick(tpl); }}
              className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <span className="text-lg leading-none mt-0.5">{tpl.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{tpl.label}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}