import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export function BlockProdutos() {
  const { data } = useQuery({
    queryKey: ['cockpit-produtos'],
    queryFn: async () => {
      const [products, clients, nps] = await Promise.all([
        supabase.from('products').select('id, name, status'),
        supabase.from('clients').select('id, current_product_id, status').eq('status', 'ativo'),
        supabase.from('product_nps_records').select('product_id, nps_score, actual_date').gte('actual_date', new Date(Date.now() - 90*24*3600*1000).toISOString().slice(0,10)),
      ]);

      const counts: Record<string, number> = {};
      (clients.data || []).forEach((c: any) => {
        if (c.current_product_id) counts[c.current_product_id] = (counts[c.current_product_id] || 0) + 1;
      });
      const npsByProd: Record<string, number[]> = {};
      (nps.data || []).forEach((r: any) => {
        if (r.product_id && r.nps_score != null) {
          if (!npsByProd[r.product_id]) npsByProd[r.product_id] = [];
          npsByProd[r.product_id].push(r.nps_score);
        }
      });
      const all = (products.data || []).map((p: any) => ({
        ...p,
        clientCount: counts[p.id] || 0,
        avgNps: npsByProd[p.id]?.length ? Math.round(npsByProd[p.id].reduce((s,v)=>s+v,0) / npsByProd[p.id].length) : null,
      }));
      return {
        ativos: all.filter((p: any) => p.status === 'ativo'),
        emDev: all.filter((p: any) => p.status !== 'ativo'),
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Ativos ({data?.ativos.length ?? 0})</div>
        <ul className="space-y-1.5 max-h-48 overflow-auto pr-1">
          {(data?.ativos || []).map((p: any) => (
            <li key={p.id} className="text-xs flex items-center gap-2">
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <Badge variant="outline" className="text-[10px]">{p.clientCount} clientes</Badge>
              {p.avgNps != null && <Badge variant="outline" className="text-[10px]">NPS {p.avgNps}</Badge>}
            </li>
          ))}
          {(data?.ativos.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem produtos ativos</p>}
        </ul>
      </div>
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Em desenvolvimento ({data?.emDev.length ?? 0})</div>
        <ul className="space-y-1.5 max-h-48 overflow-auto pr-1">
          {(data?.emDev || []).map((p: any) => (
            <li key={p.id} className="text-xs flex items-center gap-2">
              <span className="flex-1 truncate">{p.name}</span>
              <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
            </li>
          ))}
          {(data?.emDev.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">—</p>}
        </ul>
      </div>
    </div>
  );
}