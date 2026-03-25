import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface WhatsAppGroupLinkProps {
  url: string;
  onSave: (url: string) => Promise<void>;
  label?: string;
  compact?: boolean;
}

export function WhatsAppGroupLink({ url, onSave, label = 'Grupo de WhatsApp', compact = false }: WhatsAppGroupLinkProps) {
  const { isOwner } = useAuth();
  const { canAccess } = usePermissions();
  const isAdmin = isOwner || canAccess('admin' as any);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(url);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="h-8 text-sm flex-1"
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave} disabled={saving}>
          <Check className="h-4 w-4 text-emerald-600" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancel}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  if (!url && !isAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1.5 ${compact ? '' : ''}`}
        >
          {label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm text-muted-foreground italic">Sem link de WhatsApp</span>
      )}
      {isAdmin && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-1" onClick={() => { setDraft(url); setEditing(true); }}>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
