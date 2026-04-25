import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Link2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MemberQuickLinks } from '@/components/hr/MemberQuickLinks';
import { useMyTeamMember } from './secretaria-shared';

export function DashboardPersonalWidgets({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const teamMember = useMyTeamMember();

  const personalNotes = useQuery({
    queryKey: ['personal-notes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_notes').select('*').eq('user_id', userId!).maybeSingle();
      return data;
    },
  });

  const saveNotes = useCallback(async (content: string) => {
    if (!userId) return;
    await supabase.from('member_personal_notes').upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }, [userId]);

  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNotesChange = (content: string) => {
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(() => saveNotes(content), 1000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="bg-warning/15/50 dark:bg-warning/10 border-warning/30/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Notas</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor content={personalNotes.data?.content || ''} onChange={handleNotesChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" /> Os Meus Links</CardTitle></CardHeader>
        <CardContent>
          {teamMember.data?.id
            ? <MemberQuickLinks memberId={teamMember.data.id} compact />
            : <p className="text-xs text-muted-foreground">Sem perfil de equipa associado.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
