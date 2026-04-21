import { useState, useRef } from 'react';
import { notifyMentions } from '@/hooks/useNotifications';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MentionTextarea, RichText } from '@/components/MentionTextarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MessageCircle, Paperclip, ImageIcon, ChevronDown, ChevronUp, Send, Download, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useConfirm } from '@/components/ui/confirm-dialog';

const CATEGORIES = [
  { value: 'anuncio', label: 'Anúncio', color: 'bg-destructive/15 text-destructive' },
  { value: 'novidade', label: 'Novidade', color: 'bg-success/15 text-success' },
  { value: 'atualizacao', label: 'Atualização', color: 'bg-info/15 text-info' },
  { value: 'lembrete', label: 'Lembrete', color: 'bg-warning/15 text-warning' },
  { value: 'outro', label: 'Outro', color: 'bg-gray-100 text-gray-800' },
] as const;

const REACTION_EMOJIS = ['👍', '❤️', '🎉', '🙌'] as const;

function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface MuralPost {
  id: string;
  title: string;
  body: string;
  category: string;
  images: string[];
  files: { name: string; url: string }[];
  author_id: string;
  created_at: string;
}

interface MuralComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

interface MuralReaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const MURAL_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'todas', label: 'Todas as Publicações', isDefault: true },
];

export default function MuralPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { getPhotoUrl } = useTeamPhotos();
  const { user, isOwner } = useAuth();
  const { allViews, addView, renameView, deleteView } = useUserViews('mural', MURAL_DEFAULT_VIEWS);
  const [activeView, setActiveView] = useState('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState('outro');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; url: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPost, setEditingPost] = useState<MuralPost | null>(null);

  // Check publish permission
  const { data: canPublish = false } = useQuery({
    queryKey: ['mural-can-publish', user?.id],
    queryFn: async () => {
      if (isOwner) return true;
      if (!user) return false;
      const { data: member } = await supabase
        .from('members')
        .select('custom_role_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!member) return false;
      const { data: perm } = await supabase
        .from('role_permissions')
        .select('can_view')
        .eq('custom_role_id', member.custom_role_id)
        .eq('module_key', 'mural_publish')
        .maybeSingle();
      return !!perm?.can_view;
    },
    enabled: !!user,
  });

  // Fetch all profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return (data || []) as Profile[];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  // Fetch posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['mural-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mural_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
        files: Array.isArray(p.files) ? p.files : [],
      })) as MuralPost[];
    },
  });

  // Fetch all reactions
  const { data: reactions = [] } = useQuery({
    queryKey: ['mural-reactions'],
    queryFn: async () => {
      const { data } = await supabase.from('mural_reactions').select('*');
      return (data || []) as MuralReaction[];
    },
  });

  // Fetch all comments
  const { data: comments = [] } = useQuery({
    queryKey: ['mural-comments'],
    queryFn: async () => {
      const { data } = await supabase.from('mural_comments').select('*').order('created_at', { ascending: true });
      return (data || []) as MuralComment[];
    },
  });

  // Create post
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('mural_posts').insert({
        title: formTitle,
        body: formBody,
        category: formCategory,
        images: pendingImages as any,
        files: pendingFiles as any,
        author_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mural-posts'] });
      toast.success('Publicação criada');
      // Notify mentioned users
      if (user) notifyMentions(formBody, user.id, formTitle, '/mural');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update post
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPost) return;
      const { error } = await supabase.from('mural_posts').update({
        title: formTitle,
        body: formBody,
        category: formCategory,
        images: pendingImages as any,
        files: pendingFiles as any,
      }).eq('id', editingPost.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mural-posts'] });
      toast.success('Publicação atualizada');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete post
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mural_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mural-posts'] });
      toast.success('Publicação eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toggle reaction
  const reactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      if (!user) return;
      const existing = reactions.find(r => r.post_id === postId && r.user_id === user.id && r.emoji === emoji);
      if (existing) {
        await supabase.from('mural_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('mural_reactions').insert({ post_id: postId, user_id: user.id, emoji });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mural-reactions'] }),
  });

  // Add comment
  const commentMutation = useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      if (!user) return;
      const { error } = await supabase.from('mural_comments').insert({ post_id: postId, author_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mural-comments'] });
      if (user) notifyMentions(variables.body, user.id, 'Comentário no Mural', '/mural');
    },
  });

  function resetForm() {
    setFormTitle('');
    setFormBody('');
    setFormCategory('outro');
    setPendingImages([]);
    setPendingFiles([]);
    setEditingPost(null);
    setDialogOpen(false);
  }

  function openEdit(post: MuralPost) {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormBody(post.body);
    setFormCategory(post.category);
    setPendingImages(post.images);
    setPendingFiles(post.files);
    setDialogOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploadingImages(true);
    const urls: string[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop();
      const path = `images/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('mural-files').upload(path, file);
      if (!error) {
        const { data: pub } = supabase.storage.from('mural-files').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
    }
    setPendingImages(prev => [...prev, ...urls]);
    setUploadingImages(false);
    e.target.value = '';
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploadingFiles(true);
    const newFiles: { name: string; url: string }[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop();
      const path = `files/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('mural-files').upload(path, file);
      if (!error) {
        const { data: pub } = supabase.storage.from('mural-files').getPublicUrl(path);
        newFiles.push({ name: file.name, url: pub.publicUrl });
      }
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
    setUploadingFiles(false);
    e.target.value = '';
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <BackNavigation parentRoute="/hub-equipa" parentLabel="Hub de Equipa" />
        <PageHeader title="Mural" />
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <ViewTabs
              views={allViews}
              activeKey={activeView}
              onSelect={setActiveView}
              onAdd={(label) => addView(label)}
              onRename={(id, label) => renameView({ id, label })}
              onDelete={(id) => { if (activeView.startsWith('custom_')) setActiveView('todas'); deleteView(id); }}
            />
            {canPublish && (
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nova Publicação
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">Nenhuma publicação no mural</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                profile={profileMap.get(post.author_id)}
                reactions={reactions.filter(r => r.post_id === post.id)}
                comments={comments.filter(c => c.post_id === post.id)}
                profileMap={profileMap}
                userId={user?.id}
                isOwner={isOwner}
                onReact={(emoji) => reactionMutation.mutate({ postId: post.id, emoji })}
                onComment={(body) => commentMutation.mutate({ postId: post.id, body })}
                onEdit={() => openEdit(post)}
                onDelete={async () => {
                  const ok = await confirm({
                    title: 'Eliminar publicação?',
                    description: 'A publicação e os comentários associados serão removidos.',
                    confirmText: 'Eliminar',
                    variant: 'destructive',
                  });
                  if (ok) deleteMutation.mutate(post.id);
                }}
              />
            ))}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); }}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPost ? 'Editar Publicação' : 'Nova Publicação'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <MentionTextarea value={formTitle} onChange={setFormTitle} placeholder="Título da publicação" singleLine rows={1} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Corpo *</Label>
                <MentionTextarea
                  value={formBody}
                  onChange={setFormBody}
                  rows={6}
                  placeholder="Escreve aqui a tua publicação... usa @nome para mencionar alguém"
                />
              </div>

              {/* Image previews */}
              {pendingImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {pendingImages.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        className="absolute top-0.5 right-0.5 bg-background/80 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* File previews */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="truncate">{f.name}</span>
                      <button
                        className="text-destructive text-xs"
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageUpload} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImages}
                  onClick={() => imageInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImageIcon className="h-4 w-4" /> {uploadingImages ? 'A carregar...' : 'Imagens'}
                </Button>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileUpload} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Paperclip className="h-4 w-4" /> {uploadingFiles ? 'A carregar...' : 'Ficheiros'}
                </Button>
              </div>

              <Button
                onClick={() => {
                  if (!formTitle.trim() || !formBody.trim()) { toast.error('Título e corpo são obrigatórios'); return; }
                  if (editingPost) { updateMutation.mutate(); } else { createMutation.mutate(); }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'A guardar...'
                  : editingPost ? 'Guardar Alterações' : 'Publicar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Post card component
function PostCard({
  post,
  profile,
  reactions,
  comments,
  profileMap,
  userId,
  isOwner,
  onReact,
  onComment,
  onEdit,
  onDelete,
}: {
  post: MuralPost;
  profile?: Profile;
  reactions: MuralReaction[];
  comments: MuralComment[];
  profileMap: Map<string, Profile>;
  userId?: string;
  isOwner: boolean;
  onReact: (emoji: string) => void;
  onComment: (body: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { getPhotoUrl } = useTeamPhotos();
  const [commentText, setCommentText] = useState('');
  const cat = getCategoryInfo(post.category);

  // Group reactions by emoji
  const reactionCounts = REACTION_EMOJIS.map(emoji => {
    const list = reactions.filter(r => r.emoji === emoji);
    const userReacted = list.some(r => r.user_id === userId);
    return { emoji, count: list.length, userReacted };
  });

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between mb-3">
          <Badge className={`${cat.color} border-0`}>{cat.label}</Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {format(new Date(post.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
            </span>
            {(isOwner || post.author_id === userId) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Mais opções" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <h2 className="text-lg font-semibold mb-2">{post.title}</h2>
        <div className="flex items-center gap-2 mb-4">
          <Avatar className="h-7 w-7">
            <AvatarImage src={getPhotoUrl(profile)} />
            <AvatarFallback className="text-xs">{getInitials(profile?.full_name || null)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{profile?.full_name || 'Membro'}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-4">
        <RichText text={post.body} className="whitespace-pre-wrap text-sm leading-relaxed" />
      </div>

      {/* Images gallery */}
      {post.images.length > 0 && (
        <div className={`px-5 pb-4 grid gap-2 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="rounded-lg w-full object-cover max-h-72 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(url, '_blank')}
            />
          ))}
        </div>
      )}

      {/* Files */}
      {post.files.length > 0 && (
        <div className="px-5 pb-4 space-y-1">
          {post.files.map((f, i) => (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              {f.name}
            </a>
          ))}
        </div>
      )}

      {/* Reactions */}
      <div className="px-5 pb-3 flex items-center gap-1.5 flex-wrap">
        {reactionCounts.map(({ emoji, count, userReacted }) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-colors border ${
              userReacted
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/50 border-transparent hover:bg-muted text-muted-foreground'
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        ))}
      </div>

      {/* Comments section */}
      <div className="border-t">
        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
          </span>
          {commentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {commentsOpen && (
          <div className="px-5 pb-4 space-y-3">
            {comments.map(comment => {
              const cp = profileMap.get(comment.author_id);
              return (
                <div key={comment.id} className="flex gap-2.5">
                  <Avatar className="h-6 w-6 mt-0.5">
                    <AvatarImage src={getPhotoUrl(cp)} />
                    <AvatarFallback className="text-[10px]">{getInitials(cp?.full_name || null)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{cp?.full_name || 'Membro'}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(comment.created_at), "d MMM 'às' HH:mm", { locale: pt })}
                      </span>
                    </div>
                    <RichText text={comment.body} className="text-sm text-muted-foreground" />
                  </div>
                </div>
              );
            })}

            {/* Add comment */}
            <div className="flex gap-2 pt-1">
              <MentionTextarea
                placeholder="Escreve um comentário... usa @ para mencionar"
                value={commentText}
                onChange={setCommentText}
                singleLine
                rows={1}
                className="text-sm h-9"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    onComment(commentText.trim());
                    setCommentText('');
                  }
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-2.5"
                disabled={!commentText.trim()}
                onClick={() => {
                  if (commentText.trim()) {
                    onComment(commentText.trim());
                    setCommentText('');
                  }
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
