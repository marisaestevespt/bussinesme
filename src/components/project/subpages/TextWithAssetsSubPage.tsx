import { LucideIcon, MessageSquare, Paperclip, Target } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Input } from '@/components/ui/input';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  pageKey: string;
  title: string;
  description?: string;
  icon: LucideIcon | React.ElementType;
  // Optional short single-line field rendered above the main textarea (e.g. project goal)
  shortLabel?: string;
  shortPlaceholder?: string;
  shortValue?: string;
  onShortChange?: (v: string) => void;
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
  shortLabel,
  shortPlaceholder,
  shortValue,
  onShortChange,
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
      {shortLabel && onShortChange && (
        <EntitySection title={shortLabel} icon={Target}>
          <Input
            value={shortValue || ''}
            onChange={e => onShortChange(e.target.value)}
            placeholder={shortPlaceholder}
          />
        </EntitySection>
      )}
      <EntitySection title={textLabel} icon={MessageSquare}>
        <RichTextEditor
          content={value}
          onChange={onChange}
          placeholder={textPlaceholder}
          enableMentions
          minHeight={240}
        />
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