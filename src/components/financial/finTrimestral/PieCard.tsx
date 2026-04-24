import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatEuro } from '@/lib/formatting';
import { PIE_COLORS, type NamedValue } from './types';

interface Props {
  title: React.ReactNode;
  data: NamedValue[];
}

export function PieCard({ title, data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={1}>
                    {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 text-sm flex-1 min-w-0">
              {data.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0">{formatEuro(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
      </CardContent>
    </Card>
  );
}
