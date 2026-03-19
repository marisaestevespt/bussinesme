import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { ChevronLeft, Check } from 'lucide-react';

export default function MarketingSubPage() {
  const { pageKey } = useParams<{ pageKey: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  const { data: page, isLoading } = useQuery({
    queryKey: ['marketing-page', pageKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_pages')
        .select('*')
        .eq('page_key', pageKey!)
        .single() as { data: { id: string; title: string; content: string | null; page_key: string } | null };
      return data;
    },
    enabled: !!pageKey,
  });

  const [content, setContent] = useState('');
  useEffect(() => { if (page) setContent(page.content || ''); }, [page]);

  const handleSave = async () => {
    if (!page) return;
    const { error } = await supabase.from('marketing_pages').update({ content } as any).eq('id', page.id);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); queryClient.invalidateQueries({ queryKey: ['marketing-page', pageKey] }); }
  };

  if (isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </AppLayout>
  );

  if (!page) return (
    <AppLayout>
      <div className="p-10 text-center text-muted-foreground">Página não encontrada.</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>
            Marketing e Branding
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>
            {page.title}
          </h1>
        </div>
        <div className="max-w-4xl mx-auto w-full px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate('/hub/marketing')}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar ao Marketing
          </Button>
          <RichTextEditor content={content} onChange={setContent} editable={isOwner} />
          {isOwner && (
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
