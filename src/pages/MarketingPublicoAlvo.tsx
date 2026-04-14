import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ─── NAV STRUCTURE ─────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Visão Geral',
    items: [
      { id: 'definicao', label: 'Definição central' },
      { id: 'personas', label: '3 Personas' },
      { id: 'mapa-mental', label: 'Mapa mental' },
    ],
  },
  {
    label: 'Psicografia',
    items: [
      { id: 'niveis-consciencia', label: 'Níveis de consciência' },
      { id: 'nivel-comprador', label: 'Nível de comprador' },
      { id: 'jornada-emocional', label: 'Jornada emocional' },
    ],
  },
  {
    label: 'Dores e Desejos',
    items: [
      { id: 'dores', label: 'Dores e frustrações' },
      { id: 'desejos', label: 'Desejos e sonhos' },
      { id: 'tentaram', label: 'O que já tentaram' },
    ],
  },
  {
    label: 'Decisão de Compra',
    items: [
      { id: 'objecoes', label: 'Objeções detalhadas' },
      { id: 'triggers', label: 'Triggers de compra' },
      { id: 'anti-persona', label: 'Anti-persona' },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { id: 'linguagem', label: 'Linguagem do público' },
      { id: 'frases', label: 'Frases para conteúdo' },
      { id: 'investigar', label: 'O que falta investigar' },
    ],
  },
];

const ALL_SECTIONS = NAV_GROUPS.flatMap(g => g.items);

const SECTIONS_META: Record<string, { num: string; title: string; subtitle?: string }> = {
  'definicao': { num: '01', title: 'Definição Central do Público-Alvo', subtitle: 'Uma síntese clara de quem é o teu cliente ideal — a base de toda a estratégia de comunicação e oferta.' },
  'personas': { num: '02', title: '3 Personas Principais', subtitle: 'Perfis detalhados que representam os segmentos mais relevantes do teu público.' },
  'mapa-mental': { num: '03', title: 'Mapa Mental do Público', subtitle: 'Visão panorâmica das conexões entre dores, desejos, crenças e comportamentos.' },
  'niveis-consciencia': { num: '04', title: 'Níveis de Consciência', subtitle: 'Onde se encontra o teu público no espectro de consciência do problema e da solução.' },
  'nivel-comprador': { num: '05', title: 'Nível de Comprador', subtitle: 'Maturidade e disposição do público para investir na solução.' },
  'jornada-emocional': { num: '06', title: 'Jornada Emocional', subtitle: 'As fases emocionais que o público atravessa desde a consciência até à decisão.' },
  'dores': { num: '07', title: 'Dores e Frustrações', subtitle: 'As dificuldades reais, verbalizadas e sentidas pelo teu público.' },
  'desejos': { num: '08', title: 'Desejos e Sonhos', subtitle: 'O que o teu público realmente quer alcançar — o estado ideal.' },
  'tentaram': { num: '09', title: 'O que Já Tentaram', subtitle: 'Soluções anteriores que não funcionaram e porquê.' },
  'objecoes': { num: '10', title: 'Objeções Detalhadas', subtitle: 'As resistências mais comuns à decisão de compra e como responder a cada uma.' },
  'triggers': { num: '11', title: 'Triggers de Compra', subtitle: 'Os momentos e gatilhos que levam à decisão de comprar.' },
  'anti-persona': { num: '12', title: 'Anti-Persona', subtitle: 'Quem NÃO é o teu cliente — igualmente importante para filtrar comunicação.' },
  'linguagem': { num: '13', title: 'Linguagem do Público', subtitle: 'Palavras, expressões e tom que o teu público usa e reconhece.' },
  'frases': { num: '14', title: 'Frases para Conteúdo', subtitle: 'Frases prontas a usar em copy, posts, emails e páginas de venda.' },
  'investigar': { num: '15', title: 'O que Falta Investigar', subtitle: 'Perguntas em aberto para aprofundar com entrevistas, inquéritos ou dados.' },
};

// ─── COMPONENT ─────────────────────────────────────────────────
export default function MarketingPublicoAlvo() {
  const [activeSection, setActiveSection] = useState('definicao');

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 }
    );
    ALL_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Mapa de Público-Alvo" subtitle="Personas, dores, desejos e comunicação estratégica." />

        <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          {/* ═══ STICKY ANCHOR NAV ═══ */}
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm border-b">
            <ScrollArea className="w-full">
              <div className="flex items-center gap-1">
                {NAV_GROUPS.map((group, gi) => (
                  <div key={group.label} className="flex items-center gap-1">
                    {gi > 0 && <div className="w-px h-5 bg-border mx-1 shrink-0" />}
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => scrollTo(item.id)}
                        className={cn(
                          'whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md hq-transition shrink-0',
                          activeSection === item.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>
          </div>

          {/* ═══ HERO CARD ═══ */}
          <Card className="overflow-hidden border-none shadow-md">
            <CardContent className="p-8 sm:p-10 bg-primary/5">
              <p className="text-[10px] uppercase tracking-[3px] text-primary/60 mb-3">MAPA ESTRATÉGICO</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-3">
                Quem é a pessoa que precisamos de servir
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[600px]">
                Este documento reúne toda a inteligência sobre o público-alvo, atualizado com cada nova conversa, entrevista ou dado recolhido.
              </p>
              <div className="border-t border-border pt-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { value: '3', label: 'Personas' },
                  { value: '5', label: 'Níveis' },
                  { value: '12+', label: 'Objeções mapeadas' },
                  { value: '7', label: 'Conversas analisadas' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ═══ ALL SECTIONS ═══ */}
          <div className="space-y-12">
            {ALL_SECTIONS.map(section => {
              const meta = SECTIONS_META[section.id];
              return (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <p className="text-[10px] uppercase tracking-[2.5px] font-medium text-primary mb-1.5">
                    {meta.num} · {section.label}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mb-2">
                    {meta.title}
                  </h3>
                  <div className="w-10 h-0.5 bg-primary mb-4" />
                  {meta.subtitle && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[680px]">
                      {meta.subtitle}
                    </p>
                  )}
                  <SectionContent sectionId={section.id} />
                </section>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">
              Documento vivo · atualizar a cada nova entrevista ou reunião
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── SECTION PLACEHOLDERS ──────────────────────────────────────

function SectionContent({ sectionId }: { sectionId: string }) {
  switch (sectionId) {
    case 'definicao':
      return (
        <div className="space-y-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Resumo do público-alvo — a completar com conteúdo.</p></CardContent></Card>
          <NoteBox>Nota: completar com dados das entrevistas mais recentes.</NoteBox>
        </div>
      );
    case 'personas':
      return (
        <div className="grid grid-cols-1 gap-4">
          {['A', 'B', 'C'].map(letter => <PersonaCard key={letter} letter={letter} />)}
        </div>
      );
    case 'mapa-mental':
      return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Mapa mental visual — adicionar diagrama ou imagem.</p></CardContent></Card>;
    case 'niveis-consciencia':
      return <div className="space-y-0">{[1,2,3,4,5].map(n => <LevelRow key={n} num={n} />)}</div>;
    case 'nivel-comprador':
      return <div className="space-y-0">{[1,2,3,4].map(n => <LevelRow key={n} num={n} />)}</div>;
    case 'jornada-emocional':
      return <div className="relative">{[1,2,3,4,5].map((n,i,a) => <JourneyStep key={n} num={n} isLast={i===a.length-1} />)}</div>;
    case 'dores':
      return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4,5,6].map(n => <AccentCard key={n} variant="destructive" />)}</div>;
    case 'desejos':
      return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(n => <AccentCard key={n} variant="success" />)}</div>;
    case 'tentaram':
      return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(n => <AccentCard key={n} variant="warning" />)}</div>;
    case 'objecoes':
      return <div className="space-y-3">{[1,2,3,4].map(n => <ObjectionCard key={n} />)}</div>;
    case 'triggers':
      return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(n => <Card key={n}><CardContent className="p-4"><div className="h-10 rounded bg-muted/50" /></CardContent></Card>)}</div>;
    case 'anti-persona':
      return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2].map(n => <AntiPersonaCard key={n} />)}</div>;
    case 'linguagem':
      return <div className="space-y-0">{[1,2,3,4,5].map(n => <BarChartRow key={n} idx={n} />)}</div>;
    case 'frases':
      return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(n => <PhraseCard key={n} />)}</div>;
    case 'investigar':
      return (
        <div className="space-y-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Lista de perguntas em aberto — a completar.</p></CardContent></Card>
          <NoteBox>Recolher feedback na próxima ronda de entrevistas.</NoteBox>
        </div>
      );
    default:
      return null;
  }
}

// ─── CARD COMPONENTS (using design system) ─────────────────────

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed bg-accent/10 border-l-[3px] border-accent text-accent-foreground">
      {children}
    </div>
  );
}

function PersonaCard({ letter }: { letter: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 flex items-center gap-4 bg-primary/5">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-lg font-semibold text-primary-foreground">
          {letter}
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">Persona {letter}</p>
          <p className="text-xs text-muted-foreground">Título / Cargo — a definir</p>
        </div>
      </div>
      <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Quem é</p>
          <div className="h-12 rounded bg-muted/50" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Dores principais</p>
          <div className="h-12 rounded bg-muted/50" />
        </div>
      </CardContent>
    </Card>
  );
}

function AccentCard({ variant }: { variant: 'destructive' | 'success' | 'warning' }) {
  const styles = {
    destructive: 'bg-destructive/5 border-l-[3px] border-destructive',
    success: 'bg-accent/5 border-l-[3px] border-accent',
    warning: 'bg-secondary/10 border-l-[3px] border-secondary',
  };
  return (
    <Card className={cn('overflow-hidden', styles[variant])}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-foreground mb-2">Título — a preencher</p>
        <div className="h-8 rounded bg-muted/30" />
      </CardContent>
    </Card>
  );
}

function ObjectionCard() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4 bg-destructive/5">
        <p className="text-sm font-semibold text-destructive">"Objeção — a preencher"</p>
      </div>
      <CardContent className="p-4 border-t">
        <p className="text-xs text-muted-foreground">Resposta à objeção — a completar.</p>
      </CardContent>
    </Card>
  );
}

function AntiPersonaCard() {
  return (
    <Card className="overflow-hidden bg-destructive/5 border-destructive/20">
      <CardContent className="p-5">
        <p className="text-sm font-bold text-destructive mb-2">Anti-persona — a definir</p>
        <p className="text-xs text-destructive/80">Descrição do perfil que NÃO é o teu cliente.</p>
      </CardContent>
    </Card>
  );
}

function PhraseCard() {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
          TIPO
        </span>
        <p className="mt-3 text-[15px] font-semibold leading-snug text-foreground">
          "Frase de exemplo — a preencher"
        </p>
        <p className="mt-2 text-[11px] italic text-muted-foreground">Porquê funciona — a completar.</p>
      </CardContent>
    </Card>
  );
}

function LevelRow({ num }: { num: number }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b">
      <span className="shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {num}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Nível {num} — a definir</p>
        <p className="text-xs text-muted-foreground mt-1">Descrição do nível — a completar.</p>
        <p className="text-xs italic text-muted-foreground/70 mt-1">"Exemplo de frase do público neste nível"</p>
      </div>
    </div>
  );
}

function JourneyStep({ num, isLast }: { num: number; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          {num}
        </span>
        {!isLast && <div className="w-px flex-1 min-h-[40px] border-l-2 border-dashed border-border" />}
      </div>
      <div className="flex-1 pb-6 min-w-0">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-1">Fase {num} — a definir</p>
            <p className="text-xs text-muted-foreground">Descrição da fase emocional — a completar.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BarChartRow({ idx }: { idx: number }) {
  const pct = [75, 60, 85, 45, 55][idx - 1] || 50;
  return (
    <div className="flex items-center gap-4 py-2.5 border-b">
      <span className="text-xs font-medium w-[200px] truncate text-foreground">Palavra-chave — a definir</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">{pct}%</span>
    </div>
  );
}
