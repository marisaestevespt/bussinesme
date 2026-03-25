import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStep {
  title: string;
  description: string;
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Bem-vindo à sua plataforma!',
    description: 'Vamos fazer um tour rápido para conhecer as áreas principais. Demora menos de 1 minuto.',
    icon: '🎉',
  },
  {
    title: 'Secretária — o seu dia-a-dia',
    description: 'Aqui encontra as tarefas do dia, reuniões, agenda e tudo o que precisa para organizar o seu trabalho. É a sua "mesa de trabalho" digital.',
    icon: '🗂️',
  },
  {
    title: 'Hub — a central de recursos',
    description: 'Projetos, reuniões, tarefas, processos e biblioteca. Tudo o que a equipa precisa, organizado num só lugar.',
    icon: '🏠',
  },
  {
    title: 'Departamentos',
    description: 'Cada departamento (Marketing, Comercial, Clientes, Financeiro, etc.) tem o seu espaço dedicado com métricas, processos e ferramentas específicas.',
    icon: '🏢',
  },
  {
    title: 'Sala Executiva',
    description: 'Visão geral do negócio: planeamento, produtividade, capacidade, KPIs e alinhamento semanal. Tudo para tomar decisões informadas.',
    icon: '👑',
  },
  {
    title: 'Definições',
    description: 'Configure o nome do negócio, cores, utilizadores, digestos e KPIs. Tudo personalizável ao seu gosto.',
    icon: '⚙️',
  },
  {
    title: 'Está pronto!',
    description: 'Explore à vontade. Pode sempre aceder a qualquer secção pelo menu lateral. Se precisar de ajuda, estamos aqui.',
    icon: '🚀',
  },
];

const TOUR_STORAGE_KEY = 'onboarding_tour_completed';

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if tour was already completed
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Small delay so the app renders first
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={completeTour}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6 text-center space-y-4">
          <div className="text-5xl">{step.icon}</div>
          <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            {step.description}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 pb-4">
          {TOUR_STEPS.map((_, i) => (
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

        {/* Actions */}
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
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Começar
                </>
              ) : (
                <>
                  Seguinte <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
