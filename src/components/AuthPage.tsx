import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    supabase.from('business_settings').select('logo_url, business_name, login_bg_url').limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setLogoUrl(data.logo_url);
        setBusinessName(data.business_name || '');
        const bg = data.login_bg_url;
        setBgUrl(bg ? `${bg}?t=${Date.now()}` : null);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('Email enviado! Verifica a tua caixa de entrada.');
        setIsForgot(false);
      } else if (isSignUp) {
        await signUp(email, password, fullName);
        toast.success('Conta criada! Verifica o teu email.');
      } else {
        await signIn(email, password);
        toast.success('Bem-vinda de volta!');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background image */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgUrl})` }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>
      )}
      {!bgUrl && <div className="absolute inset-0 hq-surface-sunken" />}

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="hq-card p-8 shadow-xl rounded-xl border bg-card/95 backdrop-blur-sm">
          {/* Logo + Welcome */}
          <div className="mb-8 text-center space-y-3">
            {logoUrl && (
              <div className="flex justify-center">
                <img src={logoUrl} alt={businessName} className="h-14 w-auto object-contain" />
              </div>
            )}
            <div>
             <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {isForgot ? 'Recuperar palavra-passe' : isSignUp ? 'Criar conta' : 'Bem-vinda!'}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isForgot
                  ? 'Introduz o teu email para receberes o link de recuperação.'
                  : isSignUp
                    ? 'Cria a tua conta para começar.'
                    : businessName
                      ? `Entra no teu espaço ${businessName}.`
                      : 'Bem-vinda de volta ao teu sistema Lyrata®.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !isForgot && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="O teu nome"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
            </div>

            {!isForgot && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Palavra-passe</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      className="text-xs text-muted-foreground hover:text-foreground hq-transition"
                    >
                      Esqueci a palavra-passe
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A processar...' : isForgot ? 'Enviar link de recuperação' : isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {isForgot ? (
              <button
                type="button"
                onClick={() => setIsForgot(false)}
                className="text-sm text-muted-foreground hq-transition hover:text-foreground"
              >
                Voltar ao login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hq-transition hover:text-foreground"
              >
                {isSignUp ? 'Já tens conta? Entra aqui.' : 'Não tens conta? Cria uma.'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
