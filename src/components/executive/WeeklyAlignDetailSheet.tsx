import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface DetailField {
  label: string;
  value: string | number | null | undefined;
  badge?: boolean;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  fields: DetailField[];
}

export function WeeklyAlignDetailSheet({ open, onOpenChange, title, subtitle, fields }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>
        <Separator className="my-4" />
        <div className="space-y-4">
          {fields.map((f, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
              {f.badge ? (
                <Badge variant={f.badgeVariant || 'secondary'}>{f.value || '—'}</Badge>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{f.value ?? '—'}</p>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
