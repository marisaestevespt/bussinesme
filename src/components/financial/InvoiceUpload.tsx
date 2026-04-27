import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type DocEntry = { name: string; url: string };

interface Props {
  documents: DocEntry[];
  onChange: (docs: DocEntry[]) => void;
  label?: string;
  /** Optional suggested base name (without extension) e.g. "042026_C2026-01" */
  suggestedName?: string;
}

export function InvoiceUpload({ documents, onChange, label = 'Fatura / Documento', suggestedName }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingExt, setPendingExt] = useState('');

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    setPendingExt(ext);
    // Suggest a base name; ensure uniqueness if multiple uploads
    let base = (suggestedName || file.name.replace(/\.[^.]+$/, '')).trim();
    if (suggestedName) {
      const sameBase = documents.filter(d => d.name.startsWith(suggestedName)).length;
      if (sameBase > 0) base = `${suggestedName}_${sameBase + 1}`;
    }
    setEditName(base);
    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    const safeBase = (editName || 'ficheiro').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const finalName = `${safeBase}.${pendingExt}`;
    const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}-${finalName}`;
    const { error } = await supabase.storage.from('financial-files').upload(path, pendingFile);
    if (error) {
      toast.error('Erro ao carregar ficheiro');
      setUploading(false);
      setPendingFile(null);
      return;
    }
    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
    onChange([...documents, { name: finalName, url: urlData.publicUrl }]);
    setUploading(false);
    setPendingFile(null);
    setEditName('');
    setPendingExt('');
  };

  const remove = (idx: number) => onChange(documents.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
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
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileSelected} />
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? 'A carregar...' : 'Carregar'}
        </Button>
      </div>

      <Dialog open={!!pendingFile} onOpenChange={(o) => { if (!o) { setPendingFile(null); setEditName(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome do ficheiro</DialogTitle>
            <DialogDescription>
              Confirma ou edita o nome antes de carregar. Formato sugerido: <code>MMYYYY_IDCliente</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="042026_C2026-01"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">.{pendingExt}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingFile(null); setEditName(''); }}>Cancelar</Button>
            <Button onClick={confirmUpload} disabled={uploading || !editName.trim()}>
              {uploading ? 'A carregar...' : 'Carregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
