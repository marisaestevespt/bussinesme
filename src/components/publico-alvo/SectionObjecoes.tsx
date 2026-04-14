import { Card, CardContent } from '@/components/ui/card';
import { Section } from './shared';

const OBJS = [
  { q: 'É caro. Não sei se compensa.', a: 'Comparar com o custo real do caos: 6-8h/semana em admin = +300h/ano. Mais as ferramentas já pagas, os clientes perdidos, as contratações sem processo que não resultaram. O preço da consultoria não é uma despesa — é o fim de um ciclo de custos invisíveis.' },
  { q: 'Já investi em coisas assim e não resultou.', a: 'A diferença está no acompanhamento. Ela comprou templates e ferramentas — que são produtos, não processos. A consultoria começa por perceber como o negócio dela funciona na prática. Não é uma ferramenta entregue — é um processo co-criado ao longo de meses, no dia-a-dia do negócio dela.' },
  { q: 'Não tenho tempo para implementar mais uma coisa.', a: 'O processo é desenhado para não parar o negócio. O acompanhamento acontece em paralelo com o dia-a-dia. O tempo investido no início recupera-se nas primeiras semanas. A questão não é \'tenho tempo para isto\' — é \'posso continuar a perder tempo do jeito que estou a perder\'.' },
  { q: 'O meu negócio é diferente, não sei se se aplica.', a: 'A estrutura operacional adapta-se ao tipo de negócio — é por isso que começa com diagnóstico. Uma psicóloga, uma agência de redes sociais e uma instrutora têm bases diferentes. O sistema é desenhado à volta de como ela trabalha — não de um template genérico.' },
  { q: 'Prefiro o Notion — já tenho tudo lá.', a: 'O problema não é o Notion. É que os processos não estão documentados, as automações são limitadas, e não há integração real entre departamentos. A consultoria trabalha os processos independentemente da ferramenta — e o sistema resolve o que o Notion não consegue.' },
  { q: 'Não sei se estou pronta para este passo.', a: 'A sensação de \'não estar pronta\' é, muitas vezes, o sinal de que está. \'Pronta\' não significa ter tudo organizado — significa ter a vontade de mudar. A consultoria começa onde ela está, não onde deveria estar.' },
  { q: 'E se o sistema não funcionar para mim?', a: 'O sistema é configurado durante a consultoria — não antes. A implementação acontece em conjunto, com sessões de validação antes de qualquer acesso ser dado. O sistema é testado no negócio dela, com os seus processos reais, antes de ser entregue.' },
];

export function SectionObjecoes() {
  return (
    <Section id="objecoes" num="10" label="Objeções detalhadas" title="O que a impede de avançar">
      <div className="space-y-3">
        {OBJS.map((o, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="p-4 bg-destructive/5">
              <p className="text-sm font-semibold text-destructive">"{o.q}"</p>
            </div>
            <CardContent className="p-4 border-t">
              <p className="text-xs text-muted-foreground leading-relaxed">{o.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
