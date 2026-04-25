import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, ExternalLink, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export type FinDocItem = { name: string; url: string; label?: string; uploaded_at?: string };

interface Props {
  title?: string;
  documents: FinDocItem[];
  onUpdate: (docs: FinDocItem[]) => void;
  saving?: boolean;
}

export function FinDocumentsUpload({ title = 'Documentos & Declarações', documents, onUpdate, saving }: Props) {
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `declarations/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('financial-files').upload(path, file);
    if (error) {
      toast.error('Erro ao carregar ficheiro');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
    const newDoc: FinDocItem = {
      name: file.name,
      url: urlData.publicUrl,
      label: label.trim() || file.name,
      uploaded_at: new Date().toISOString(),
    };
    onUpdate([...documents, newDoc]);
    setLabel('');
    setUploading(false);
    e.target.value = '';
    toast.success('Documento adicionado');
  };

  const remove = (idx: number) => {
    onUpdate(documents.filter((_, i) => i !== idx));
    toast.success('Documento removido');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.label || doc.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{doc.name}</p>
                </div>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => remove(i)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {documents.length === 0 && (
          <EmptyHint>Sem documentos carregados</EmptyHint>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Descrição do documento</Label>
            <Input
              placeholder="Ex: Declaração Trimestral T1"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploading ? 'A carregar...' : 'Carregar'}
              </span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
