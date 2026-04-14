import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { SettingsIdentity } from '@/components/settings/SettingsIdentity';
import { SettingsFiscal } from '@/components/settings/SettingsFiscal';
import { FinSetupNegocio } from '@/components/financial/FinSetupNegocio';
import { ChannelSettings } from '@/components/settings/ChannelSettings';
import { SocialTokensSettings } from '@/components/settings/SocialTokensSettings';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsKpis } from '@/components/settings/SettingsKpis';
import { SettingsDigest } from '@/components/settings/SettingsDigest';
import { SettingsAuditLog } from '@/components/settings/SettingsAuditLog';
import { SettingsAutomations } from '@/components/settings/SettingsAutomations';
import { SettingsBackups } from '@/components/settings/SettingsBackups';
import { SettingsEmails } from '@/components/settings/SettingsEmails';
import { useAuth } from '@/hooks/useAuth';

const BASE_TABS = [
  { key: 'identidade', label: 'Identidade' },
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'setup-negocio', label: 'Setup de Negócio' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'utilizadores', label: 'Utilizadores' },
  { key: 'kpis', label: 'KPIs e Análise' },
  { key: 'resumo', label: 'Resumo Diário' },
  { key: 'emails', label: 'Emails' },
] as const;

const OWNER_TABS = [
  ...BASE_TABS,
  { key: 'automacoes' as const, label: 'Automações' },
  { key: 'backups' as const, label: 'Backups' },
  { key: 'auditoria' as const, label: 'Auditoria' },
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
          {tab === 'fiscal' && <SettingsFiscal />}
          {tab === 'setup-negocio' && <FinSetupNegocio />}
          {tab === 'marketing' && <div className="space-y-8"><ChannelSettings /><SocialTokensSettings /></div>}
          {tab === 'utilizadores' && <SettingsUsers />}
          {tab === 'kpis' && <SettingsKpis />}
          {tab === 'resumo' && <SettingsDigest />}
          {tab === 'emails' && <SettingsEmails />}
          {tab === 'automacoes' && <SettingsAutomations />}
          {tab === 'backups' && <SettingsBackups />}
          {tab === 'auditoria' && <SettingsAuditLog />}
        </div>

        {/* Reset section moved to SettingsBackups */}
      </div>
    </AppLayout>
  );
