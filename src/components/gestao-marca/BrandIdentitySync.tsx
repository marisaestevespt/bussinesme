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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Missão */}
      <div className="group/card rounded-lg border border-primary/15 bg-primary/5 p-4 hq-transition hover:border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Missão</p>
          {isOwner && !editM && (
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={() => { setMDraft(data?.mission || ''); setEditM(true); }}>
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
          <p className="text-sm text-foreground leading-relaxed">{data?.mission || <span className="italic text-muted-foreground">Por definir.</span>}</p>
        )}
      </div>

      {/* Visão */}
      <div className="group/card rounded-lg border border-primary/15 bg-primary/5 p-4 hq-transition hover:border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Eye className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Visão</p>
          {isOwner && !editV && (
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={() => { setVDraft(data?.vision || ''); setEditV(true); }}>
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
          <p className="text-sm text-foreground leading-relaxed">{data?.vision || <span className="italic text-muted-foreground">Por definir.</span>}</p>
        )}
      </div>
      </div>

      {/* Valores */}
      <div className="group/card rounded-lg border border-primary/15 bg-primary/5 p-4 hq-transition hover:border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Heart className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Valores</p>
        </div>
        {valuesList.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Adiciona valores que guiam a equipa.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {valuesList.map((v, idx) => (
              <span key={idx} className="group/val inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1 text-sm text-primary font-medium">
                {v}
                {isOwner && (
                  <button
                    onClick={() => save.mutate({ values_list: valuesList.filter((_, i) => i !== idx) })}
                    className="opacity-0 group-hover/val:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    aria-label="Remover valor"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {isOwner && (
          <div className="opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity mt-3 pt-3 border-t border-primary/15">
            <Input
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              placeholder="+ Adicionar valor e Enter"
              className="h-7 text-xs px-0 border-0 rounded-none shadow-none focus-visible:ring-0 bg-transparent placeholder:text-primary/60"
              onKeyDown={e => {
                if (e.key === 'Enter' && newVal.trim()) {
                  save.mutate({ values_list: [...valuesList, newVal.trim()] });
                  setNewVal('');
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}