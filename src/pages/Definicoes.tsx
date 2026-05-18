import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { SettingsIdentity } from '@/components/settings/SettingsIdentity';
import { DadosFiscalLayout } from '@/components/settings/DadosFiscalLayout';
import { ChannelSettings } from '@/components/settings/ChannelSettings';
import { ContentPhaseDeadlineSettings } from '@/components/settings/ContentPhaseDeadlineSettings';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsKpis } from '@/components/settings/SettingsKpis';
import { SettingsRecolhas } from '@/components/settings/SettingsRecolhas';
import { SettingsDigest } from '@/components/settings/SettingsDigest';
import { SettingsAuditLog } from '@/components/settings/SettingsAuditLog';
import { SettingsAutomations } from '@/components/settings/SettingsAutomations';
import { SupplierExtensionSuggestions } from '@/components/settings/SupplierExtensionSuggestions';
import { SettingsBackups } from '@/components/settings/SettingsBackups';
import { SettingsEmails } from '@/components/settings/SettingsEmails';
import { SettingsEdgeMonitoring } from '@/components/settings/SettingsEdgeMonitoring';
import { SettingsReconciliation } from '@/components/settings/SettingsReconciliation';
import { RecurringPhasesPreview } from '@/components/settings/RecurringPhasesPreview';
import { SettingsInstance } from '@/components/settings/SettingsInstance';
import { useAuth } from '@/hooks/useAuth';

const BASE_TABS = [
  { key: 'identidade', label: 'Identidade' },
  { key: 'dados-fiscal', label: 'Dados & Fiscal' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'resumo', label: 'Resumo Diário' },
  { key: 'emails', label: 'Emails' },
  { key: 'preferencias', label: 'Preferências' },
] as const;

const OWNER_TABS = [
  ...BASE_TABS,
  { key: 'instancia' as const, label: 'Instância' },
  { key: 'auditoria' as const, label: 'Auditoria' },
  { key: 'sistema' as const, label: 'Sistema' },
] as const;

type TabKey = typeof OWNER_TABS[number]['key'];

export default function DefinicoesPage() {
  const [tab, setTab] = useState<TabKey>('identidade');
  const { isOwner } = useAuth();
  const TABS = isOwner ? OWNER_TABS : BASE_TABS;

  return (
    <AppLayout>
      <div className="space-y-6 py-2">
        <PageHeader title="Definições" subtitle="Gere a identidade visual e configurações do teu negócio." />

        {/* Tab navigation */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background border border-secondary text-secondary-foreground hover:bg-muted'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="w-full">
          {tab === 'identidade' && <SettingsIdentity />}
          {tab === 'dados-fiscal' && <DadosFiscalLayout />}
          {tab === 'marketing' && (
            <div className="space-y-10">
              <ChannelSettings />
              <ContentPhaseDeadlineSettings />
            </div>
          )}
          {tab === 'resumo' && <SettingsDigest />}
          {tab === 'emails' && <SettingsEmails />}
          {tab === 'preferencias' && (
            <div className="space-y-10">
              <SettingsKpis />
              <SettingsRecolhas />
              <SupplierExtensionSuggestions />
              <SettingsAutomations />
            </div>
          )}
          {tab === 'instancia' && <SettingsInstance />}
          {tab === 'auditoria' && (
            <div className="space-y-10">
              <SettingsAuditLog />
              <SettingsUsers />
            </div>
          )}
          {tab === 'sistema' && (
            <div className="space-y-10">
              <SettingsEdgeMonitoring />
              <SettingsReconciliation />
              <RecurringPhasesPreview />
              <SettingsBackups />
            </div>
          )}
        </div>

        {/* Reset section moved to SettingsBackups */}
      </div>
    </AppLayout>
  );
}

