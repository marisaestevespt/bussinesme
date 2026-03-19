import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
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
import { Pencil, Check, X, FileText, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members-gallery'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role_title, photo_url, work_schedule, status')
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
    return DAYS.filter(d => {
      const val = s[d.key];
      if (!val) return false;
      if (Array.isArray(val)) return val.length > 0;
      return val.manha || val.tarde;
    }).map(d => {
      const val = s[d.key];
      if (Array.isArray(val)) {
        const suffix = val.length === 2 ? '' : val.includes('manha') ? ' (M)' : ' (T)';
        return `${d.label}${suffix}`;
      }
      const parts: string[] = [];
      if (val.manha) parts.push(val.manha);
      if (val.tarde) parts.push(val.tarde);
      return `${d.label} ${parts.join(' / ')}`;
    }).join(' · ');
  } catch { return raw; }
};

export default function ComecaAquiPage() {
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const teamMembers = useTeamMembers();

  const [welcomeText, setWelcomeText] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempWelcome, setTempWelcome] = useState('');
  const [tempAbout, setTempAbout] = useState('');

  useEffect(() => {
    if (settings) {
      setWelcomeText((settings as any).welcome_text || '');
      setAboutText((settings as any).about_text || '');
    }
  }, [settings]);

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

  const businessName = settings?.business_name || 'Negócio';
  const defaultWelcome = `Olá! Bem-vindo(a) ao HQ | ${businessName}. Este é o espaço onde organizamos, colaboramos e crescemos.`;
  const defaultAbout = 'Somos uma equipa dedicada a criar valor e impacto. Aqui encontras tudo o que precisas para colaborar, comunicar e acompanhar o nosso trabalho.';
  const displayWelcome = welcomeText || defaultWelcome;
  const displayAbout = aboutText || defaultAbout;

  const getInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        {/* Cover */}
        <PageHeader title="Começa Aqui" />

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
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Conhece a tua equipa</h2>
            </div>
            {(teamMembers.data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há membros na equipa.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(teamMembers.data || []).map((m: any) => {
                  const schedule = formatScheduleSummary(m.work_schedule);
                  return (
                    <Card key={m.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={m.photo_url || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                              {getInitials(m.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 space-y-1">
                            <p className="font-semibold text-foreground truncate">{m.full_name}</p>
                            {m.role_title && (
                              <Badge variant="secondary" className="text-[10px]">{m.role_title}</Badge>
                            )}
                          </div>
                        </div>
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
