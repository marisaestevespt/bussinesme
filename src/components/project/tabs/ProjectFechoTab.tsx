import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EntitySection } from '@/components/layout/entity';
import { MentionTextarea } from '@/components/MentionTextarea';
import { ClientPortalFeedbackSection } from '@/components/client/ClientPortalFeedbackSection';
import { ChevronDown, Flag, MessageCircle } from 'lucide-react';
import type { ProjectFull } from '@/hooks/useProjectDetailData';

interface Props {
  local: ProjectFull;
  resolvedClientId: string | null | undefined;
  updateField: (field: keyof ProjectFull, value: unknown) => void;
}

export function ProjectFechoTab({ local, resolvedClientId, updateField }: Props) {
  const fields = [
    { field: 'closure_good' as keyof ProjectFull, label: '✅ O que funcionou bem' },
    { field: 'closure_bad' as keyof ProjectFull, label: '❌ O que não voltaria a fazer' },
    { field: 'closure_lessons' as keyof ProjectFull, label: '💡 Lições finais' },
  ];
  return (
    <>
      <EntitySection title="Retrospetiva" icon={Flag}>
        <div className="space-y-2">
          {fields.map(({ field, label }) => (
            <Collapsible key={field}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors">
                  <span className="text-sm font-medium">{label}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 pt-2">
                <MentionTextarea
                  value={(local[field] as string) || ''}
                  onChange={v => updateField(field, v)}
                  rows={4}
                  placeholder="Escreve aqui..."
                />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </EntitySection>

      {resolvedClientId && local.client_name && (
        <EntitySection title="Feedback Recebido do Cliente" icon={MessageCircle}>
          <ClientPortalFeedbackSection clientId={resolvedClientId} />
        </EntitySection>
      )}
    </>
  );
}