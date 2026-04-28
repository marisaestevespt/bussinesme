import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Plus } from 'lucide-react';
import { getInitials } from '@/pages/Projetos';
import type { Meeting, Profile } from '@/hooks/useProjectDetailData';
import { MEETING_STATUSES, getMeetingStatusInfo as canonGetMeetingStatusInfo } from '@/lib/meetingStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const getMeetingStatusInfo = (s: string) => {
  const info = canonGetMeetingStatusInfo(s);
  return { value: info.value, label: info.label, color: info.dotColor };
};

interface Props {
  meetings: Meeting[];
  projectMembers: string[];
  profileMap: Map<string, Profile & { avatar_url: string | null }>;
  getPhotoUrl: (p: Profile) => string | undefined;
  onBack: () => void;
  onNewMeeting: () => void;
}

export function ReunioesSubPage({ meetings, projectMembers, profileMap, getPhotoUrl, onBack, onNewMeeting }: Props) {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <h2 className="text-xl font-bold">Reuniões do Projeto</h2>
          </div>
          <Button size="sm" onClick={onNewMeeting} className="gap-2"><Plus className="h-3.5 w-3.5" /> Nova Reunião</Button>
        </div>
        {meetings.length === 0 ? (
          <EmptyHint>Nenhuma reunião ligada a este projeto.</EmptyHint>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y divide-border">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}