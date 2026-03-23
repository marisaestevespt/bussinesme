import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { SettingsIdentity } from '@/components/settings/SettingsIdentity';
import { ChannelSettings } from '@/components/settings/ChannelSettings';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsKpis } from '@/components/settings/SettingsKpis';
import { SettingsDigest } from '@/components/settings/SettingsDigest';
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

const TABS = [
  { key: 'identidade', label: 'Identidade' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'utilizadores', label: 'Utilizadores' },
  { key: 'kpis', label: 'KPIs e Análise' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function DefinicoesPage() {
  const [tab, setTab] = useState<TabKey>('identidade');
  const { isOwner } = useAuth();

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
        <div className="max-w-2xl">
          {tab === 'identidade' && <SettingsIdentity />}
          {tab === 'marketing' && <ChannelSettings />}
          {tab === 'utilizadores' && <SettingsUsers />}
          {tab === 'kpis' && <SettingsKpis />}
        </div>

        {/* Reset section - owner only */}
        {isOwner && <ResetSection />}
      </div>
    </AppLayout>
  );
}

function ResetSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
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
          body: JSON.stringify({ confirmation: 'CONFIRMO' }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao resetar');

      toast.success('O sistema foi resetado com sucesso. Podes começar a introduzir os dados do teu negócio.');
      setOpen(false);
      setConfirmation('');
      navigate('/hub/secretaria');
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
            <h2 className="text-sm font-semibold text-destructive">Resetar para instância limpa</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Apaga todos os dados operacionais do sistema (clientes, vendas, tarefas, conteúdos, etc.) mantendo toda a configuração, processos, automações e identidade visual.
            Esta acção é irreversível.
          </p>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            Resetar sistema
          </Button>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={(v) => { if (!loading) { setOpen(v); setConfirmation(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Tens a certeza?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Esta acção vai apagar todos os dados operacionais do sistema de forma permanente.
              Toda a configuração, processos, automações e identidade visual serão mantidos.
              Esta acção não pode ser desfeita.
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
              {loading ? 'A apagar...' : 'Apagar todos os dados'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
