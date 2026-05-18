import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  total_ms: number;
  calls: number;
  mean_ms: number;
  rows: number;
  query_preview: string;
};

export function SettingsPerformance() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_top_queries', { _limit: 20 });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      toast.error('Erro a carregar queries', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Top 20 queries por tempo total
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Snapshot do <code className="text-xs">pg_stat_statements</code>. Útil para identificar queries lentas ou demasiado frequentes. Mean &gt; 100ms ou calls extremamente altas (&gt;5k) merecem revisão.
        </p>
        <Button onClick={load} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {loading ? 'A carregar…' : 'Carregar snapshot'}
        </Button>

        {rows && (
          <div className="space-y-2 mt-3">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
            {rows.map((r, i) => {
              const slow = r.mean_ms > 100;
              const hot = r.calls > 5000;
              return (
                <div key={i} className="border rounded-md p-3 bg-background/50 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={slow ? 'destructive' : 'secondary'} className="text-xs font-mono">
                      {r.mean_ms.toFixed(1)} ms média
                    </Badge>
                    <Badge variant={hot ? 'destructive' : 'outline'} className="text-xs font-mono">
                      {r.calls.toLocaleString()} calls
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono">
                      {Math.round(r.total_ms).toLocaleString()} ms total
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono">
                      {r.rows.toLocaleString()} rows
                    </Badge>
                  </div>
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-snug">
                    {r.query_preview}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}