import { useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MeetingFormDialog, useProfiles, useProjects, useClientsList } from '@/pages/Reunioes';
import type { MeetingTemplateType } from './MEETING_TEMPLATES';

interface Props {
  /** Optional contextual defaults that pre-fill the dialog */
  defaultClientId?: string;
  defaultClientName?: string;
  defaultProjectId?: string;
  defaultProjectName?: string;
  defaultTitle?: string;
  /** Pre-select participants (profile ids). */
  defaultMemberIds?: string[];
  /** Pre-fill department. */
  defaultDepartment?: string;
  /** Pre-fill the planned duration in minutes (cascade from deliverable/routine). */
  defaultPlannedMinutes?: number | null;
  /** When true, renders nothing visible — caller controls the trigger via children */
  children?: ReactNode;
  /** Button props for the default trigger */
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  label?: string;
  className?: string;
  /** @deprecated kept for back-compat; templates are unified. */
  skipPicker?: boolean;
  /** @deprecated kept for back-compat; templates are unified. */
  forcedType?: MeetingTemplateType;
  /** Called after meeting created */
  onMeetingCreated?: (meetingId: string) => void | Promise<void>;
  navigateAfterCreate?: boolean;
}

/**
 * Notion-style "New Meeting" button: opens a popover with template cards.
 * Picking a template opens the MeetingFormDialog pre-configured with that
 * meeting_type and a default agenda.
 */
export function NewMeetingButton({
  defaultClientId, defaultClientName, defaultProjectId, defaultProjectName,
  defaultTitle, defaultMemberIds, defaultDepartment, defaultPlannedMinutes,
  children, size = 'sm', variant = 'default', label = 'Nova Reunião', className,
  onMeetingCreated, navigateAfterCreate,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: profiles = [] } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClientsList();

  const triggerClick = () => setDialogOpen(true);

  const trigger = children ? (
    <span onClick={triggerClick} className="contents">
      {children}
    </span>
  ) : (
    <Button size={size} variant={variant} className={className} onClick={triggerClick}>
      <Plus className="h-4 w-4 mr-1.5" /> {label}
    </Button>
  );

  return (
    <>
      {trigger}

      <MeetingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profiles={profiles}
        projects={projects}
        clients={clients}
        defaultClientId={defaultClientId}
        defaultClientName={defaultClientName}
        defaultProjectId={defaultProjectId}
        defaultProjectName={defaultProjectName}
        defaultTitle={defaultTitle}
        defaultMemberIds={defaultMemberIds}
        defaultDepartment={defaultDepartment}
        defaultPlannedMinutes={defaultPlannedMinutes ?? null}
        onMeetingCreated={onMeetingCreated}
        navigateAfterCreate={navigateAfterCreate}
      />
    </>
  );
}
