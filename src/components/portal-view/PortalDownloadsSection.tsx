import { Button } from '@/components/ui/button';
import { FolderOpen, Download, FileText, CalendarDays, MessageSquare } from 'lucide-react';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

type DocItem = {
  name: string;
  url: string;
  source: 'contrato' | 'reuniao' | 'entrega';
  source_label: string;
  date?: string | null;
};

interface Props {
  contractDocs: any[];
  meetings: any[];
  phases?: any[];
  pc: string;
  pcAlpha: (a: number) => string;
  portalToken: string;
}

const sourceIcon: Record<DocItem['source'], typeof FileText> = {
  contrato: FileText,
  reuniao: CalendarDays,
  entrega: MessageSquare,
};

export function PortalDownloadsSection({ contractDocs, meetings, phases, pc, pcAlpha, portalToken }: Props) {
  const items: DocItem[] = [];

  // Contracts
  for (const proj of contractDocs || []) {
    const docs = Array.isArray(proj.contract_documents) ? proj.contract_documents : [];
    for (const d of docs) {
      if (!d?.url) continue;
      items.push({
        name: d.name || 'Contrato',
        url: d.url,
        source: 'contrato',
        source_label: proj.project_name ? `Contrato · ${proj.project_name}` : 'Contrato',
        date: d.uploaded_at || null,
      });
    }
  }

  // Meeting documents
  for (const m of meetings || []) {
    const docs = Array.isArray(m.documents) ? m.documents : [];
    for (const d of docs) {
      if (!d?.url) continue;
      items.push({
        name: d.name || 'Documento',
        url: d.url,
        source: 'reuniao',
        source_label: `Reunião · ${m.title || 'Sem título'}`,
        date: m.date_time || null,
      });
    }
  }

  // Phase deliverable attachments
  for (const p of phases || []) {
    for (const d of p.deliverables || []) {
      const atts = Array.isArray(d.attachments) ? d.attachments : [];
      for (const a of atts) {
        if (!a?.url) continue;
        items.push({
          name: a.name || d.name || 'Ficheiro',
          url: a.url,
          source: 'entrega',
          source_label: `Entrega · ${d.name || 'Sem nome'}`,
          date: a.uploaded_at || null,
        });
      }
    }
  }

  items.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const handleDownload = (item: DocItem) => {
    // fire-and-forget audit log
    supabase.rpc('portal_log_download', {
      _token: portalToken,
      _file_name: item.name,
      _source: item.source,
    }).then(() => {});
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={FolderOpen}>Documentos</SectionTitle>
      {items.length === 0 ? (
        <SectionCard className="p-8 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <EmptyHint>Sem documentos disponíveis para download.</EmptyHint>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const Icon = sourceIcon[item.source];
            return (
              <SectionCard key={idx} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: pcAlpha(0.08) }}>
                      <Icon className="h-5 w-5" style={{ color: pc }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.source_label}
                        {item.date && ` · ${format(parseISO(item.date), "d MMM yyyy", { locale: pt })}`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg shrink-0" asChild onClick={() => handleDownload(item)}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" download={item.name || true}>
                      <Download className="h-3.5 w-3.5 mr-1" />Descarregar
                    </a>
                  </Button>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}