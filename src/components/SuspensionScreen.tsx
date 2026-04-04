import { ShieldX, MessageCircle } from 'lucide-react';
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
              href="https://wa.link/s6w2z1"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md h-10 px-6 w-full"
            >
              <MessageCircle className="h-4 w-4" />
              Regularizar Pagamento
            </a>
            <a
              href="https://wa.me/351910000000?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20meu%20acesso."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 border border-input bg-background hover:bg-accent/50 hover:text-accent-foreground hover:border-accent h-10 px-6 w-full"
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
