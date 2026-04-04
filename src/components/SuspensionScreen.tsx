import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function SuspensionScreen() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Acesso Suspenso</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O acesso a esta plataforma foi temporariamente suspenso devido a um pagamento em atraso.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Assim que o pagamento for regularizado, o acesso será restabelecido automaticamente.
            </p>
          </div>
          <div className="pt-2 space-y-3">
            <a
              href="mailto:suporte@lirah.pt"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 w-full"
            >
              Contactar Suporte
            </a>
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full text-muted-foreground">
              Terminar Sessão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
