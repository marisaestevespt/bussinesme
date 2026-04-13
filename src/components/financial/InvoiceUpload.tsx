import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DocEntry = { name: string; url: string };

interface Props {
  documents: DocEntry[];
  onChange: (docs: DocEntry[]) => void;
  label?: string;
}

export function InvoiceUpload({ documents, onChange, label = 'Fatura / Documento' }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('financial-files').upload(path, file);
    if (error) {
      toast.error('Erro ao carregar ficheiro');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
    onChange([...documents, { name: file.name, url: urlData.publicUrl }]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (idx: number) => onChange(documents.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-2 flex-wrap">
        {documents.map((doc, i) => (
          <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[200px]">{doc.name}</span>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
              <ExternalLink className="h-3 w-3" />
            </a>
            <button type="button" onClick={() => remove(i)} className="text-destructive hover:text-destructive/80 shrink-0">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? 'A carregar...' : 'Carregar'}
        </Button>
      </div>
    </div>
  );
}
