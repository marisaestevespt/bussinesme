import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOP_STATUSES: Record<string, { label: string; color: string }> = {
  para_criar: { label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  em_criacao: { label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  em_revisao: { label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  off: { label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
};

interface LinkedSopsSectionProps {
  entityType: 'produto' | 'cliente' | 'projeto';
  entityId: string;
  /** For clients: also show product SOPs with apply_to_all_active_clients */
  productId?: string;
  title?: string;
}

export function LinkedSopsSection({ entityType, entityId, productId, title = 'Processos' }: LinkedSopsSectionProps) {
  const navigate = useNavigate();

  const { data: sops = [] } = useQuery({
    queryKey: ['linked-sops', entityType, entityId, productId],
    queryFn: async () => {
      if (entityType === 'cliente') {
        // Client: direct + product with apply_to_all
        const queries = [];
        const { data: directData } = await supabase.from('sops').select('*')
          .eq('linked_entity_type', 'cliente')
          .eq('linked_entity_id', entityId) as any;
        const direct = directData || [];
        if (productId) {
          const { data: prodData } = await supabase.from('sops').select('*')
            .eq('linked_entity_type', 'produto')
            .eq('linked_entity_id', productId)
            .eq('apply_to_all_active_clients', true) as any;
          const prodSops = prodData || [];
          const map = new Map([...direct, ...prodSops].map((s: any) => [s.id, s]));
          return Array.from(map.values());
        }
        return direct;
      }
      const { data } = await supabase.from('sops').select('*')
        .eq('linked_entity_type', entityType)
        .eq('linked_entity_id', entityId) as any;
      return data || [];
    },
    enabled: !!entityId,
  });

  if (sops.length === 0) {
    return (
      <div className="py-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
        <p className="text-sm text-muted-foreground">Nenhum processo associado.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title} ({sops.length})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sops.map((sop: any) => {
          const st = SOP_STATUSES[sop.status] || SOP_STATUSES.para_criar;
          return (
            <Card key={sop.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                  <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="font-medium text-sm line-clamp-2">{sop.name}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
