import { Section, AccentCard, Quote } from './shared';

const BAR_DATA = [
  { label: 'Processos só na cabeça dela', count: 7, total: 7, color: 'coral' as const },
  { label: 'Ferramentas dispersas', count: 6, total: 7, color: 'coral' as const },
  { label: 'Comunicação equipa passa por ela', count: 5, total: 7, color: 'coral' as const },
  { label: 'CRM sem alertas / follow-up manual', count: 5, total: 7, color: 'coral' as const },
  { label: 'Financeiro manual / sem visibilidade', count: 5, total: 7, color: 'coral' as const },
  { label: 'Delegação que correu mal', count: 5, total: 7, color: 'amber' as const },
  { label: 'Não saber capacidade real da equipa', count: 4, total: 7, color: 'amber' as const },
  { label: 'Relatórios feitos à mão', count: 4, total: 7, color: 'amber' as const },
  { label: 'Resistência emocional à delegação', count: 3, total: 7, color: 'gray' as const },
  { label: 'Faturação sazonal / quebras de receita', count: 2, total: 7, color: 'gray' as const },
];

const BAR_COLORS = {
  coral: 'bg-primary',
  amber: 'bg-amber-500',
  gray: 'bg-muted-foreground',
};

const DORES = [
  { color: 'coral' as const, title: 'Dor #1 — Tudo na cabeça', text: 'O bloqueio universal. Não pode delegar. O negócio para quando ela para. Cada vez que entra alguém novo precisa de explicar tudo de novo.', quote: '"Do meu lado está, diria, mais de 90% na cabeça."' },
  { color: 'blue' as const, title: 'Dor #2 — Ferramentas que não comunicam', text: 'Notion + Google Sheets + Trello + Excel + papel. Para ter a visão completa precisa de abrir tudo. Dados duplicados, inconsistentes, perdidos.', quote: '"Temos o CRM em dois sítios. Não sei bem para onde virar."' },
  { color: 'purple' as const, title: 'Dor #3 — Ser o centro de tudo', text: 'Qualquer comunicação entre membros da equipa passa por ela. Não porque desconfie — porque não há canal direto. Ela é a ponte entre designer e copywriter.', quote: '"Uma coisa que podia demorar 10 minutos, demorava uma hora."' },
  { color: 'amber' as const, title: 'Dor #4 — CRM sem memória', text: 'As leads entram mas não há sistema que avise quando é hora de follow-up. Vai verificar manualmente — quando se lembra. Muitas oportunidades morrem em silêncio.', quote: '"Não me caem alertas. Vou lá verificar, mas às vezes a lead já arrefeceu."' },
  { color: 'green' as const, title: 'Dor #5 — Financeiro às escuras', text: 'Sabe que faturou bem mas não sabe exatamente quanto nem porquê. Para ver os números tem de somar tudo à mão. Já faltou a prazos fiscais por não ter alertas.', quote: '"Tenho de somar faturinha à faturinha. Quero olhar ao trimestre e perceber o que se passa."' },
  { color: 'red' as const, title: 'Dor #6 — Delegação que queima', text: 'Já tentou delegar e correu mal — copy com voz errada, gestora de redes que baixou a performance. Isso criou resistência e medo de voltar a tentar.', quote: '"Quando voltei a assumir os meus conteúdos, no primeiro mês tive 10 contactos — não tive 3 em 5 meses."' },
];

export function SectionDores() {
  return (
    <Section id="dores" num="07" label="Dores e frustrações" title="O estado 'mau' — o que a mantém acordada">
      <div className="space-y-0 mb-6">
        {BAR_DATA.map(b => {
          const pct = Math.round((b.count / b.total) * 100);
          return (
            <div key={b.label} className="flex items-center gap-4 py-2.5 border-b">
              <span className="text-xs font-medium w-[200px] truncate text-foreground">{b.label}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                <div className={`h-full rounded-full ${BAR_COLORS[b.color]}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{b.count}/{b.total}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DORES.map(d => (
          <AccentCard key={d.title} color={d.color} title={d.title}>
            <p className="text-xs text-foreground leading-relaxed mb-2">{d.text}</p>
            <Quote>{d.quote}</Quote>
          </AccentCard>
        ))}
      </div>
    </Section>
  );
}
