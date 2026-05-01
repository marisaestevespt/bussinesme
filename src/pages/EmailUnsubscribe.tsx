import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";

type State =
  | { kind: "validating" }
  | { kind: "ready"; email: string }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function EmailUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Link de cancelamento inválido." });
      return;
    }
    (async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: supabaseAnonKey } },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.email) {
          setState({ kind: "ready", email: data.email });
        } else if (data?.reason === "already_used") {
          setState({ kind: "already" });
        } else {
          setState({
            kind: "invalid",
            message: data?.error || "Não foi possível validar o link.",
          });
        }
      } catch (err: any) {
        setState({ kind: "invalid", message: err?.message || "Erro de rede." });
      }
    })();
  }, [token]);

  async function confirmUnsubscribe() {
    setState({ kind: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } },
      );
      if (error) throw error;
      if ((data as any)?.success) {
        setState({ kind: "success" });
      } else {
        setState({
          kind: "error",
          message: (data as any)?.error || "Não foi possível cancelar.",
        });
      }
    } catch (err: any) {
      setState({ kind: "error", message: err?.message || "Erro ao cancelar." });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8 hq-card">
        {state.kind === "validating" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">A validar o link…</p>
          </div>
        )}

        {state.kind === "ready" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <MailX className="h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">Cancelar subscrição</h1>
            <p className="text-sm text-muted-foreground">
              Vais deixar de receber emails enviados para{" "}
              <span className="font-medium text-foreground">{state.email}</span>.
            </p>
            <Button onClick={confirmUnsubscribe} className="w-full mt-2">
              Confirmar cancelamento
            </Button>
          </div>
        )}

        {state.kind === "submitting" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">A processar…</p>
          </div>
        )}

        {state.kind === "success" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">Subscrição cancelada</h1>
            <p className="text-sm text-muted-foreground">
              Não vais voltar a receber emails desta lista. Podes fechar esta página.
            </p>
          </div>
        )}

        {state.kind === "already" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Já estás cancelado</h1>
            <p className="text-sm text-muted-foreground">
              Esta subscrição já tinha sido cancelada.
            </p>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold">Link inválido</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold">Algo correu mal</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button variant="outline" onClick={confirmUnsubscribe}>
              Tentar de novo
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
