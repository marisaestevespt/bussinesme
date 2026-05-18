import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, MessageSquare, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  clientId: string | undefined;
  clientName: string;
}

export function ClientFeedbackSection({ clientId, clientName }: Props) {
  const qc = useQueryClient();
  const [newContent, setNewContent] = useState('');

  // Manual feedback from client_feedback table
  const { data: manualFeedback = [] } = useQuery({
    queryKey: ['client_feedback', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await (supabase.from('client_feedback' as any) as any)
        .select('*')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!clientId,
  });

  // Portal feedback (through portal)
  const { data: portalFeedback = [] } = useQuery({
    queryKey: ['portal_feedback_by_client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data: portal } = await (supabase.from('client_portals' as any) as any)
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
      if (!portal?.id) return [];
      const { data, error } = await (supabase.from('portal_feedback' as any) as any)
        .select('*')
        .eq('portal_id', portal.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((f: any) => ({ ...f, source: 'portal' })) as any[];
    },
    enabled: !!clientId,
  });

  // Merge and sort
  const allFeedback = [
    ...manualFeedback,
    ...portalFeedback,
  ].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  const addFeedback = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await (supabase.from('client_feedback' as any) as any).insert({
        client_id: clientId,
        content,
        source: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_feedback', clientId] });
      qc.invalidateQueries({ queryKey: ['all_client_feedback'] });
      setNewContent('');
      toast.success('Feedback adicionado');
    },
  });

  const deleteFeedback = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await (supabase.from('client_feedback' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_feedback', clientId] });
      qc.invalidateQueries({ queryKey: ['all_client_feedback'] });
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Feedback Recebido
        </CardTitle>
        <Badge variant="outline" className="text-xs">{allFeedback.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add manual feedback */}
        <div className="flex gap-2 items-start">
          <Textarea
            className="text-sm min-h-[60px]"
            placeholder="Adicionar feedback manualmente..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={2}
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={!newContent.trim() || !clientId}
            onClick={() => addFeedback.mutate(newContent.trim())}
          >
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
        </div>

        {/* Gallery */}
        {allFeedback.length === 0 ? (
          <EmptyHint>Sem feedback recebido</EmptyHint>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {allFeedback.map((f: any) => {
              const isPortal = f.source === 'portal';
              const accent = isPortal ? 'border-l-primary' : 'border-l-accent-violet';
              const badgeCls = isPortal
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-accent-violet/15 text-accent-violet border-accent-violet/30';
              return (
                <div
                  key={f.id}
                  className={`relative rounded-lg border-l-4 ${accent} border bg-card shadow-sm hover:shadow-md transition-shadow p-4 space-y-3`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`${badgeCls} whitespace-nowrap`}>
                      {isPortal ? 'Portal' : 'Manual'}
                    </Badge>
                    {!isPortal && (
                      <Button
                        variant="ghost"
                        aria-label="Eliminar"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0 -mt-1 -mr-1"
                        onClick={() => deleteFeedback.mutate(f.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{f.content}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
