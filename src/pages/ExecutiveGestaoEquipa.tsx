import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Users, MessageSquare, FileText, CalendarIcon } from 'lucide-react';
import { useTeamData } from '@/hooks/useTeamData';

import { TabDashboard } from '@/components/hr/TabDashboard';

// Re-export tabs so existing imports keep working.
export { TabEquipa } from '@/components/hr/TabEquipa';
export { TabFeedback } from '@/components/hr/TabFeedback';
export { TabContracts } from '@/components/hr/TabContracts';

const HR_SECTIONS = [
  { path: '/hub/recursos-humanos/equipa', label: 'Equipa', icon: Users, iconColor: 'text-info', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { path: '/hub/recursos-humanos/escala', label: 'Escala', icon: CalendarIcon, iconColor: 'text-warning', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
  { path: '/hub/recursos-humanos/feedback', label: 'Feedback', icon: MessageSquare, iconColor: 'text-warning', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/recursos-humanos/contratos-pagamentos', label: 'Contratos & Pagamentos', icon: FileText, iconColor: 'text-success', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
];

export default function ExecutiveGestaoEquipa() {
  const team = useTeamData();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Gestão de Equipa" subtitle="Pessoas, contratos, horários e feedback — tudo sobre a tua equipa" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HR_SECTIONS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-sm text-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <TabDashboard team={team} />
      </div>
    </AppLayout>
  );
}
