import { FileText, MessageSquare } from 'lucide-react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  entregaveisText: string;
  onTextChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  onBack: () => void;
}

export function EntregaveisSubPage({ projectId, entregaveisText, onTextChange, onSave, saving, dirty, onBack }: Props) {
  return (
    <SubPageShell
      title="Entregáveis"
      description="Documentos e entregas finais do projeto, organizados por categoria."
      icon={FileText}
      onBack={onBack}
      onSave={onSave}
      saving={saving}
      dirty={dirty}
    >
      <EntitySection title="Galeria de entregáveis" icon={FileText} description="Carrega ficheiros finais ou referencia entregas em ferramentas externas">
        <ProjectAssetGallery
          projectId={projectId}
          pageKey="entregaveis"
          categories={['Final', 'Versão', 'Aprovação', 'Apresentação']}
          emptyTitle="Sem entregáveis"
          emptyDescription="Arrasta ficheiros ou adiciona links (Drive, Figma, Notion...)."
        />
      </EntitySection>

      <EntitySection title="Notas dos entregáveis" icon={MessageSquare} description="Contexto, comentários, observações de entrega" compact>
        <MentionTextarea value={entregaveisText} onChange={onTextChange} rows={5} placeholder="Notas adicionais sobre os entregáveis..." />
      </EntitySection>
    </SubPageShell>
  );
}