import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Pencil, Check, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function ComecaAquiPage() {
  const { settings, refetch: refetchSettings } = useBusinessSettings();
  const { isOwner } = useAuth();
  const navigate = useNavigate();

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
