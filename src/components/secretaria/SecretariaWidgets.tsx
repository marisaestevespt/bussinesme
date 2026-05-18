import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Link2, ExternalLink, Plus, Trash2, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Badge } from '@/components/ui/badge';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export function DashboardPersonalWidgets({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { impersonating } = useImpersonation();
  // When impersonating, write to the impersonated member's user_id so the owner can manage links for that member.
  const effectiveUserId = impersonating?.user_id || userId;
  const isImpersonatingWithoutUser = !!impersonating && !impersonating.user_id;

  const personalNotes = useQuery({
    queryKey: ['personal-notes', effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_notes').select('*').eq('user_id', effectiveUserId!).maybeSingle();
      return data;
    },
  });

  const saveNotes = useCallback(async (content: string) => {
    if (!effectiveUserId) return;
    await supabase.from('member_personal_notes').upsert({ user_id: effectiveUserId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }, [effectiveUserId]);

  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNotesChange = (content: string) => {
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    notesTimeoutRef.current = setTimeout(() => saveNotes(content), 1000);
  };

  const personalLinks = useQuery({
    queryKey: ['personal-links', effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
      const { data } = await supabase.from('member_personal_links').select('*').eq('user_id', effectiveUserId!).order('sort_order');
      return data || [];
    },
  });

  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const addLink = async () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !effectiveUserId) return;
    await supabase.from('member_personal_links').insert({ user_id: effectiveUserId, label: newLinkLabel.trim(), url: newLinkUrl.trim(), sort_order: (personalLinks.data?.length || 0) });
    setNewLinkLabel(''); setNewLinkUrl('');
    qc.invalidateQueries({ queryKey: ['personal-links'] });
  };

  const deleteLink = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('member_personal_links').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['personal-links'] });
  };

  if (isImpersonatingWithoutUser) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Este membro ainda não tem conta ativa, por isso não tem notas nem links pessoais para gerir.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="bg-warning/15/50 dark:bg-warning/10 border-warning/30/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Notas
            {impersonating && <Badge variant="outline" className="ml-1 text-[10px] gap-1"><Eye className="h-3 w-3" /> de {impersonating.full_name}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor content={personalNotes.data?.content || ''} onChange={handleNotesChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" /> {impersonating ? `Links de ${impersonating.full_name}` : 'Os Meus Links'}
            {impersonating && <Badge variant="outline" className="ml-1 text-[10px] gap-1"><Eye className="h-3 w-3" /> Edição como Owner</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(personalLinks.data || []).map((link: any) => (
            <div key={link.id} className="flex items-center justify-between gap-2 p-2 rounded border">
              <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline truncate flex items-center gap-2">
                <ExternalLink className="h-3 w-3 shrink-0" />{link.label}
              </a>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => deleteLink(link.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Nome" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className="flex-1 h-8 text-xs" />
            <Input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-1 h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={addLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
