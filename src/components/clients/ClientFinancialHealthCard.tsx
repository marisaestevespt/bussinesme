import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClientFinancialHealth, HEALTH_BADGE } from '@/hooks/useClientFinancialHealth';

export function ClientFinancialHealthCard({ clientName }: { clientName: string }) {
  const { getHealth } = useClientFinancialHealth();
  const health = getHealth(clientName);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Saúde Financeira</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className={`text-sm px-3 py-1 ${HEALTH_BADGE[health.status]?.className || ''}`}>
            {health.label}
          </Badge>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-medium">{health.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pagos: </span>
              <span className="font-medium text-success">{health.paid}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pendentes: </span>
              <span className="font-medium">{health.pending}</span>
            </div>
            {health.overdue > 0 && (
              <div>
                <span className="text-muted-foreground">Em atraso: </span>
                <span className="font-medium text-destructive">{health.overdue}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}