import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Play, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
        return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
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
        <p className="text-sm text-muted-foreground">Nenhum backup registado ainda.</p>
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
                <Button variant="ghost" size="icon" onClick={() => handleDownload(b.file_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
