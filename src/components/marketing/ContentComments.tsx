import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Trash2, CornerDownRight, Check, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmptyHint } from '@/components/ui/loading-skeletons';

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

export function ContentComments({ contentItemId }: { contentItemId: string }) {
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);

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
        .select('id, full_name, avatar_url')
        .in('id', authorIds);
      const map: Record<string, Profile> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  const submit = async (body: string, parent_id: string | null = null) => {
    if (!body.trim() || !user) return;
    const { error } = await supabase
      .from('content_item_comments' as any)
      .insert({ content_item_id: contentItemId, author_id: user.id, body: body.trim(), parent_id });
    if (error) { toast.error('Erro ao publicar comentário'); return; }
    if (parent_id) { setReplyDraft(''); setReplyTo(null); } else setDraft('');
    qc.invalidateQueries({ queryKey: ['content-item-comments', contentItemId] });
  };

  const removeComment = async (id: string) => {
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

  const initials = (name: string | null | undefined) =>
    (name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const renderOne = (c: Comment, isReply = false) => {
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
            {c.resolved_at && <span className="text-xs text-emerald-600">· resolvido</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isReply && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setReplyTo(c.id)}>
                <CornerDownRight className="h-3 w-3 mr-1" />Responder
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

          {!isReply && replies(c.id).map(r => renderOne(r, true))}

          {!isReply && replyTo === c.id && (
            <div className="ml-8 mt-3 flex gap-2">
              <Textarea
                value={replyDraft}
                onChange={e => setReplyDraft(e.target.value)}
                placeholder="Escreve uma resposta..."
                className="min-h-[60px] text-sm"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => submit(replyDraft, c.id)} disabled={!replyDraft.trim()}>
                  <Send className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyDraft(''); }}>
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comentários{top.length > 0 && <span className="text-muted-foreground font-normal">· {top.length}</span>}
        </h3>
        {resolvedCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowResolved(s => !s)}>
            {showResolved ? 'Ocultar resolvidos' : `Mostrar resolvidos (${resolvedCount})`}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Adicionar comentário..."
          className="min-h-[60px] text-sm"
        />
        <Button onClick={() => submit(draft)} disabled={!draft.trim()} size="sm" className="self-end">
          <Send className="h-3.5 w-3.5 mr-1" />Publicar
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyHint>Sem comentários ainda.</EmptyHint>
      ) : (
        <div className="space-y-4">{visible.map(c => renderOne(c))}</div>
      )}
    </div>
  );
}