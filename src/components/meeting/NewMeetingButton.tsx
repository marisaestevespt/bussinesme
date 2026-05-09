import { useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus } from 'lucide-react';
import { MeetingFormDialog, useProfiles, useProjects, useClientsList } from '@/pages/Reunioes';
import { MEETING_TEMPLATES, type MeetingTemplateType } from './MEETING_TEMPLATES';

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
  /** Force-skip the template picker (use defaults). Useful when context already implies type. */
  skipPicker?: boolean;
  /** Initial type when skipPicker = true */
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
  skipPicker, forcedType,
  onMeetingCreated, navigateAfterCreate,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickedType, setPickedType] = useState<MeetingTemplateType | undefined>(forcedType);

  const { data: profiles = [] } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClientsList();

  const handlePick = (type: MeetingTemplateType) => {
    setPickedType(type);
    setPopoverOpen(false);
    setDialogOpen(true);
  };

  const triggerClick = () => {
    if (skipPicker) {
      setPickedType(forcedType);
      setDialogOpen(true);
    } else {
      setPopoverOpen(o => !o);
    }
  };

  const trigger = children ? (
    // Wrap custom children so we own the click handler when there is no Popover
    <span onClick={skipPicker ? triggerClick : undefined} className="contents">
      {children}
    </span>
  ) : (
    <Button size={size} variant={variant} className={className} onClick={triggerClick}>
      <Plus className="h-4 w-4 mr-1.5" /> {label}
    </Button>
  );

  return (
    <>
      {skipPicker ? (
        trigger
      ) : (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-1.5">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">Escolher template</p>
            </div>
            <div className="space-y-0.5">
              {MEETING_TEMPLATES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => handlePick(t.value)}
                    className="w-full flex items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

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
        initialMeetingType={pickedType as any}
        onMeetingCreated={onMeetingCreated}
        navigateAfterCreate={navigateAfterCreate}
      />
    </>
  );
}
