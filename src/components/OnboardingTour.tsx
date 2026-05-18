import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  title: string;
  description: string;
  icon: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Bem-vindo!',
    description: 'Vamos fazer um tour rápido de 30 segundos para mostrar como o sistema está organizado.',
    icon: '👋',
  },
  {
    title: 'Secretária + Hub',
    description: 'A Secretária é o teu dia-a-dia (tarefas, agenda, reuniões). O Hub é onde a equipa encontra projetos, processos e tudo o resto. Os módulos do menu lateral abrem-se conforme as permissões.',
    icon: '🗂️',
  },
  {
    title: 'Está pronto!',
    description: 'Podes explorar à vontade pelo menu lateral. Se precisares de mudar algo (nome, cores, equipa), vai a Definições.',
    icon: '🚀',
  },
];

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const { user } = useAuth();
  const steps = STEPS;

  // Check DB for onboarding_completed
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setChecked(true);
        if (!data?.onboarding_completed) {
          setTimeout(() => setIsVisible(true), 1500);
        }
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const completeTour = () => {
    setIsVisible(false);
    if (user?.id) {
      supabase
        .from('profiles')
        .update({ onboarding_completed: true } as any)
        .eq('user_id', user.id)
        .then();
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  if (!isVisible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={completeTour} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10">
          <X className="h-5 w-5" />
        </button>
        <div className="px-8 pt-8 pb-6 text-center space-y-4">
          <div className="text-5xl">{step.icon}</div>
          <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">{step.description}</p>
        </div>
        <div className="flex justify-center gap-2 pb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-8 pb-6">
          <div>
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={completeTour} className="text-muted-foreground">
                Saltar tour
              </Button>
            )}
            <Button onClick={nextStep} size="sm">
              {isLast ? (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Começar</>
              ) : (
                <>Seguinte <ArrowRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
