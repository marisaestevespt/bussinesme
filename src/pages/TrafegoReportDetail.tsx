import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { ChevronLeft, Check } from 'lucide-react';

export default function TrafegoReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: card, isLoading } = useQuery({
    queryKey: ['traffic-report-card', id],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_report_cards').select('*').eq('id', id!).single() as any;
      return data as { id: string; title: string; content: string | null } | null;
    },
    enabled: !!id,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setContent(card.content || '');
    }
  }, [card]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('traffic_report_cards').update({ title, content } as any).eq('id', id!);
    setSaving(false);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['traffic-report-card', id] }); }
  };

  if (isLoading || !card) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Tráfego Pago</p>
          {isOwner ? (
            <Input value={title} onChange={e => setTitle(e.target.value)}
              className="text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-none text-center h-auto p-0"
              style={{ color: 'hsl(var(--primary-foreground))' }} />
          ) : (
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>{title}</h1>
          )}
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/marketing/trafego-pago')}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>

          <RichTextEditor content={content} onChange={setContent} editable={isOwner} />

          {isOwner && (
            <div className="flex justify-end pt-4">
              <Button onClick={save} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
