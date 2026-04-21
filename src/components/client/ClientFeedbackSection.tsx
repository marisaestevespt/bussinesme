import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

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
      const { error } = await (supabase.from('client_feedback' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client_feedback', clientId] });
      qc.invalidateQueries({ queryKey: ['all_client_feedback'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Feedback Recebido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add manual feedback */}
        <div className="flex gap-2">
          <Textarea
            className="text-xs min-h-[60px]"
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
            <Plus className="h-3 w-3 mr-1" />Adicionar
          </Button>
        </div>

        {/* List */}
        {allFeedback.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem feedback recebido</p>
        ) : (
          <div className="space-y-2">
            {allFeedback.map((f: any) => (
              <div key={f.id} className="border rounded-md p-3 text-xs flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p>{f.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {f.source === 'portal' ? 'Portal' : 'Manual'}
                    </Badge>
                  </div>
                </div>
                {f.source !== 'portal' && (
                  <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => deleteFeedback.mutate(f.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
