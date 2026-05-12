import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Pencil, Check, X, FileText, Clock, Users, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyHint } from '@/components/ui/loading-skeletons';

function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members-gallery'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, photo_url, work_schedule, status, email, whatsapp, presentation')
        .eq('status', 'ativo')
        .order('full_name');
      
      return data || [];
    },
  });
}

const formatScheduleSummary = (raw: string | null): string => {
  if (!raw) return '';
  try {
    const s = JSON.parse(raw);
    const DAYS = [
      { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
      { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
    ];

    // Build list of active days with their hours signature
    const getHours = (val: any): string => {
      if (!val) return '';
      if (Array.isArray(val)) {
        if (val.length === 0) return '';
        return val.length === 2 ? 'full' : val.includes('manha') ? 'M' : 'T';
      }
      const parts: string[] = [];
      if (val.manha) parts.push(val.manha);
      if (val.tarde) parts.push(val.tarde);
      return parts.join(' ') || '';
    };

    const active = DAYS.map(d => ({ label: d.label, hours: getHours(s[d.key]) })).filter(d => d.hours);
    if (!active.length) return '';

    // Group consecutive days with same hours
    const groups: { start: string; end: string; hours: string }[] = [];
    for (const day of active) {
      const last = groups[groups.length - 1];
      if (last && last.hours === day.hours) {
        last.end = day.label;
      } else {
        groups.push({ start: day.label, end: day.label, hours: day.hours });
      }
    }

    const formatHours = (h: string) => {
      if (h === 'full') return '';
      if (h === 'M') return '(manhã)';
      if (h === 'T') return '(tarde)';
      return h;
    };

    return groups.map(g => {
      const range = g.start === g.end ? g.start : `${g.start}-${g.end}`;
      const h = formatHours(g.hours);
      return h ? `${range} ${h}` : range;
    }).join(' · ');
  } catch { return raw; }
};

const DAY_KEY_MAP: Record<number, string> = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab', 0: 'dom' };

const isWithinSchedule = (raw: string | null): boolean => {
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    const now = new Date();
    const dayKey = DAY_KEY_MAP[now.getDay()];
    const val = s[dayKey];
    if (!val) return false;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const inRange = (range: string) => {
      const [start, end] = range.split('-').map(t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      });
      return nowMins >= start && nowMins <= end;
    };
    if (typeof val === 'object' && !Array.isArray(val)) {
      if (val.manha && inRange(val.manha)) return true;
      if (val.tarde && inRange(val.tarde)) return true;
    }
    return false;
  } catch { return false; }
};

export default function ComecaAquiPage() {
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const teamMembers = useTeamMembers();
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const [welcomeText, setWelcomeText] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempWelcome, setTempWelcome] = useState('');
  const [tempAbout, setTempAbout] = useState('');

  useEffect(() => {
    if (settings) {
      setWelcomeText(settings.welcome_text || '');
      setAboutText(settings.about_text || '');
    }
  }, [settings]);

  const saveText = async (field: 'welcome_text' | 'about_text', value: string) => {
    if (!settings) return;
    const { error } = await supabase
      .from('business_settings')
      .update({ [field]: value } as any)
      .eq('id', settings.id);
    if (error) toast.error('Não consegui guardar a configuração. Tenta novamente.');
    else { toast.success('Guardado'); refetchSettings(); }
  };

  const handleSaveWelcome = () => { saveText('welcome_text', tempWelcome); setWelcomeText(tempWelcome); setEditingWelcome(false); };
  const handleSaveAbout = () => { saveText('about_text', tempAbout); setAboutText(tempAbout); setEditingAbout(false); };

  const businessName = settings?.business_name || 'Negócio';
  const defaultWelcome = `Olá! Bem-vindo(a) a ${businessName}. Este é o espaço onde organizamos, colaboramos e crescemos.`;
  const defaultAbout = 'Somos uma equipa dedicada a criar valor e impacto. Aqui encontras tudo o que precisas para colaborar, comunicar e acompanhar o nosso trabalho.';
  const displayWelcome = welcomeText || defaultWelcome;
  const displayAbout = aboutText || defaultAbout;

  const getInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/hub-equipa" parentLabel="Hub de Equipa" />
        <PageHeader title="Começa Aqui" />

        <div className="space-y-12">
          {/* Welcome text */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">Bem-vindo(a)</h2>
              {isOwner && !editingWelcome && (
                <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => { setTempWelcome(displayWelcome); setEditingWelcome(true); }}>
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
                <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => { setTempAbout(displayAbout); setEditingAbout(true); }}>
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
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{displayAbout}</p>
            )}
          </section>

          <Separator />

          {/* Team gallery */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Conhece a tua equipa</h2>
            </div>
            {(teamMembers.data || []).length === 0 ? (
              <EmptyHint>Ainda não há membros na equipa.</EmptyHint>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(teamMembers.data || []).map((m: any) => {
                  const schedule = formatScheduleSummary(m.work_schedule);
                  return (
                    <Card key={m.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMember(m)}>
                      <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                        <div className="relative">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={m.photo_url || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                              {getInitials(m.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${
                              isWithinSchedule(m.work_schedule) ? 'bg-success' : 'bg-warning'
                            }`}
                          />
                        </div>
                        <p className="font-semibold text-foreground truncate max-w-full">{m.full_name}</p>
                        {m.role_title && (
                          <Badge variant="secondary" className="text-[10px]">{m.role_title}</Badge>
                        )}
                        {schedule && (
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="leading-tight">{schedule}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Member detail sheet */}
          <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{selectedMember?.full_name}</SheetTitle>
                <SheetDescription>{selectedMember?.role_title || 'Membro da equipa'}</SheetDescription>
              </SheetHeader>
              {selectedMember && (
                <div className="mt-6 space-y-6">
                  {/* Avatar */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={selectedMember.photo_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {getInitials(selectedMember.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background ${
                          isWithinSchedule(selectedMember.work_schedule) ? 'bg-success' : 'bg-warning'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Presentation */}
                  {selectedMember.presentation && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Apresentação</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedMember.presentation}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Contacts */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Contactos</p>
                    {selectedMember.email && (
                      <a href={`mailto:${selectedMember.email}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <Mail className="h-4 w-4 text-primary" />
                        {selectedMember.email}
                      </a>
                    )}
                    {selectedMember.whatsapp && (
                      <a href={`https://wa.me/${selectedMember.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <Phone className="h-4 w-4 text-primary" />
                        {selectedMember.whatsapp}
                      </a>
                    )}
                    {!selectedMember.email && !selectedMember.whatsapp && (
                      <EmptyHint>Sem contactos registados.</EmptyHint>
                    )}
                  </div>

                  <Separator />

                  {/* Schedule */}
                  {selectedMember.work_schedule && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Horário</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>{formatScheduleSummary(selectedMember.work_schedule)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Separator />

          {/* Document shortcut */}
          <section className="pb-10">
            <Card className="hq-transition hover:shadow-md cursor-pointer" onClick={() => navigate('/hub/biblioteca')}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Biblioteca de Documentos Internos</p>
                  <p className="text-xs text-muted-foreground">Documentos partilhados da equipa.</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
