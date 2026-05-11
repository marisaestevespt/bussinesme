import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { FileText, Inbox } from 'lucide-react';

/* ─── Table Skeleton ─────────────────────────────────────── */
interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function TableSkeleton({ columns = 6, rows = 5, className }: TableSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, row) => (
              <TableRow key={row}>
                {Array.from({ length: columns }).map((_, col) => (
                  <TableCell key={col}>
                    <Skeleton className={cn("h-4", col === 0 ? "w-16" : col === columns - 1 ? "w-12" : "w-24")} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── KPI Cards Skeleton ─────────────────────────────────── */
interface KpiSkeletonProps {
  count?: number;
  className?: string;
}

export function KpiSkeleton({ count = 4, className }: KpiSkeletonProps) {
  return (
    <div className={cn("grid gap-4", count <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Card List Skeleton ─────────────────────────────────── */
interface CardListSkeletonProps {
  count?: number;
  className?: string;
}

export function CardListSkeleton({ count = 3, className }: CardListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Chart Skeleton ─────────────────────────────────────── */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Page Skeleton (full page loading) ──────────────────── */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <KpiSkeleton />
      <TableSkeleton />
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="rounded-sm border-2 border-primary/25 bg-secondary/40 p-4 mb-4">
        <Icon className="h-7 w-7 text-primary/60" strokeWidth={1.4} />
      </div>
      <div className="eyebrow mb-2">Sem registos</div>
      <h3 className="font-display italic text-2xl leading-tight text-foreground mb-1">{title}</h3>
      {description && <p className="font-display italic text-primary/60 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

/* ─── Inline Loading ─────────────────────────────────────── */
export function InlineLoader({ text = 'A carregar...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-primary/60">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      <span className="font-typewriter text-[11px] uppercase tracking-[0.24em]">{text}</span>
    </div>
  );
}

/* ─── Empty Hint (lightweight inline empty state) ────────── */
interface EmptyHintProps {
  children: React.ReactNode;
  className?: string;
}

export function EmptyHint({ children, className }: EmptyHintProps) {
  return (
    <p className={cn("font-display italic text-primary/55 text-center py-6", className)}>
      {children}
    </p>
  );
}
