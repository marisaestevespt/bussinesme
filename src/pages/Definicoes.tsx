import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

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
}

function ResetSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [resetType, setResetType] = useState<'data' | 'full'>('data');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/reset-instance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ confirmation: 'CONFIRMO', reset_type: resetType }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao resetar');

      if (resetType === 'full') {
        toast.success('Reset completo efetuado. O sistema está limpo como template base.');
        await supabase.auth.signOut();
        navigate('/');
      } else {
        toast.success('O sistema foi resetado com sucesso. Podes começar a introduzir os dados do teu negócio.');
        navigate('/secretaria');
      }
      setOpen(false);
      setConfirmation('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resetar o sistema.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl border-t pt-10 mt-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Resetar instância</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Escolhe o tipo de reset que pretendes fazer. Esta acção é irreversível.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setResetType('data'); setOpen(true); }}
              className="rounded-lg border border-destructive/20 bg-background p-4 text-left space-y-1 hover:border-destructive/50 hq-transition"
            >
              <p className="text-sm font-medium">Reset de dados</p>
              <p className="text-xs text-muted-foreground">
                Apaga dados operacionais (clientes, vendas, tarefas, etc.) mas mantém identidade visual, processos e configuração.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setResetType('full'); setOpen(true); }}
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-left space-y-1 hover:border-destructive/70 hq-transition"
            >
              <p className="text-sm font-medium text-destructive">Reset completo (template)</p>
              <p className="text-xs text-muted-foreground">
                Apaga tudo — dados, identidade visual, marca, processos, SOPs, equipa e configuração. Ideal para preparar template base.
              </p>
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={(v) => { if (!loading) { setOpen(v); setConfirmation(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {resetType === 'full' ? 'Reset completo — tens a certeza?' : 'Reset de dados — tens a certeza?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {resetType === 'full' ? (
                <>
                  Esta acção vai apagar <strong>absolutamente tudo</strong> — dados operacionais, identidade visual, marca, processos, SOPs, equipa e toda a configuração.
                  O sistema ficará como um template limpo. Serás desautenticado após o reset.
                  <br /><strong>Esta acção não pode ser desfeita.</strong>
                </>
              ) : (
                <>
                  Esta acção vai apagar todos os dados operacionais do sistema de forma permanente.
                  Toda a configuração, processos, automações e identidade visual serão mantidos.
                  Esta acção não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">
              Escreve <span className="font-bold text-destructive">CONFIRMO</span> para continuar
            </label>
            <Input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder="CONFIRMO"
              className="font-mono"
              disabled={loading}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmation !== 'CONFIRMO' || loading}
              onClick={handleReset}
            >
              {loading ? 'A apagar...' : resetType === 'full' ? 'Apagar tudo (template limpo)' : 'Apagar dados operacionais'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
