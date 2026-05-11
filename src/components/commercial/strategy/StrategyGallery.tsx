import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { StrategyDetail } from './StrategyDetail';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Strategy {
  id: string;
  title: string;
  period: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
  sections: any[];
}

export function StrategyGallery() {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['commercial-strategies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_strategy')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Strategy[];
    },
  });

  const handleCreate = async () => {
    const { data, error } = await supabase
      .from('commercial_strategy')
      .insert({ title: 'Nova Estratégia', period: '', sections: [] } as any)
      .select('id')
      .single();
    if (error) {
      toast.error('Erro ao criar estratégia');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['commercial-strategies'] });
    if (data) setSelectedId(data.id);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('commercial_strategy').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao eliminar estratégia');
      return;
    }
    toast.success('Estratégia eliminada');
    queryClient.invalidateQueries({ queryKey: ['commercial-strategies'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedId) {
    return (
      <StrategyDetail
        strategyId={selectedId}
        onBack={() => {
          setSelectedId(null);
          queryClient.invalidateQueries({ queryKey: ['commercial-strategies'] });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {strategies.length} {strategies.length === 1 ? 'documento' : 'documentos'}
        </p>
        {isOwner && (
          <Button size="sm" onClick={handleCreate} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Nova Estratégia
          </Button>
        )}
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <EmptyHint>Nenhuma estratégia criada.</EmptyHint>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={handleCreate} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Criar primeira estratégia
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group relative"
              onClick={() => setSelectedId(s.id)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                    {(s.start_date || s.end_date) && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {s.start_date ? format(new Date(s.start_date), "d MMM yy", { locale: pt }) : '—'}
                        {' → '}
                        {s.end_date ? format(new Date(s.end_date), "d MMM yy", { locale: pt }) : '—'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {s.sections?.length || 0} {(s.sections?.length || 0) === 1 ? 'secção' : 'secções'}
                  </span>
                  <span>
                    {format(new Date(s.updated_at), "d MMM yyyy", { locale: pt })}
                  </span>
                </div>
                {isOwner && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          aria-label="Eliminar" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar estratégia?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação é irreversível. O documento "{s.title}" será eliminado permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
