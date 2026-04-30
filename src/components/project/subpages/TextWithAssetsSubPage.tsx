import { LucideIcon, MessageSquare, Paperclip } from 'lucide-react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  pageKey: string;
  title: string;
  description?: string;
  icon: LucideIcon | React.ElementType;
  textLabel?: string;
  textPlaceholder?: string;
  assetsLabel?: string;
  assetsDescription?: string;
  assetCategories?: string[];
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function TextWithAssetsSubPage({
  projectId,
  pageKey,
  title,
  description,
  icon,
  textLabel = 'Notas',
  textPlaceholder = 'Escreve aqui... usa @ para mencionar membros',
  assetsLabel = 'Documentos e referências',
  assetsDescription,
  assetCategories,
  value,
  onChange,
  onBack,
  onSave,
  saving,
  dirty,
}: Props) {
  return (
    <SubPageShell title={title} description={description} icon={icon} onBack={onBack} onSave={onSave} saving={saving} dirty={dirty}>
      <EntitySection title={textLabel} icon={MessageSquare}>
        <MentionTextarea value={value} onChange={onChange} rows={10} placeholder={textPlaceholder} />
      </EntitySection>
      <EntitySection title={assetsLabel} icon={Paperclip} description={assetsDescription}>
        <ProjectAssetGallery
          projectId={projectId}
          pageKey={pageKey}
          categories={assetCategories}
          emptyTitle="Sem ficheiros nem links"
          emptyDescription="Carrega documentos ou adiciona links externos relacionados."
        />
      </EntitySection>
    </SubPageShell>
  );
}