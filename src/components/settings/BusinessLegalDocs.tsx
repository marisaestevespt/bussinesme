import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Trash2, Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BusinessLegalDocs() {
  const { isOwner, user } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['business-legal-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_legal_documents' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!label.trim()) {
      toast.error('Indica primeiro a descrição do documento.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('business-legal-docs')
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from('business_legal_documents' as any)
        .insert({
          label: label.trim(),
          file_name: file.name,
          file_path: path,
          file_size_bytes: file.size,
          uploaded_by: user?.id,
        });
      if (insErr) throw insErr;

      toast.success('Documento adicionado');
      setLabel('');
      qc.invalidateQueries({ queryKey: ['business-legal-documents'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar documento');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('business-legal-docs')
        .createSignedUrl(filePath, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Erro ao gerar link');
    }
  };

  const remove = useMutation({
    mutationFn: async (doc: any) => {
      await requireConfirm();
      await supabase.storage.from('business-legal-docs').remove([doc.file_path]);
      const { error } = await supabase
        .from('business_legal_documents' as any)
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Documento removido');
      qc.invalidateQueries({ queryKey: ['business-legal-documents'] });
    },
    onError: () => toast.error('Erro ao remover'),
  });

  return (
    <div className="space-y-3 pt-4 mt-4 border-t">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Documentos legais</Label>
          <p className="text-xs text-muted-foreground">
            Declaração de início de atividade, certidão permanente, pacto social, etc.
          </p>
        </div>
        {!isOwner && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> só leitura
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center border border-dashed rounded-md">
          Nenhum documento carregado.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {doc.file_name}
                  {doc.file_size_bytes ? ` · ${formatBytes(doc.file_size_bytes)}` : ''}
                  {' · '}
                  {format(new Date(doc.created_at), "d MMM yyyy", { locale: pt })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Transferir"
                onClick={() => handleDownload(doc.file_path)}
              >
                <Download className="h-4 w-4" />
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  aria-label="Eliminar"
                  onClick={() => {
                    if (confirm(`Remover "${doc.label}"?`)) remove.mutate(doc);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Descrição do documento</Label>
            <Input
              placeholder="Ex: Declaração de início de atividade"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="h-9 text-sm"
              disabled={uploading}
            />
          </div>
          <label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploading ? 'A carregar...' : 'Carregar'}
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
