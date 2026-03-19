import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareHeart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { DEPARTMENTS } from '@/lib/departments';

const AREA_OPTIONS = [
  { value: 'all', label: 'Todas as áreas' },
  ...DEPARTMENTS.map(d => ({ value: d.value, label: d.label })),
  { value: 'geral', label: 'Geral / Empresa' },
];

export default function ExecutiveRecommendations() {
  const [filterArea, setFilterArea] = useState('all');

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = filterArea === 'all'
    ? recommendations
    : recommendations.filter(r => r.impacted_area === filterArea);

  const areaLabel = (val: string) => AREA_OPTIONS.find(a => a.value === val)?.label || val;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <BackNavigation parentRoute="/executive" parentLabel="Executive Room" />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <MessageSquareHeart className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Caixa das Recomendações</h1>
              <p className="text-sm text-muted-foreground">Todas as recomendações da equipa</p>
            </div>
          </div>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREA_OPTIONS.map(a => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ainda não existem recomendações.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium text-sm text-foreground">{r.member_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{areaLabel(r.impacted_area)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: pt })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.recommendation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
