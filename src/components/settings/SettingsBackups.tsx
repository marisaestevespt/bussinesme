import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Download, Play, Shield, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { EmptyHint } from '@/components/ui/loading-skeletons';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsBackups() {
  const [running, setRunning] = useState(false);
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleManualBackup = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/run-backup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao executar backup');

      toast.success(`Backup concluído — ${result.tables_count} tabelas exportadas`);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar backup');
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .createSignedUrl(filePath, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Erro ao gerar link de download');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Concluído</Badge>;
      case 'running':
        return <Badge variant="secondary">A executar...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Info card */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Backups Automáticos</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          O sistema executa um backup automático semanal de todos os dados (configuração e dados operacionais).
          Os backups são guardados em formato JSON e podem ser descarregados a qualquer momento.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Frequência: Semanal (domingos às 03:00 UTC)</span>
        </div>
      </Card>

      {/* Manual backup */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Histórico de Backups</h3>
        <Button size="sm" onClick={handleManualBackup} disabled={running}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {running ? 'A executar...' : 'Executar agora'}
        </Button>
      </div>

      {/* Backup history */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : backups.length === 0 ? (
        <EmptyHint>Nenhum backup registado ainda.</EmptyHint>
      ) : (
        <div className="space-y-2">
          {backups.map((b: any) => (
            <Card key={b.id} className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {statusBadge(b.status)}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {format(new Date(b.started_at), "d 'de' MMMM yyyy, HH:mm", { locale: pt })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.trigger_type === 'manual' ? 'Manual' : 'Automático'}
                    {b.tables_count ? ` · ${b.tables_count} tabelas` : ''}
                    {b.file_size_bytes ? ` · ${formatBytes(b.file_size_bytes)}` : ''}
                  </p>
                </div>
              </div>
              {b.status === 'completed' && (
                <Button variant="ghost" aria-label="Transferir" size="icon" onClick={() => handleDownload(b.file_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Reset section */}
      <ResetSection />
    </div>
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
      <div className="border-t pt-10 mt-10">
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
              className="rounded-lg border border-destructive/20 bg-background p-4 text-left space-y-1 hover:border-destructive/50 transition-colors"
            >
              <p className="text-sm font-medium">Reset de dados</p>
              <p className="text-xs text-muted-foreground">
                Apaga dados operacionais (clientes, vendas, tarefas, etc.) mas mantém identidade visual, processos e configuração.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setResetType('full'); setOpen(true); }}
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-left space-y-1 hover:border-destructive/70 transition-colors"
            >
              <p className="text-sm font-medium text-destructive">Reset completo (template)</p>
              <p className="text-xs text-muted-foreground">
                Apaga dados + identidade da marca, equipa e papéis. Mantém o esqueleto (campos personalizados, SOPs, automações, categorias, departamentos, processos) para ajudar o próximo dono a preencher. Ideal para preparar uma instância para um novo cliente.
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
