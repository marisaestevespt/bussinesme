import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { SettingsIdentity } from '@/components/settings/SettingsIdentity';
import { DadosFiscalLayout } from '@/components/settings/DadosFiscalLayout';
import { ChannelSettings } from '@/components/settings/ChannelSettings';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsKpis } from '@/components/settings/SettingsKpis';
import { SettingsDigest } from '@/components/settings/SettingsDigest';
import { SettingsAuditLog } from '@/components/settings/SettingsAuditLog';
import { FinAuditoriaPagamentos } from '@/components/financial/FinAuditoriaPagamentos';
import { FinAuditoriaFornecedores } from '@/components/financial/FinAuditoriaFornecedores';
import { FinAuditoriaVendas } from '@/components/financial/FinAuditoriaVendas';
import { FinAuditoriaDocumentos } from '@/components/financial/FinAuditoriaDocumentos';
import { SettingsAutomations } from '@/components/settings/SettingsAutomations';
import { SettingsBackups } from '@/components/settings/SettingsBackups';
import { SettingsEmails } from '@/components/settings/SettingsEmails';
import { SettingsEdgeMonitoring } from '@/components/settings/SettingsEdgeMonitoring';
import { SettingsInstance } from '@/components/settings/SettingsInstance';
import { useAuth } from '@/hooks/useAuth';
import { cn as _cn } from '@/lib/utils';

function AuditoriaFinanceira() {
  const [sub, setSub] = useState<'pagamentos' | 'fornecedores' | 'vendas' | 'documentos'>('pagamentos');
  const SUBS = [
    { key: 'pagamentos' as const, label: 'Pagamentos a Membros' },
    { key: 'fornecedores' as const, label: 'Fornecedores' },
    { key: 'vendas' as const, label: 'Vendas / Entradas' },
    { key: 'documentos' as const, label: 'Documentos' },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Auditoria Financeira</h2>
        <p className="text-sm text-muted-foreground">Verifica a integridade das ligações entre o financeiro e os módulos relacionados.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {SUBS.map(s => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={_cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              sub === s.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-background border border-secondary text-secondary-foreground hover:bg-muted'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'pagamentos' && <FinAuditoriaPagamentos />}
      {sub === 'fornecedores' && <FinAuditoriaFornecedores />}
      {sub === 'vendas' && <FinAuditoriaVendas />}
      {sub === 'documentos' && <FinAuditoriaDocumentos />}
    </div>
  );
}

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
          {tab === 'marketing' && <ChannelSettings />}
          {tab === 'resumo' && <SettingsDigest />}
          {tab === 'emails' && <SettingsEmails />}
          {tab === 'preferencias' && (
            <div className="space-y-10">
              <SettingsKpis />
              <SettingsAutomations />
            </div>
          )}
          {tab === 'instancia' && <SettingsInstance />}
          {tab === 'auditoria' && (
            <div className="space-y-10">
              <SettingsAuditLog />
              <AuditoriaFinanceira />
              <SettingsUsers />
            </div>
          )}
          {tab === 'sistema' && (
            <div className="space-y-10">
              <SettingsEdgeMonitoring />
              <SettingsBackups />
            </div>
          )}
        </div>

        {/* Reset section moved to SettingsBackups */}
      </div>
    </AppLayout>
  );
}

