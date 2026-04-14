import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { cn } from '@/lib/utils';

// ─── NAV STRUCTURE ─────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'VISÃO GERAL',
    items: [
      { id: 'definicao', label: 'Definição central' },
      { id: 'personas', label: '3 Personas' },
      { id: 'mapa-mental', label: 'Mapa mental' },
    ],
  },
  {
    label: 'PSICOGRAFIA',
    items: [
      { id: 'niveis-consciencia', label: 'Níveis de consciência' },
      { id: 'nivel-comprador', label: 'Nível de comprador' },
      { id: 'jornada-emocional', label: 'Jornada emocional' },
    ],
  },
  {
    label: 'DORES E DESEJOS',
    items: [
      { id: 'dores', label: 'Dores e frustrações' },
      { id: 'desejos', label: 'Desejos e sonhos' },
      { id: 'tentaram', label: 'O que já tentaram' },
    ],
  },
  {
    label: 'DECISÃO DE COMPRA',
    items: [
      { id: 'objecoes', label: 'Objeções detalhadas' },
      { id: 'triggers', label: 'Triggers de compra' },
      { id: 'anti-persona', label: 'Anti-persona' },
    ],
  },
  {
    label: 'COMUNICAÇÃO',
    items: [
      { id: 'linguagem', label: 'Linguagem do público' },
      { id: 'frases', label: 'Frases para conteúdo' },
      { id: 'investigar', label: 'O que falta investigar' },
    ],
  },
];

const ALL_SECTIONS = NAV_GROUPS.flatMap(g => g.items);

// ─── SECTION DATA ──────────────────────────────────────────────
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

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
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
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
      setSidebarOpen(false);
    }
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <div className="px-4 pt-4 pb-2 max-w-[1280px] mx-auto w-full">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />
        </div>

        <div className="flex flex-1 relative">
          {/* ═══ Mobile hamburger ═══ */}
          <button
            className="lg:hidden fixed top-20 left-3 z-50 h-10 w-10 rounded-lg flex items-center justify-center shadow-md"
            style={{ background: '#6e1f2b' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><rect y="0" width="18" height="2" rx="1" fill="#f2e9de"/><rect y="6" width="18" height="2" rx="1" fill="#f2e9de"/><rect y="12" width="18" height="2" rx="1" fill="#f2e9de"/></svg>
          </button>

          {/* ═══ SIDEBAR ═══ */}
          <aside
            className={cn(
              'w-[260px] shrink-0 fixed top-0 left-0 h-screen z-40 overflow-y-auto transition-transform lg:sticky lg:top-0 lg:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
            style={{ background: '#6e1f2b' }}
          >
            {/* Overlay for mobile */}
            {sidebarOpen && (
              <div className="fixed inset-0 bg-black/40 lg:hidden -z-10" onClick={() => setSidebarOpen(false)} />
            )}

            <div className="p-6 pt-8">
              <p className="text-[11px] uppercase tracking-[3px] mb-1" style={{ color: '#f2e9de99' }}>Business ME</p>
              <h1 className="text-lg leading-tight mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#f2e9de', fontWeight: 600 }}>
                Mapa de Público-Alvo
              </h1>
              <p className="text-[10px]" style={{ color: '#f2e9de66' }}>v1 · Abril 2026 · 7 conversas</p>
            </div>

            <nav className="px-4 pb-6 space-y-5">
              {NAV_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-[2.5px] mb-2 px-2" style={{ color: '#f2e9de55', fontWeight: 500 }}>
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => scrollTo(item.id)}
                          className={cn(
                            'w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-all',
                            isActive && 'border-l-2'
                          )}
                          style={{
                            color: isActive ? '#f2e9de' : '#f2e9deb3',
                            background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                            borderColor: isActive ? '#D85A30' : 'transparent',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isActive ? '#D85A30' : '#f2e9de55' }} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="px-6 pb-6 mt-auto">
              <p className="text-[10px] leading-relaxed" style={{ color: '#f2e9de44' }}>
                Documento vivo · atualizar a cada nova entrevista ou reunião
              </p>
            </div>
          </aside>

          {/* ═══ MAIN CONTENT ═══ */}
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto min-h-screen"
            style={{ background: '#faf8f4' }}
          >
            <div className="max-w-[960px] mx-auto px-6 sm:px-10 lg:px-12 py-10">

              {/* Update badge */}
              <div className="mb-8">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full"
                  style={{ background: '#FAEEDA', color: '#854F0B' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#854F0B' }} />
                  Versão 1 — a afinar com novas entrevistas
                </span>
              </div>

              {/* ═══ HERO ═══ */}
              <div className="rounded-2xl p-8 sm:p-10 mb-12" style={{ background: '#6e1f2b' }}>
                <p className="text-[10px] uppercase tracking-[3px] mb-3" style={{ color: '#f2e9de77' }}>
                  MAPA ESTRATÉGICO
                </p>
                <h2 className="text-2xl sm:text-4xl leading-tight mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#f2e9de', fontWeight: 600 }}>
                  Quem é a pessoa que precisamos de servir
                </h2>
                <p className="text-sm leading-relaxed mb-8 max-w-[600px]" style={{ color: '#f2e9de99' }}>
                  Este documento reúne toda a inteligência sobre o público-alvo, atualizado com cada nova conversa, entrevista ou dado recolhido.
                </p>
                <div className="border-t pt-5 grid grid-cols-2 sm:grid-cols-4 gap-6" style={{ borderColor: '#f2e9de22' }}>
                  {[
                    { value: '3', label: 'Personas' },
                    { value: '5', label: 'Níveis' },
                    { value: '12+', label: 'Objeções mapeadas' },
                    { value: '7', label: 'Conversas analisadas' },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p className="text-2xl sm:text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#f2e9de', fontWeight: 600 }}>{stat.value}</p>
                      <p className="text-[11px] mt-1" style={{ color: '#f2e9de66' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ═══ ALL SECTIONS ═══ */}
              {ALL_SECTIONS.map(section => {
                const meta = SECTIONS_META[section.id];
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="mb-16 scroll-mt-8"
                  >
                    {/* Eyebrow */}
                    <p className="text-[10px] uppercase tracking-[2.5px] font-medium mb-1.5" style={{ color: '#D85A30' }}>
                      {meta.num} · {section.label}
                    </p>
                    {/* Title */}
                    <h3 className="text-2xl sm:text-[28px] leading-tight mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#6e1f2b', fontWeight: 600 }}>
                      {meta.title}
                    </h3>
                    {/* Divider */}
                    <div className="w-10 h-0.5 mb-6" style={{ background: '#D85A30' }} />
                    {/* Subtitle */}
                    {meta.subtitle && (
                      <p className="text-[13px] leading-relaxed mb-6 max-w-[680px]" style={{ color: '#73726c' }}>
                        {meta.subtitle}
                      </p>
                    )}

                    {/* Section-specific placeholder content */}
                    <SectionContent sectionId={section.id} />
                  </section>
                );
              })}
            </div>
          </main>
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
          <PlaceholderCard>
            <p className="text-sm" style={{ color: '#73726c' }}>Resumo do público-alvo — a completar com conteúdo.</p>
          </PlaceholderCard>
          <NoteBox>Nota: completar com dados das entrevistas mais recentes.</NoteBox>
        </div>
      );
    case 'personas':
      return (
        <div className="grid grid-cols-1 gap-4">
          {['A', 'B', 'C'].map(letter => (
            <PersonaCardPlaceholder key={letter} letter={letter} />
          ))}
        </div>
      );
    case 'mapa-mental':
      return (
        <PlaceholderCard>
          <p className="text-sm" style={{ color: '#73726c' }}>Mapa mental visual — adicionar diagrama ou imagem.</p>
        </PlaceholderCard>
      );
    case 'niveis-consciencia':
      return (
        <div className="space-y-0">
          {[1, 2, 3, 4, 5].map(n => (
            <LevelRow key={n} num={n} />
          ))}
        </div>
      );
    case 'nivel-comprador':
      return (
        <div className="space-y-0">
          {[1, 2, 3, 4].map(n => (
            <LevelRow key={n} num={n} />
          ))}
        </div>
      );
    case 'jornada-emocional':
      return (
        <div className="space-y-0 relative">
          {[1, 2, 3, 4, 5].map((n, i, arr) => (
            <JourneyStep key={n} num={n} isLast={i === arr.length - 1} />
          ))}
        </div>
      );
    case 'dores':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <AccentCard key={n} color="red" />
          ))}
        </div>
      );
    case 'desejos':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(n => (
            <AccentCard key={n} color="green" />
          ))}
        </div>
      );
    case 'tentaram':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(n => (
            <AccentCard key={n} color="amber" />
          ))}
        </div>
      );
    case 'objecoes':
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(n => (
            <ObjectionCard key={n} />
          ))}
        </div>
      );
    case 'triggers':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <PlaceholderCardSm key={n} />
          ))}
        </div>
      );
    case 'anti-persona':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(n => (
            <AntiPersonaCard key={n} />
          ))}
        </div>
      );
    case 'linguagem':
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(n => (
            <BarChartRow key={n} />
          ))}
        </div>
      );
    case 'frases':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(n => (
            <PhraseCard key={n} />
          ))}
        </div>
      );
    case 'investigar':
      return (
        <div className="space-y-3">
          <PlaceholderCard>
            <p className="text-sm" style={{ color: '#73726c' }}>Lista de perguntas em aberto — a completar.</p>
          </PlaceholderCard>
          <NoteBox>Recolher feedback na próxima ronda de entrevistas.</NoteBox>
        </div>
      );
    default:
      return <PlaceholderCard />;
  }
}

// ─── CARD COMPONENTS ───────────────────────────────────────────

function PlaceholderCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#fff', border: '0.5px solid #D3D1C7' }}>
      {children || <div className="h-16 rounded-lg" style={{ background: '#F1EFE8' }} />}
    </div>
  );
}

function PlaceholderCardSm({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3.5" style={{ background: '#faf8f4', border: '0.5px solid #D3D1C7' }}>
      {children || <div className="h-10 rounded" style={{ background: '#F1EFE8' }} />}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: '#E1F5EE', borderLeft: '3px solid #0F6E56', color: '#0F6E56' }}>
      {children}
    </div>
  );
}

function PersonaCardPlaceholder({ letter }: { letter: string }) {
  const colors = { A: '#D85A30', B: '#185FA5', C: '#3B6D11' };
  const bgs = { A: '#FAECE7', B: '#E6F1FB', C: '#EAF3DE' };
  const color = colors[letter as keyof typeof colors];
  const bg = bgs[letter as keyof typeof bgs];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #D3D1C7' }}>
      <div className="p-5 flex items-center gap-4" style={{ background: bg }}>
        <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold" style={{ background: color, color: '#fff', fontFamily: "'Cormorant Garamond', serif" }}>
          {letter}
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#1e1e1e' }}>Persona {letter}</p>
          <p className="text-xs" style={{ color: '#73726c' }}>Título / Cargo — a definir</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ background: '#fff' }}>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: '#73726c' }}>Quem é</p>
          <div className="h-12 rounded" style={{ background: '#F1EFE8' }} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: '#73726c' }}>Dores principais</p>
          <div className="h-12 rounded" style={{ background: '#F1EFE8' }} />
        </div>
      </div>
    </div>
  );
}

const ACCENT_COLORS = {
  red: { bg: '#FCEBEB', border: '#A32D2D', text: '#791F1F' },
  green: { bg: '#EAF3DE', border: '#3B6D11', text: '#27500A' },
  amber: { bg: '#FAEEDA', border: '#854F0B', text: '#633806' },
  blue: { bg: '#E6F1FB', border: '#185FA5', text: '#0C447C' },
  coral: { bg: '#FAECE7', border: '#D85A30', text: '#993C1D' },
};

function AccentCard({ color }: { color: keyof typeof ACCENT_COLORS }) {
  const c = ACCENT_COLORS[color];
  return (
    <div className="rounded-lg p-4" style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}>
      <p className="text-xs font-semibold mb-2" style={{ color: c.text }}>Título — a preencher</p>
      <div className="h-8 rounded" style={{ background: `${c.border}15` }} />
    </div>
  );
}

function ObjectionCard() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #D3D1C7' }}>
      <div className="p-4" style={{ background: '#FCEBEB' }}>
        <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>"Objeção — a preencher"</p>
      </div>
      <div className="p-4" style={{ background: '#fff', borderTop: '0.5px solid #D3D1C7' }}>
        <p className="text-xs" style={{ color: '#73726c' }}>Resposta à objeção — a completar.</p>
      </div>
    </div>
  );
}

function AntiPersonaCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: '#FCEBEB', border: '1px solid #F09595' }}>
      <p className="text-sm font-bold mb-2" style={{ color: '#A32D2D' }}>Anti-persona — a definir</p>
      <p className="text-xs" style={{ color: '#791F1F' }}>Descrição do perfil que NÃO é o teu cliente.</p>
    </div>
  );
}

function PhraseCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: '#fff', border: '0.5px solid #D3D1C7' }}>
      <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded" style={{ background: '#FAECE7', color: '#993C1D' }}>
        TIPO
      </span>
      <p className="mt-3 text-[15px] font-semibold leading-snug" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#6e1f2b' }}>
        "Frase de exemplo — a preencher"
      </p>
      <p className="mt-2 text-[11px] italic" style={{ color: '#73726c' }}>Porquê funciona — a completar.</p>
    </div>
  );
}

function LevelRow({ num }: { num: number }) {
  const colors = ['#D85A30', '#185FA5', '#3B6D11', '#854F0B', '#3C3489'];
  const color = colors[(num - 1) % colors.length];
  return (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: '0.5px solid #D3D1C7' }}>
      <span className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: color, color: '#fff' }}>
        {num}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#1e1e1e' }}>Nível {num} — a definir</p>
        <p className="text-xs mt-1" style={{ color: '#73726c' }}>Descrição do nível — a completar.</p>
        <p className="text-xs italic mt-1" style={{ color: '#5F5E5A' }}>"Exemplo de frase do público neste nível"</p>
      </div>
    </div>
  );
}

function JourneyStep({ num, isLast }: { num: number; isLast: boolean }) {
  const colors = ['#D85A30', '#185FA5', '#3C3489', '#854F0B', '#3B6D11'];
  const color = colors[(num - 1) % colors.length];
  return (
    <div className="flex gap-4">
      {/* Left: circle + line */}
      <div className="flex flex-col items-center">
        <span className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: color, color: '#fff' }}>
          {num}
        </span>
        {!isLast && <div className="w-px flex-1 min-h-[40px]" style={{ borderLeft: '2px dashed #D3D1C7' }} />}
      </div>
      {/* Right: card */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '0.5px solid #D3D1C7' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1e1e1e' }}>Fase {num} — a definir</p>
          <p className="text-xs" style={{ color: '#73726c' }}>Descrição da fase emocional — a completar.</p>
        </div>
      </div>
    </div>
  );
}

function BarChartRow() {
  const pct = Math.floor(Math.random() * 60) + 20;
  return (
    <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: '0.5px solid #D3D1C7' }}>
      <span className="text-xs font-medium w-[200px] truncate" style={{ color: '#1e1e1e' }}>Palavra-chave — a definir</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1EFE8' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#D85A30' }} />
      </div>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: '#FAECE7', color: '#993C1D' }}>{pct}%</span>
    </div>
  );
}
