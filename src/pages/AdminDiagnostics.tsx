import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, PlayCircle, Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

type TestRow = { test_name: string; expected: string; actual: string; passed: boolean };
type Results = {
  payment_sync: TestRow[];
  product_rename: TestRow[];
  ran_at: string;
} | null;

export default function AdminDiagnosticsPage() {
  const { isOwner, loading: authLoading } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Results>(null);

  if (authLoading) return null;
  if (!isOwner) return <Navigate to="/secretaria" replace />;

  const runTests = async () => {
    setRunning(true);
    setResults(null);
    try {
      const { data, error } = await supabase.rpc('run_e2e_tests');
      if (error) throw error;
      setResults(data as Results);
      const all = [...(data as any).payment_sync, ...(data as any).product_rename];
      const failed = all.filter((r: TestRow) => !r.passed).length;
      if (failed === 0) toast.success(`Todos os ${all.length} testes passaram ✅`);
      else toast.error(`${failed} de ${all.length} testes falharam`);
    } catch (e: any) {
      toast.error('Erro ao correr testes', { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const renderSuite = (title: string, rows: TestRow[]) => {
    const passed = rows.filter(r => r.passed).length;
    const total = rows.length;
    const allPassed = passed === total;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {allPassed ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {title}
            <Badge variant={allPassed ? 'default' : 'destructive'} className="ml-auto">
              {passed}/{total}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-2.5 rounded-md border bg-background/50"
            >
              {r.passed ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{r.test_name}</p>
                {!r.passed && (
                  <div className="mt-1 text-xs space-y-0.5">
                    <p className="text-muted-foreground">
                      Esperado: <span className="font-mono text-foreground">{r.expected}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Obtido: <span className="font-mono text-destructive">{r.actual}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Diagnóstico do Sistema"
          subtitle="Testes E2E de integridade da base de dados"
        />

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Apenas para o Owner</p>
              <p className="text-muted-foreground mt-0.5">
                Estes testes criam, alteram e eliminam dados temporários (com prefixo
                <code className="mx-1 px-1 py-0.5 rounded bg-muted text-xs">__test_</code>)
                para validar triggers de sincronização e cascata. Usa apenas em ambientes
                onde podes tolerar pequenas escritas/eliminações temporárias.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={runTests} disabled={running} size="lg" className="gap-2">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> A correr testes…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" /> Correr testes E2E
              </>
            )}
          </Button>
          {results && (
            <span className="text-xs text-muted-foreground">
              Última execução:{' '}
              {format(new Date(results.ran_at), "d 'de' MMMM, HH:mm:ss", { locale: pt })}
            </span>
          )}
        </div>

        {results && (
          <div className="grid gap-4 md:grid-cols-2">
            {renderSuite('Sincronização Despesas ↔ Pagamentos', results.payment_sync)}
            {renderSuite('Cascata de renomeação de Produtos', results.product_rename)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}