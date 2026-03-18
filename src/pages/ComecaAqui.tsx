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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Pencil, Check, X, Phone, Clock, FileText, Upload, UserPlus, Copy, Link } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// --- Schedule types & helpers ---

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;
const DAY_ABBR: Record<string, string> = {
  Segunda: 'Seg', Terça: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex', Sábado: 'Sáb', Domingo: 'Dom',
};

interface DaySchedule {
  active: boolean;
  start: string;
  end: string;
}
type WeekSchedule = Record<string, DaySchedule>;

const emptySchedule = (): WeekSchedule =>
  Object.fromEntries(DAYS.map(d => [d, { active: false, start: '09:00', end: '18:00' }]));

function parseSchedule(raw: string | null): WeekSchedule {
  if (!raw) return emptySchedule();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const schedule = emptySchedule();
      for (const day of DAYS) {
        if (parsed[day]) {
          schedule[day] = { ...schedule[day], ...parsed[day] };
        }
      }
      return schedule;
    }
  } catch { /* not JSON, legacy text */ }
  return emptySchedule();
}

function serializeSchedule(schedule: WeekSchedule): string {
  return JSON.stringify(schedule);
}

function summarizeSchedule(raw: string | null): string | null {
  const schedule = parseSchedule(raw);
  const activeDays = DAYS.filter(d => schedule[d].active);
  if (activeDays.length === 0) return null;

  // Check if all active days share same hours
  const firstStart = schedule[activeDays[0]].start;
  const firstEnd = schedule[activeDays[0]].end;
  const sameHours = activeDays.every(d => schedule[d].start === firstStart && schedule[d].end === firstEnd);

  const formatTime = (t: string) => t.replace(':00', 'h').replace(':', 'h');

  // Try to find consecutive ranges
  const dayIndices = activeDays.map(d => DAYS.indexOf(d));
  const ranges: string[] = [];
  let i = 0;
  while (i < dayIndices.length) {
    let j = i;
    while (j + 1 < dayIndices.length && dayIndices[j + 1] === dayIndices[j] + 1) j++;
    if (j > i) {
      ranges.push(`${DAY_ABBR[DAYS[dayIndices[i]]]}-${DAY_ABBR[DAYS[dayIndices[j]]]}`);
    } else {
      ranges.push(DAY_ABBR[DAYS[dayIndices[i]]]);
    }
    i = j + 1;
  }

  const daysStr = ranges.join(', ');
  if (sameHours) {
    return `${daysStr}, ${formatTime(firstStart)}-${formatTime(firstEnd)}`;
  }
  return daysStr;
}

// --- Schedule editor component ---

function ScheduleEditor({
  value,
  onChange,
}: {
  value: WeekSchedule;
  onChange: (s: WeekSchedule) => void;
}) {
  const toggle = (day: string) =>
    onChange({ ...value, [day]: { ...value[day], active: !value[day].active } });

  const setTime = (day: string, field: 'start' | 'end', t: string) =>
    onChange({ ...value, [day]: { ...value[day], [field]: t } });

  return (
    <div className="space-y-2">
      {DAYS.map(day => (
        <div key={day} className={`flex items-center gap-3 rounded-md px-3 py-2 ${value[day].active ? 'bg-accent/30' : 'bg-muted/30'}`}>
          <Switch checked={value[day].active} onCheckedChange={() => toggle(day)} />
          <span className={`text-sm w-16 ${value[day].active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {day}
          </span>
          {value[day].active ? (
            <div className="flex items-center gap-2 ml-auto">
              <Input
                type="time"
                value={value[day].start}
                onChange={e => setTime(day, 'start', e.target.value)}
                className="h-8 w-28 text-xs"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="time"
                value={value[day].end}
                onChange={e => setTime(day, 'end', e.target.value)}
                className="h-8 w-28 text-xs"
              />
            </div>
          ) : (
            <span className="ml-auto text-xs text-muted-foreground">Inativo</span>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Schedule detail view ---

function ScheduleDetail({ raw }: { raw: string | null }) {
  const schedule = parseSchedule(raw);
  const hasAny = DAYS.some(d => schedule[d].active);
  if (!hasAny) return null;

  const formatTime = (t: string) => t.replace(':00', 'h').replace(':', 'h');

  return (
    <div className="space-y-1">
      {DAYS.map(day => (
        <div key={day} className={`flex items-center gap-2 text-sm ${schedule[day].active ? '' : 'opacity-40'}`}>
          <span className={`w-16 ${schedule[day].active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {DAY_ABBR[day]}
          </span>
          {schedule[day].active ? (
            <span className="text-foreground">{formatTime(schedule[day].start)} — {formatTime(schedule[day].end)}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Role badge ---

function RoleBadge({ title }: { title: string | null }) {
  if (!title) return null;
  return (
    <Badge
      variant="secondary"
      className="bg-primary/10 text-primary border-0 hover:bg-primary/15 font-medium text-xs"
    >
      {title}
    </Badge>
  );
}

// --- Main page ---

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  work_schedule: string | null;
  bio: string | null;
  role_title: string | null;
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
  const [scheduleForm, setScheduleForm] = useState<WeekSchedule>(emptySchedule());
  const [uploading, setUploading] = useState(false);
  const [showCreateMember, setShowCreateMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [creatingMember, setCreatingMember] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (settings) {
      setWelcomeText((settings as any).welcome_text || '');
      setAboutText((settings as any).about_text || '');
    }
  }, [settings]);

  const fetchMembers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
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

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const saveText = async (field: 'welcome_text' | 'about_text', value: string) => {
    if (!settings) return;
    const { error } = await supabase
      .from('business_settings')
      .update({ [field]: value } as any)
      .eq('id', settings.id);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); refetchSettings(); }
  };

  const handleSaveWelcome = () => { saveText('welcome_text', tempWelcome); setWelcomeText(tempWelcome); setEditingWelcome(false); };
  const handleSaveAbout = () => { saveText('about_text', tempAbout); setAboutText(tempAbout); setEditingAbout(false); };

  const canEditMember = (member: TeamMember) => isOwner || member.user_id === user?.id;

  const openMemberDetail = (member: TeamMember) => {
    setSelectedMember(member);
    setProfileForm({ ...member });
    setScheduleForm(parseSchedule(member.work_schedule));
    setEditingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedMember) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `avatars/${selectedMember.user_id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadError) { toast.error('Erro ao carregar imagem'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    setProfileForm(prev => ({ ...prev, avatar_url: publicUrl }));
    setUploading(false);
  };

  const saveProfile = async () => {
    if (!selectedMember) return;
    const serialized = serializeSchedule(scheduleForm);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileForm.full_name,
        avatar_url: profileForm.avatar_url,
        phone: profileForm.phone,
        work_schedule: serialized,
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
      setSelectedMember(prev => prev ? { ...prev, ...profileForm, work_schedule: serialized } : null);
    }
  };

  const getInitials = (name: string | null) =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const handleCreateMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    setCreatingMember(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-member', {
        body: {
          email: newMemberEmail,
          full_name: newMemberName,
          role_title: newMemberRole || null,
          phone: newMemberPhone || null,
        },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao criar membro');
      } else {
        toast.success('Membro criado com sucesso');
        setShowCreateMember(false);
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberRole('');
        setNewMemberPhone('');
        fetchMembers();
      }
    } catch {
      toast.error('Erro ao criar membro');
    }
    setCreatingMember(false);
  };

  const handleGenerateInviteLink = async (member: TeamMember) => {
    setGeneratingLink(true);
    try {
      const res = await supabase.functions.invoke('generate-invite-link', {
        body: { user_id: member.user_id },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao gerar link');
      } else {
        await navigator.clipboard.writeText(res.data.invite_url);
        toast.success(`Link de convite copiado para ${res.data.email}`);
      }
    } catch {
      toast.error('Erro ao gerar link');
    }
    setGeneratingLink(false);
  };

  const businessName = settings?.business_name || 'Negócio';
  const defaultWelcome = `Olá! Bem-vindo(a) ao HQ | ${businessName}. Este é o espaço onde organizamos, colaboramos e crescemos.`;
  const defaultAbout = 'Somos uma equipa dedicada a criar valor e impacto. Aqui encontras tudo o que precisas para colaborar, comunicar e acompanhar o nosso trabalho.';
  const displayWelcome = welcomeText || defaultWelcome;
  const displayAbout = aboutText || defaultAbout;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        {/* Cover */}
        <div className="w-full py-16 px-6 flex items-center justify-center" style={{ background: `hsl(var(--primary))` }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: `hsl(var(--primary-foreground))` }}>
            Começa Aqui
          </h1>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-10 space-y-12">
          {/* Welcome text */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">Bem-vindo(a)</h2>
              {isOwner && !editingWelcome && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setTempWelcome(displayWelcome); setEditingWelcome(true); }}>
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
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setTempAbout(displayAbout); setEditingAbout(true); }}>
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Equipa</h2>
              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => setShowCreateMember(true)}
                >
                  <UserPlus className="h-4 w-4 mr-1" /> Adicionar membro
                </Button>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum membro registado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {members.map(member => {
                  const scheduleSummary = summarizeSchedule(member.work_schedule);
                  return (
                    <Card
                      key={member.id}
                      className="cursor-pointer hq-transition hover:shadow-md hover:-translate-y-0.5"
                      onClick={() => openMemberDetail(member)}
                    >
                      <CardContent className="flex flex-col items-center p-5 text-center space-y-3">
                        <Avatar className="h-16 w-16">
                          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={member.full_name || ''} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{member.full_name || 'Sem nome'}</p>
                          <RoleBadge title={member.role_title} />
                          {scheduleSummary && (
                            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />{scheduleSummary}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                    <ScheduleEditor value={scheduleForm} onChange={setScheduleForm} />
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
                  <div className="text-center space-y-2">
                    <p className="font-semibold text-foreground">{selectedMember.full_name || 'Sem nome'}</p>
                    <RoleBadge title={selectedMember.role_title} />
                  </div>
                  <Separator />
                  {selectedMember.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{selectedMember.phone}</span>
                    </div>
                  )}
                  <ScheduleDetail raw={selectedMember.work_schedule} />
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
                      onClick={() => { setProfileForm({ ...selectedMember }); setScheduleForm(parseSchedule(selectedMember.work_schedule)); setEditingProfile(true); }}
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
