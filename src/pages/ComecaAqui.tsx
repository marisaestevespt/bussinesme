import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Pencil, Check, X, Phone, Mail, Clock, FileText, Upload, User } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  work_schedule: string | null;
  bio: string | null;
  role_title: string | null;
  email?: string;
}

export default function ComecaAquiPage() {
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner, user } = useAuth();

  const [welcomeText, setWelcomeText] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempWelcome, setTempWelcome] = useState('');
  const [tempAbout, setTempAbout] = useState('');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<TeamMember>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setWelcomeText((settings as any).welcome_text || '');
      setAboutText((settings as any).about_text || '');
    }
  }, [settings]);

  const fetchMembers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    if (profiles) {
      setMembers(profiles.map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        phone: (p as any).phone,
        work_schedule: (p as any).work_schedule,
        bio: (p as any).bio,
        role_title: (p as any).role_title,
      })));
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const saveText = async (field: 'welcome_text' | 'about_text', value: string) => {
    if (!settings) return;
    const { error } = await supabase
      .from('business_settings')
      .update({ [field]: value } as any)
      .eq('id', settings.id);
    if (error) {
      toast.error('Erro ao guardar');
    } else {
      toast.success('Guardado');
      refetchSettings();
    }
  };

  const handleSaveWelcome = () => {
    saveText('welcome_text', tempWelcome);
    setWelcomeText(tempWelcome);
    setEditingWelcome(false);
  };

  const handleSaveAbout = () => {
    saveText('about_text', tempAbout);
    setAboutText(tempAbout);
    setEditingAbout(false);
  };

  const canEditMember = (member: TeamMember) =>
    isOwner || member.user_id === user?.id;

  const openMemberDetail = (member: TeamMember) => {
    setSelectedMember(member);
    setProfileForm({ ...member });
    setEditingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedMember) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `avatars/${selectedMember.user_id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro ao carregar imagem');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(path);

    setProfileForm(prev => ({ ...prev, avatar_url: publicUrl }));
    setUploading(false);
  };

  const saveProfile = async () => {
    if (!selectedMember) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileForm.full_name,
        avatar_url: profileForm.avatar_url,
        phone: profileForm.phone,
        work_schedule: profileForm.work_schedule,
        bio: profileForm.bio,
        role_title: profileForm.role_title,
      } as any)
      .eq('id', selectedMember.id);

    if (error) {
      toast.error('Erro ao guardar perfil');
    } else {
      toast.success('Perfil atualizado');
      setEditingProfile(false);
      fetchMembers();
      setSelectedMember(prev => prev ? { ...prev, ...profileForm } : null);
    }
  };

  const getInitials = (name: string | null) =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const businessName = settings?.business_name || 'Negócio';

  const defaultWelcome = `Olá! Bem-vindo(a) ao HQ | ${businessName}. Este é o espaço onde organizamos, colaboramos e crescemos.`;
  const defaultAbout = 'Somos uma equipa dedicada a criar valor e impacto. Aqui encontras tudo o que precisas para colaborar, comunicar e acompanhar o nosso trabalho.';

  const displayWelcome = welcomeText || defaultWelcome;
  const displayAbout = aboutText || defaultAbout;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        {/* Cover */}
        <div
          className="w-full py-16 px-6 flex items-center justify-center"
          style={{ background: `hsl(var(--primary))` }}
        >
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: `hsl(var(--primary-foreground))` }}
          >
            Começa Aqui
          </h1>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-10 space-y-12">
          {/* Welcome text */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">Bem-vindo(a)</h2>
              {isOwner && !editingWelcome && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setTempWelcome(displayWelcome); setEditingWelcome(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {editingWelcome ? (
              <div className="space-y-2">
                <Textarea value={tempWelcome} onChange={e => setTempWelcome(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveWelcome}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingWelcome(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground leading-relaxed">{displayWelcome}</p>
            )}
          </section>

          {/* About section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">O que fazemos e como trabalhamos</h2>
              {isOwner && !editingAbout && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setTempAbout(displayAbout); setEditingAbout(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {editingAbout ? (
              <div className="space-y-2">
                <Textarea value={tempAbout} onChange={e => setTempAbout(e.target.value)} rows={5} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveAbout}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingAbout(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{displayAbout}</p>
            )}
          </section>

          <Separator />

          {/* Team gallery */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Equipa</h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum membro registado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {members.map(member => (
                  <Card
                    key={member.id}
                    className="cursor-pointer hq-transition hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => openMemberDetail(member)}
                  >
                    <CardContent className="flex flex-col items-center p-5 text-center space-y-3">
                      <Avatar className="h-16 w-16">
                        {member.avatar_url ? (
                          <AvatarImage src={member.avatar_url} alt={member.full_name || ''} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.full_name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.role_title || '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Document shortcut */}
          <section className="pb-10">
            <Card className="hq-transition hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Biblioteca de Documentos Internos</p>
                  <p className="text-xs text-muted-foreground">Em breve — documentos partilhados da equipa.</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Member detail dialog */}
      <Dialog open={!!selectedMember} onOpenChange={open => { if (!open) setSelectedMember(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ficha de Membro</DialogTitle>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {(editingProfile ? profileForm.avatar_url : selectedMember.avatar_url) ? (
                      <AvatarImage src={(editingProfile ? profileForm.avatar_url : selectedMember.avatar_url)!} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(editingProfile ? profileForm.full_name ?? null : selectedMember.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {editingProfile && (
                    <label className="absolute -bottom-1 -right-1 rounded-full bg-primary text-primary-foreground p-1.5 cursor-pointer hover:bg-primary/90 hq-transition">
                      <Upload className="h-3 w-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>

              {editingProfile ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome completo</label>
                    <Input value={profileForm.full_name || ''} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Função</label>
                    <Input value={profileForm.role_title || ''} onChange={e => setProfileForm(p => ({ ...p, role_title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <Input value={profileForm.phone || ''} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Horário de trabalho</label>
                    <Input value={profileForm.work_schedule || ''} onChange={e => setProfileForm(p => ({ ...p, work_schedule: e.target.value }))} placeholder="ex: 10h-19h, segunda a sexta" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Apresentação</label>
                    <Textarea value={profileForm.bio || ''} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} rows={3} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={saveProfile}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{selectedMember.full_name || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{selectedMember.role_title || '—'}</p>
                  </div>
                  <Separator />
                  {selectedMember.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{selectedMember.phone}</span>
                    </div>
                  )}
                  {selectedMember.work_schedule && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{selectedMember.work_schedule}</span>
                    </div>
                  )}
                  {selectedMember.bio && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Apresentação</p>
                      <p className="text-sm text-foreground whitespace-pre-line">{selectedMember.bio}</p>
                    </div>
                  )}
                  {canEditMember(selectedMember) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => { setProfileForm({ ...selectedMember }); setEditingProfile(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
