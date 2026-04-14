import { Card, CardContent } from '@/components/ui/card';
import { Section, NoteBox } from './shared';

const ITEMS = [
  { title: 'Templates de Notion', desc: 'Comprou, instalou, usou algumas semanas. Depois abandonou. Ninguém a ajudou a implementar nos processos reais do negócio. A template ficou linda e vazia.', fail: 'Faltou acompanhamento para implementação' },
  { title: 'Gestora de redes sociais', desc: 'Delegou os conteúdos, a performance caiu, a voz foi perdida. Voltou a assumir e imediatamente os resultados melhoraram. Ficou com resistência a delegar conteúdos.', fail: 'Falta de processo de briefing + voz não documentada' },
  { title: 'Ferramentas genéricas (Monday, ClickUp, Trello)', desc: 'Experimentou, achou complicado de configurar para o seu negócio específico, ou a equipa não aderiu. Acabou por voltar ao Notion ou ao Excel.', fail: 'Genéricas demais, sem contexto do negócio de serviços' },
  { title: 'Estagiários sem processo', desc: 'Contratou sem nada documentado. A pessoa saiu após meses ou fez as coisas à sua maneira. O investimento não compensou.', fail: 'Onboarding inexistente + processos não documentados' },
  { title: 'Mentoria de lançamentos', desc: 'Melhorou as vendas mas não a operação. Mais clientes com a mesma desorganização = mais caos. O crescimento tornou-se insustentável.', fail: 'Problema de operação não é problema de marketing' },
  { title: 'Automações avulsas (Zapier, Make)', desc: 'Resolveram um problema mas criaram outros. Sem visão sistémica, ficam soltas e dependem de alguém que as mantém.', fail: 'Automações sem estrutura base não funcionam a longo prazo' },
];

export function SectionTentativas() {
  return (
    <Section id="tentaram" num="09" label="O que já tentaram" title="Soluções anteriores e porque falharam">
      <NoteBox>Ela já tentou. Não quer mais "outra coisa que não resulta". A mensagem tem de abordar o porquê de isto ser diferente.</NoteBox>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {ITEMS.map(item => (
          <Card key={item.title} className="overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-foreground mb-2">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{item.desc}</p>
              <p className="text-[11px] font-medium text-destructive">✗ {item.fail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
