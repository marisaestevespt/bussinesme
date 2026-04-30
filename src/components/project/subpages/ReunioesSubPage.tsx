import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Users, Paperclip } from 'lucide-react';
import { getInitials } from '@/pages/Projetos';
import type { Meeting, Profile } from '@/hooks/useProjectDetailData';
import { getMeetingStatusInfo as canonGetMeetingStatusInfo } from '@/lib/meetingStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';

const getMeetingStatusInfo = (s: string) => {
  const info = canonGetMeetingStatusInfo(s);
  return { value: info.value, label: info.label, color: info.dotColor };
};

interface Props {
  projectId: string;
  meetings: Meeting[];
  projectMembers: string[];
  profileMap: Map<string, Profile & { avatar_url: string | null }>;
  getPhotoUrl: (p: Profile) => string | undefined;
  onBack: () => void;
  onNewMeeting: () => void;
}

const getMeetingStatusInfo = (s: string) => {
  const info = canonGetMeetingStatusInfo(s);
  return { value: info.value, label: info.label, color: info.dotColor };
};

export function ReunioesSubPage({ projectId, meetings, projectMembers, profileMap, getPhotoUrl, onBack, onNewMeeting }: Props) {
  const navigate = useNavigate();
  return (
    <SubPageShell
      title="Reuniões do Projeto"
      description={`${meetings.length} reuni${meetings.length === 1 ? 'ão' : 'ões'} ligadas a este projeto.`}
      icon={Users}
      onBack={onBack}
    >
      <EntitySection
        title="Lista de reuniões"
        icon={Users}
        action={<Button size="sm" onClick={onNewMeeting} className="gap-2"><Plus className="h-3.5 w-3.5" /> Nova Reunião</Button>}
      >
        {meetings.length === 0 ? (
          <EmptyHint>Nenhuma reunião ligada a este projeto.</EmptyHint>
        ) : (
          <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/40 text-xs font-medium text-foreground">
              <div className="col-span-2">Status</div>
              <div className="col-span-4">Reunião</div>
              <div className="col-span-3">Data / Hora</div>
              <div className="col-span-3">Participantes</div>
            </div>
            {meetings.map(m => {
              const ms = getMeetingStatusInfo(m.status);
              return (
                <button key={m.id} onClick={() => navigate(`/hub/reunioes/${m.id}`)} className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm">
                  <div className="col-span-2">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${ms.color}20`, color: ms.color }}>{ms.label}</span>
                  </div>
                  <div className="col-span-4 font-medium text-foreground truncate">{m.title}</div>
                  <div className="col-span-3 text-muted-foreground">{format(new Date(m.date_time), "dd MMM yyyy 'às' HH:mm", { locale: pt })}</div>
                  <div className="col-span-3">
                    <div className="flex -space-x-1">{projectMembers.slice(0, 5).map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}{projectMembers.length > 5 && <span className="text-xs text-muted-foreground ml-2">+{projectMembers.length - 5}</span>}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </EntitySection>

      <EntitySection title="Documentos das reuniões" icon={Paperclip} description="Atas em PDF, decks de apresentação, gravações partilhadas">
        <ProjectAssetGallery projectId={projectId} pageKey="reunioes" categories={['Ata', 'Apresentação', 'Gravação']} emptyTitle="Sem documentos" emptyDescription="Arrasta atas, decks ou anexa links de gravações." />
      </EntitySection>
    </SubPageShell>
  );
}