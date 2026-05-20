import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, Calculator, FileText, MessageSquareHeart, CalendarCheck, Target } from 'lucide-react';

const SHORTCUTS = [
  { to: '/executive/weekly-align', icon: CalendarCheck, label: 'Weekly Align', desc: 'Ritual semanal de revisão',
    iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10' },
  { to: '/planeamento', icon: Target, label: 'Planeamento', desc: 'Visão → Ano → Trimestre → Mês → Semana',
    iconColor: 'text-accent', color: 'from-accent/15 to-accent/5 hover:from-accent/25 hover:to-accent/10' },
  { to: '/executive/innovation', icon: Lightbulb, label: 'Desenvolvimento & Inovação', desc: 'Ideias e roadmap',
    iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10' },
  { to: '/executive/productivity', icon: Calculator, label: 'Produtividade & Capacidade', desc: 'Simular contratação',
    iconColor: 'text-success', color: 'from-success/10 to-success/5 hover:from-success/20 hover:to-success/10' },
  { to: '/executive/recommendations', icon: MessageSquareHeart, label: 'Caixa de Recomendações', desc: 'Feedback da equipa',
    iconColor: 'text-destructive', color: 'from-destructive/10 to-destructive/5 hover:from-destructive/20 hover:to-destructive/10' },
  { to: '/executive/processos', icon: FileText, label: 'Processos da Administração', desc: 'SOPs do owner',
    iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
];

export function StrategyShortcuts() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Acessos rápidos</h2>
        <span className="text-[11px] text-muted-foreground">Onde queres ir agora?</span>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {SHORTCUTS.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.to} to={s.to} className="group">
              <Card className={`cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full`}>
                <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                  <div className={`h-10 w-10 rounded-xl bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}