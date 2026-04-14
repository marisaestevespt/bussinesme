import { Card, CardContent } from '@/components/ui/card';
import { Section, AccentCard, Quote } from './shared';

const DESEJOS = [
  { color: 'teal' as const, title: 'Desejo #1 — Equipa autónoma', text: 'A equipa sabe o que fazer, consulta os processos, resolve sem perguntar. Ela não precisa de estar disponível o dia todo para o negócio funcionar.', quote: '"Não precisava de perguntar porque bastava chegar ali e confirmar que já foi feito."' },
  { color: 'purple' as const, title: 'Desejo #2 — Tudo num sítio só', text: 'Um único lugar onde está tudo — clientes, equipa, financeiro, conteúdos, CRM. Sem ter de abrir cinco ferramentas para ter a visão completa.', quote: '"Adorava que fossem buscar os dados e eu não tivesse de montar o relatório."' },
  { color: 'blue' as const, title: 'Desejo #3 — Controlo sem microgestão', text: 'Saber o que se passa no negócio sem ter de perguntar a toda a gente. Ver os KPIs, o estado dos projetos, a equipa — sem fazer reuniões de alinhamento constantes.', quote: '"Saber o que se passa no negócio sem ter de perguntar a toda a gente."' },
  { color: 'green' as const, title: 'Desejo #4 — Visão financeira clara', text: 'Dashboard que mostra receita, despesas, margem, previsão instantaneamente. Sem Excel, sem somar à mão.', quote: '"Quero olhar ao trimestre e perceber o que se passa — agora tenho de somar tudo à mão."' },
  { color: 'coral' as const, title: 'Desejo #5 — Crescer com leveza', text: 'Mais clientes sem mais horas. Saber que pode aceitar mais trabalho porque o sistema suporta — não porque vai trabalhar mais.', quote: '"Crescer sem sacrificar a minha vida. Um negócio que trabalha comigo."' },
  { color: 'amber' as const, title: 'Desejo #6 — Independência da fundadora', text: 'O negócio funcionar quando está de férias, grávida, ou simplesmente a descansar. Não precisar de estar disponível para que nada se parta.', quote: '"Não querer ter de estar sempre na internet a vender a minha imagem para sempre."' },
];

export function SectionDesejos() {
  return (
    <Section id="desejos" num="08" label="Desejos e sonhos" title="O estado 'bom' — o que ela quer sentir">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {DESEJOS.map(d => (
          <AccentCard key={d.title} color={d.color} title={d.title}>
            <p className="text-xs text-foreground leading-relaxed mb-2">{d.text}</p>
            <Quote>{d.quote}</Quote>
          </AccentCard>
        ))}
      </div>
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5 text-center">
          <p className="text-sm font-semibold text-foreground">O desejo mais profundo</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-lg mx-auto leading-relaxed">
            Sentir que o negócio trabalha com ela — não contra ela. Ter controlo real sem estar presa nele.
          </p>
        </CardContent>
      </Card>
    </Section>
  );
}
