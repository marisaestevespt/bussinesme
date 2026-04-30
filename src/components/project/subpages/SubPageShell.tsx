import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  icon: LucideIcon | React.ElementType;
  onBack: () => void;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * High-contrast wrapper for project sub-pages.
 * Hero header with icon + title + back/save buttons + hairline.
 */
export function SubPageShell({ title, description, icon: Icon, onBack, onSave, saving, dirty, children, className }: Props) {
  return (
    <AppLayout>
      <div className={cn('w-full max-w-5xl mx-auto space-y-6', className)}>
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao projeto
          </Button>
          {onSave && dirty && (
            <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          )}
        </div>

        {/* Hero header */}
        <header className="flex items-start gap-4 pb-5 border-b border-border">
          <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-3 ring-1 ring-primary/20 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        </header>

        {children}
      </div>
    </AppLayout>
  );
}