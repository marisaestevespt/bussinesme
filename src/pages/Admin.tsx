import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { SettingsEdgeMonitoring } from '@/components/settings/SettingsEdgeMonitoring';
import { SettingsReconciliation } from '@/components/settings/SettingsReconciliation';
import { RecurringPhasesPreview } from '@/components/settings/RecurringPhasesPreview';
import { SupplierExtensionSuggestions } from '@/components/settings/SupplierExtensionSuggestions';
import { SettingsAutomations } from '@/components/settings/SettingsAutomations';
import { SettingsBackups } from '@/components/settings/SettingsBackups';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Wrench, CalendarClock, Zap, Database, FlaskConical, ChevronRight } from 'lucide-react';

const TABS = [
  { key: 'monitorizacao', label: 'Monitorização', icon: Activity, desc: 'Saúde e logs das funções automáticas' },
  { key: 'reconciliacao', label: 'Reconciliação', icon: Wrench, desc: 'Detetar e corrigir drift entre tabelas' },
  { key: 'previews', label: 'Previews', icon: CalendarClock, desc: 'Pré-visualizar próximas execuções' },
  { key: 'automacoes', label: 'Automações', icon: Zap, desc: 'Configurar crons e regras' },
  { key: 'backups', label: 'Backups', icon: Database, desc: 'Snapshots e restauros' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AdminPage() {
  const { isOwner, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>('monitorizacao');

  if (loading) return null;
  if (!isOwner) return <Navigate to="/secretaria" replace />;

  return (
    <AppLayout>
      <div className="space-y-6 py-2">
        <PageHeader
          title="Administração"
          subtitle="Painel operacional: monitorização, reconciliação, automações e backups."
        />

        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Diagnóstico E2E</p>
                <p className="text-xs text-muted-foreground">Testes de integridade da base de dados</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin/diagnostics">Abrir <ChevronRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3.5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
                  tab === t.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background border border-secondary text-secondary-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground -mt-3">
          {TABS.find(t => t.key === tab)?.desc}
        </p>

        <div className="w-full space-y-10">
          {tab === 'monitorizacao' && <SettingsEdgeMonitoring />}
          {tab === 'reconciliacao' && <SettingsReconciliation />}
          {tab === 'previews' && (
            <>
              <RecurringPhasesPreview />
              <SupplierExtensionSuggestions />
            </>
          )}
          {tab === 'automacoes' && <SettingsAutomations />}
          {tab === 'backups' && <SettingsBackups />}
        </div>
      </div>
    </AppLayout>
  );
}