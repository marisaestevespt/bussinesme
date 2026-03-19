import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { SettingsIdentity } from '@/components/settings/SettingsIdentity';
import { ChannelSettings } from '@/components/settings/ChannelSettings';
import { SettingsUsers } from '@/components/settings/SettingsUsers';

const TABS = [
  { key: 'identidade', label: 'Identidade' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'utilizadores', label: 'Utilizadores' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function DefinicoesPage() {
  const [tab, setTab] = useState<TabKey>('identidade');

  return (
    <AppLayout>
      <div className="space-y-6 py-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Definições</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere a identidade visual e configurações do teu negócio.
          </p>
        </div>

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
        <div className="max-w-2xl">
          {tab === 'identidade' && <SettingsIdentity />}
          {tab === 'marketing' && <ChannelSettings />}
          {tab === 'utilizadores' && <SettingsUsers />}
        </div>
      </div>
    </AppLayout>
  );
}
