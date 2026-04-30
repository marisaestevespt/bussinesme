import { StickyNote, Paperclip } from 'lucide-react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function OutrasInfoSubPage({ projectId, value, onChange, onBack, onSave, saving, dirty }: Props) {
  return (
    <SubPageShell
      title="Outras Informações"
      description="Notas livres, contexto adicional e ficheiros soltos do projeto."
      icon={StickyNote}
      onBack={onBack}
      onSave={onSave}
      saving={saving}
      dirty={dirty}
    >
      <EntitySection title="Notas" icon={StickyNote} description="Texto livre — usa @ para mencionar membros">
        <MentionTextarea value={value} onChange={onChange} rows={12} placeholder="Informações adicionais sobre o projeto..." />
      </EntitySection>

      <EntitySection title="Anexos" icon={Paperclip} description="Documentos avulsos que não pertencem a outra secção">
        <ProjectAssetGallery projectId={projectId} pageKey="outras_info" emptyTitle="Sem anexos" emptyDescription="Arrasta ficheiros ou adiciona links externos." />
      </EntitySection>
    </SubPageShell>
  );
}