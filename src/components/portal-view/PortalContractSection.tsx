import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Props {
  contractDocs: any[];
  pc: string;
  pcAlpha: (a: number) => string;
}

export function PortalContractSection({ contractDocs, pc, pcAlpha }: Props) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileText}>Contrato</SectionTitle>
      {contractDocs.length === 0 ? (
        <SectionCard className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <EmptyHint>Sem documentos de contrato disponíveis.</EmptyHint>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {contractDocs.map((proj: any, pi: number) => {
            const docs = Array.isArray(proj.contract_documents) ? proj.contract_documents : [];
            return docs.map((doc: any, di: number) => (
              <SectionCard key={`${pi}-${di}`} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: pcAlpha(0.08) }}>
                      <FileText className="h-5 w-5" style={{ color: pc }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name || 'Contrato'}</p>
                      {proj.project_name && <p className="text-xs text-muted-foreground mt-0.5">{proj.project_name}</p>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg shrink-0" asChild>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name || true}>
                      <Download className="h-3.5 w-3.5 mr-1" />Descarregar
                    </a>
                  </Button>
                </div>
              </SectionCard>
            ));
          })}
        </div>
      )}
    </div>
  );
}