import { useState } from 'react';
import { ExternalLink, FileText, Link2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  d: {
    id: string;
    link_url?: string | null;
    document_url?: string | null;
    document_file_path?: string | null;
  };
  portalToken: string;
}

/**
 * Renders an inline attachment row for a portal deliverable: external link,
 * external document URL, or an internal file (fetched via signed URL through
 * the `portal-deliverable-file` edge function).
 */
export function PortalDeliverableAttachment({ d, portalToken }: Props) {
  const [loading, setLoading] = useState(false);

  const openInternalFile = async () => {
    setLoading(true);
    try {
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      const anon = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${url}/functions/v1/portal-deliverable-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ token: portalToken, deliverable_id: d.id }),
      });
      const json = await res.json();
      if (!res.ok || !json?.url) throw new Error(json?.error || 'sign_failed');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error('Não foi possível abrir o ficheiro');
    } finally {
      setLoading(false);
    }
  };

  const items: React.ReactNode[] = [];

  if (d.link_url) {
    items.push(
      <a
        key="link"
        href={d.link_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-info/10 text-info hover:bg-info/20 transition-colors"
      >
        <Link2 className="h-3 w-3" /> Abrir link <ExternalLink className="h-2.5 w-2.5 opacity-70" />
      </a>,
    );
  }
  if (d.document_url) {
    items.push(
      <a
        key="docurl"
        href={d.document_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-accent/40 text-foreground hover:bg-accent/60 transition-colors"
      >
        <FileText className="h-3 w-3" /> Abrir documento <ExternalLink className="h-2.5 w-2.5 opacity-70" />
      </a>,
    );
  }
  if (d.document_file_path) {
    items.push(
      <button
        key="file"
        type="button"
        onClick={(e) => { e.stopPropagation(); openInternalFile(); }}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        Descarregar ficheiro
      </button>,
    );
  }

  if (items.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5 mt-2">{items}</div>;
}