import { Section, InfoCard } from './shared';

const ITEMS = [
  { title: 'Decisão de compra — como funciona', text: 'Como tomam a decisão? Quem envolve? Quanto tempo entre "interesse" e "sim"? O que precisa acontecer para fechar?' },
  { title: 'Pós-delegação bem-sucedida', text: 'As que já delegaram bem — o que foi diferente? O que mudou no negócio? Como foi a experiência emocional de largar?' },
  { title: 'Outros setores não representados', text: 'Advogadas, nutricionistas, contabilistas, agências de marketing, coaches. As dores mudam substancialmente por setor?' },
  { title: 'Momento de rutura com o Notion', text: 'Quais os momentos específicos em que o Notion "partiu"? O que estava a tentar fazer quando percebeu que não chegava?' },
  { title: 'Relação com o preço', text: 'Qual o intervalo percebido como razoável para consultoria de 3-6 meses com sistema incluído? Quais as âncoras de comparação espontâneas?' },
  { title: 'Influência de outras mentoras', text: 'Quem seguem e confiam? O que faz confiar? Mapear o ecossistema de influência do público-alvo.' },
];

export function SectionInvestigar() {
  return (
    <Section id="investigar" num="15" label="O que falta investigar" title="Próximas entrevistas — o que aprofundar">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ITEMS.map(item => <InfoCard key={item.title} title={item.title} text={item.text} />)}
      </div>
    </Section>
  );
}
