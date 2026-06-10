import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Trash2, CornerDownRight, Check, Send, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MentionTextarea, RichText } from '@/components/MentionTextarea';
import { notifyMentions } from '@/hooks/useNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

type Comment = {
  id: string;
  content_item_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

export function ContentComments({ contentItemId, contextLabel }: { contentItemId: string; contextLabel?: string }) {
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const { data: comments = [] } = useQuery({
    queryKey: ['content-item-comments', contentItemId],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_item_comments' as any)
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: true });
      return (data || []) as unknown as Comment[];
    },
    enabled: !!contentItemId,
  });

  const authorIds = Array.from(new Set(comments.map(c => c.author_id)));
  const { data: profilesMap = {} } = useQuery({
    queryKey: ['comment-profiles', authorIds.join(',')],
    queryFn: async () => {
      if (authorIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, avatar_url')
        .in('user_id', authorIds);
      const map: Record<string, Profile> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const submit = async (body: string, parent_id: string | null = null) => {
    if (!body.trim() || !user) return;
    const { error } = await supabase
      .from('content_item_comments' as any)
      .insert({ content_item_id: contentItemId, author_id: user.id, body: body.trim(), parent_id });
    if (error) { console.error('comment insert error', error); toast.error('Erro ao publicar comentário'); return; }
    // Notifica utilizadores mencionados
    notifyMentions(
      body,
      user.id,
      contextLabel || 'Comentário no conteúdo',
      `/hub/marketing/conteudos/${contentItemId}`,
    ).catch(() => {});
    if (parent_id) { setReplyDraft(''); } else setDraft('');
    qc.invalidateQueries({ queryKey: ['content-item-comments', contentItemId] });
  };

  const removeComment = async (id: string) => {
    if (!(await confirmDestructive())) return;
    const { error } = await supabase.from('content_item_comments' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao apagar'); return; }
    qc.invalidateQueries({ queryKey: ['content-item-comments', contentItemId] });
  };

  const toggleResolved = async (c: Comment) => {
    const { error } = await supabase
      .from('content_item_comments' as any)
      .update({
        resolved_at: c.resolved_at ? null : new Date().toISOString(),
        resolved_by: c.resolved_at ? null : user?.id,
      })
      .eq('id', c.id);
    if (error) { toast.error('Erro'); return; }
    qc.invalidateQueries({ queryKey: ['content-item-comments', contentItemId] });
  };

  const top = comments.filter(c => !c.parent_id);
  const replies = (id: string) => comments.filter(c => c.parent_id === id);
  const visible = top.filter(c => showResolved || !c.resolved_at);
  const resolvedCount = top.filter(c => c.resolved_at).length;
  const openThread = openThreadId ? top.find(c => c.id === openThreadId) || null : null;

  const initials = (name: string | null | undefined) =>
    (name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const renderOne = (c: Comment, isReply = false, inDialog = false) => {
    const author = profilesMap[c.author_id];
    const canDelete = c.author_id === user?.id || isOwner;
    return (
      <div key={c.id} className={cn('flex gap-3 group', isReply && 'ml-8 mt-3', c.resolved_at && 'opacity-60')}>
        <Avatar className="h-7 w-7 shrink-0">
          {author?.avatar_url && <AvatarImage src={author.avatar_url} />}
          <AvatarFallback className="text-[10px]">{initials(author?.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{author?.full_name || 'Sem nome'}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: pt })}
            </span>
            {c.resolved_at && <span className="text-xs text-success">· resolvido</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words mt-0.5">
            <RichText text={c.body} />
          </p>
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isReply && !inDialog && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setOpenThreadId(c.id); setReplyDraft(''); }}>
                <CornerDownRight className="h-3 w-3 mr-1" />Responder
              </Button>
            )}
            {!isReply && !inDialog && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setOpenThreadId(c.id)}>
                <Maximize2 className="h-3 w-3 mr-1" />Abrir
              </Button>
            )}
            {!isReply && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => toggleResolved(c)}>
                <Check className="h-3 w-3 mr-1" />{c.resolved_at ? 'Reabrir' : 'Resolver'}
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeComment(c.id)} aria-label="Apagar">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>

          {!isReply && !inDialog && replies(c.id).slice(0, 2).map(r => renderOne(r, true))}
          {!isReply && !inDialog && replies(c.id).length > 2 && (
            <button
              className="ml-8 mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpenThreadId(c.id)}
            >
              Ver mais {replies(c.id).length - 2} respostas →
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition w-full"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <MessageSquare className="h-4 w-4" />
        <span>Comentários</span>
        {top.length > 0 && <span className="text-xs text-muted-foreground/70">· {top.length}</span>}
      </button>

      {!collapsed && (
        <>
          {resolvedCount > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowResolved(s => !s)}>
                {showResolved ? 'Ocultar resolvidos' : `Mostrar resolvidos (${resolvedCount})`}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              placeholder="Adicionar comentário... (@ para mencionar)"
              rows={draft.trim() ? 3 : 1}
            />
            {draft.trim() && (
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft('')}>Cancelar</Button>
                <Button onClick={() => submit(draft)} size="sm">
                  <Send className="h-3.5 w-3.5 mr-1" />Publicar
                </Button>
              </div>
            )}
          </div>

          {visible.length > 0 && (
            <div className="space-y-4">{visible.map(c => renderOne(c))}</div>
          )}
        </>
      )}
    </div>

    {/* Dialog de thread */}
    <Dialog open={!!openThread} onOpenChange={(o) => { if (!o) { setOpenThreadId(null); setReplyDraft(''); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversa
          </DialogTitle>
        </DialogHeader>
        {openThread && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {renderOne(openThread, false, true)}
            <div className="ml-10 space-y-3">
              {replies(openThread.id).map(r => renderOne(r, true, true))}
            </div>
          </div>
        )}
        {openThread && (
          <div className="border-t pt-3 space-y-2">
            <MentionTextarea
              value={replyDraft}
              onChange={setReplyDraft}
              placeholder="Escreve uma resposta... (@ para mencionar)"
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => submit(replyDraft, openThread.id)}
                disabled={!replyDraft.trim()}
              >
                <Send className="h-3.5 w-3.5 mr-1" />Responder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}