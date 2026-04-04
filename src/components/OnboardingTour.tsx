import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  requireModule?: string;
  ownerOnly?: boolean;
}

const ALL_STEPS: TourStep[] = [
  { title: 'Bem-vindo à sua plataforma!', description: 'Vamos fazer um tour rápido para conhecer as áreas principais. Demora menos de 1 minuto.', icon: '🎉' },
  { title: 'Secretária — o seu dia-a-dia', description: 'Aqui encontra as tarefas do dia, reuniões, agenda e tudo o que precisa para organizar o seu trabalho. É a sua "mesa de trabalho" digital.', icon: '🗂️' },
  { title: 'Hub — a central de recursos', description: 'Projetos, reuniões, tarefas, processos e biblioteca. Tudo o que a equipa precisa, organizado num só lugar.', icon: '🏠' },
  { title: 'Marketing', description: 'Estratégia de conteúdo, canais, calendário editorial e métricas de desempenho dos seus canais de comunicação.', icon: '📣', requireModule: 'marketing' },
  { title: 'Comercial', description: 'Pipeline de vendas, CRM, metas comerciais e biblioteca de estratégias. Tudo para gerir o processo de vendas.', icon: '🛒', requireModule: 'comercial' },
  { title: 'Clientes', description: 'Gestão de clientes, onboarding, feedback e portal do cliente. Acompanhe todo o ciclo de vida.', icon: '👤', requireModule: 'clientes' },
  { title: 'Contabilidade', description: 'Entradas, saídas, balanço mensal, IVA e documentos fiscais. A saúde financeira do negócio.', icon: '💰', requireModule: 'financeiro' },
  { title: 'Operação', description: 'Gestão operacional do dia-a-dia, processos e entregáveis dos seus produtos.', icon: '🎧', requireModule: 'operacao' },
  { title: 'Produtos', description: 'Catálogo de produtos, KPIs, métricas de sucesso e calculadora de oferta.', icon: '📦', requireModule: 'produtos' },
  { title: 'Recursos Humanos', description: 'Gestão de equipa, escalas, ausências, desempenho e desenvolvimento profissional.', icon: '👥', requireModule: 'recursos-humanos' },
  { title: 'Sala Executiva', description: 'Visão geral do negócio: planeamento, produtividade, capacidade, KPIs e alinhamento semanal.', icon: '👑', ownerOnly: true },
  { title: 'Definições', description: 'Configure o nome do negócio, cores, utilizadores, digestos e KPIs. Tudo personalizável ao seu gosto.', icon: '⚙️', ownerOnly: true },
  { title: 'Está pronto!', description: 'Explore à vontade. Pode sempre aceder a qualquer secção pelo menu lateral. Se precisar de ajuda, estamos aqui.', icon: '🚀' },
];

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const { user, isOwner } = useAuth();
  const { canAccess, loading: permLoading } = usePermissions();

  const steps = useMemo(() => {
    if (permLoading) return [];
    return ALL_STEPS.filter((s) => {
      if (s.ownerOnly && !isOwner) return false;
      if (s.requireModule && !isOwner && !canAccess(s.requireModule)) return false;
      return true;
    });
  }, [isOwner, canAccess, permLoading]);

  // Check DB for onboarding_completed
  useEffect(() => {
    if (permLoading || !user?.id || steps.length === 0) return;
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
  }, [permLoading, user?.id, steps.length]);

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
        <div className="flex justify-center gap-1.5 pb-4">
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
