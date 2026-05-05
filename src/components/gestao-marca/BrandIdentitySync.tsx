import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Plus, Target, Eye, Heart } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  settingsId?: string;
  isOwner: boolean;
}

export function BrandIdentitySync({ settingsId, isOwner }: Props) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['brand', 'identity'],
    queryFn: async () => {
      const { data } = await supabase.from('business_settings').select('id, mission, vision, values_list').limit(1).maybeSingle();
      return data as any;
    },
  });

  const valuesList: string[] = useMemo(() => Array.isArray(data?.values_list) ? data.values_list : [], [data]);

  const [editM, setEditM] = useState(false);
  const [editV, setEditV] = useState(false);
  const [mDraft, setMDraft] = useState('');
  const [vDraft, setVDraft] = useState('');
  const [newVal, setNewVal] = useState('');

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const id = settingsId || data?.id;
      if (!id) return;
      const { error } = await supabase.from('business_settings').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand', 'identity'] });
      qc.invalidateQueries({ queryKey: ['strategic', 'identity'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao guardar'),
  });

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Missão */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Missão</p>
          {isOwner && !editM && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setMDraft(data?.mission || ''); setEditM(true); }}>
              <Pencil className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
        {editM ? (
          <div className="space-y-1.5">
            <Textarea value={mDraft} onChange={e => setMDraft(e.target.value)} rows={2} placeholder="O que fazemos hoje, para quem, e porquê…" />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => save.mutate({ mission: mDraft }, { onSuccess: () => setEditM(false) })}><Check className="h-3 w-3 mr-1" />Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditM(false)}><X className="h-3 w-3 mr-1" />Cancelar</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{data?.mission || <span className="italic">Por definir.</span>}</p>
        )}
      </div>

      {/* Visão */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Visão</p>
          {isOwner && !editV && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setVDraft(data?.vision || ''); setEditV(true); }}>
              <Pencil className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
        {editV ? (
          <div className="space-y-1.5">
            <Textarea value={vDraft} onChange={e => setVDraft(e.target.value)} rows={2} placeholder="Onde queremos chegar nos próximos 3-5 anos…" />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => save.mutate({ vision: vDraft }, { onSuccess: () => setEditV(false) })}><Check className="h-3 w-3 mr-1" />Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditV(false)}><X className="h-3 w-3 mr-1" />Cancelar</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{data?.vision || <span className="italic">Por definir.</span>}</p>
        )}
      </div>

      {/* Valores */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Heart className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valores</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {valuesList.length === 0 && <span className="text-xs italic text-muted-foreground">Adiciona valores que guiam a equipa.</span>}
          {valuesList.map((v, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1 group">
              {v}
              {isOwner && (
                <button
                  onClick={() => save.mutate({ values_list: valuesList.filter((_, i) => i !== idx) })}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Input
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              placeholder="Ex: Transparência"
              className="h-8 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && newVal.trim()) {
                  save.mutate({ values_list: [...valuesList, newVal.trim()] });
                  setNewVal('');
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (newVal.trim()) {
                  save.mutate({ values_list: [...valuesList, newVal.trim()] });
                  setNewVal('');
                }
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}