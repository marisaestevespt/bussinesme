import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, CalendarCheck, Target, Compass, NotebookPen, X,
} from 'lucide-react';
import { useRitualBanner, type RitualType } from '@/hooks/useRitualBanner';
import { cn } from '@/lib/utils';

const ICON: Record<RitualType, React.ElementType> = {
  fecho_mes: NotebookPen,
  planear_mes: Target,
  inicio_semestre: Compass,
  inicio_trimestre: Compass,
  weekly_align: CalendarCheck,
  vespera_weekly: CalendarCheck,
};

const TONE_CLASSES: Record<'bordeaux'|'navy'|'gold', string> = {
  bordeaux: 'from-primary/10 via-primary/5 to-transparent border-primary/30',
  navy: 'from-info/10 via-info/5 to-transparent border-info/30',
  gold: 'from-warning/15 via-warning/5 to-transparent border-warning/30',
};

/**
 * Banner contextual de rituais. A lógica está em useRitualBanner.
 * Aparece no topo do Dashboard e do Weekly Align quando aplicável.
 */
export function RitualBanner() {
  const { banner, dismiss, markComplete } = useRitualBanner();
  if (!banner) return null;

  const Icon = ICON[banner.type];

  const handleSecondary = () => {
    if (!banner.ctaSecundario) return;
    if (banner.ctaSecundario.action === 'mark_complete') markComplete(banner);
    else dismiss(banner);
  };

  return (
    <Card className={cn('bg-gradient-to-r border relative', TONE_CLASSES[banner.tone])}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{banner.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{banner.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {banner.ctaSecundario && (
            <Button size="sm" variant="ghost" onClick={handleSecondary}>
              {banner.ctaSecundario.label}
            </Button>
          )}
          <Button asChild size="sm">
            <Link to={banner.to}>
              {banner.cta}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => dismiss(banner)}
            aria-label="Fechar lembrete"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}