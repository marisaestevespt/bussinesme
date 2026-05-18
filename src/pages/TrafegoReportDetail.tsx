import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Editable } from '@/components/ui/editable';
import { toast } from 'sonner';
import { ChevronLeft, Upload, FileText, Trash2, ExternalLink, Check } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type ReportFile = {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
};

export default function TrafegoReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: card, isLoading } = useQuery({
    queryKey: ['traffic-report-card', id],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_report_cards').select('*').eq('id', id!).maybeSingle() as any;
      return data as { id: string; title: string; content: string | null } | null;
    },
    enabled: !!id,
  });

  const { data: files = [] } = useQuery({
    queryKey: ['traffic-report-files', id],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_report_files').select('*').eq('card_id', id!).order('created_at', { ascending: false }) as any;
      return (data || []) as ReportFile[];
    },
    enabled: !!id,
  });

  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (card) setTitle(card.title || '');
  }, [card]);

  const saveTitle = async () => {
    setSaving(true);
    const { error } = await supabase.from('traffic_report_cards').update({ title } as any).eq('id', id!);
    setSaving(false);
    if (error) toast.error('Não consegui guardar a report. Tenta novamente.');
    else { toast.success('Título guardado'); qc.invalidateQueries({ queryKey: ['traffic-report-card', id] }); }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas ficheiros PDF são permitidos');
      return;
    }
    setUploading(true);
    const filePath = `${id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('traffic-reports').upload(filePath, file);
    if (uploadError) {
      toast.error('Erro ao carregar ficheiro');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('traffic-reports').getPublicUrl(filePath);
    await supabase.from('traffic_report_files').insert({
      card_id: id,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
    } as any);
    qc.invalidateQueries({ queryKey: ['traffic-report-files', id] });
    toast.success('Ficheiro carregado');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (file: ReportFile) => {
    if (!(await confirmDestructive())) return;
    const pathMatch = file.file_url.split('/traffic-reports/')[1];
    if (pathMatch) {
      await supabase.storage.from('traffic-reports').remove([decodeURIComponent(pathMatch)]);
    }
    await supabase.from('traffic_report_files').delete().eq('id', file.id) as any;
    qc.invalidateQueries({ queryKey: ['traffic-report-files', id] });
    toast.success('Ficheiro eliminado');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading || !card) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><InlineLoader /></div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Tráfego Pago</p>
          <Editable
            display={title}
            disabled={!isOwner}
            placeholder="Sem título"
            bold
            className="text-2xl md:text-3xl tracking-tight text-primary-foreground hover:bg-white/10"
            hidePencil={!isOwner}
            render={({ stop, autoFocusRef }) => (
              <Input ref={autoFocusRef as any} value={title} onBlur={stop} onChange={e => setTitle(e.target.value)}
                className="text-2xl md:kpi-display-sm mt-1 bg-transparent border-none text-center h-auto p-0 text-primary-foreground" />
            )}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing/trafego-pago" parentLabel="Tráfego Pago" />
            {isOwner && title !== card.title && (
              <Button size="sm" onClick={saveTitle} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar título'}
              </Button>
            )}
          </div>

          {/* Upload area */}
          {isOwner && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                {uploading ? 'A carregar...' : 'Clica para carregar um PDF'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Apenas ficheiros PDF</p>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={uploadFile} />
            </div>
          )}

          {/* File list */}
          {files.length === 0 ? (
            <EmptyHint>Nenhum ficheiro carregado.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors group">
                  <FileText className="h-5 w-5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.file_size)} · {format(new Date(file.created_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                    </p>
                  </div>
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-md hover:bg-muted transition-colors">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </a>
                  {isOwner && (
                    <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteFile(file)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
