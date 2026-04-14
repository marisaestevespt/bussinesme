import { Card, CardContent } from '@/components/ui/card';
import { Section, NoteBox, Quote } from './shared';

const TRIGGERS = [
  { num: 1, title: 'Urgência de vida pessoal', text: 'Gravidez, licença de maternidade, doença — qualquer evento que force a pensar \'e se eu não puder estar?\' Cria urgência real e imediata.', quote: '"Tenho até Junho para ter isto tudo organizado antes da licença."' },
  { num: 2, title: 'Nova contratação ou entrada na equipa', text: 'Quando entra alguém novo e ela percebe que não tem nada para lhe dar. Ou quando a pessoa entra e as coisas começam a correr mal por falta de processos.' },
  { num: 3, title: 'Lançamento ou projeto grande iminente', text: 'Um lançamento que exige coordenação de equipa, ou um cliente grande que chega e a estrutura não aguenta.' },
  { num: 4, title: 'Cliente perdido ou oportunidade que escapou', text: 'O custo do caos torna-se concreto — uma renovação esquecida, uma proposta que não foi enviada a tempo.' },
  { num: 5, title: 'Recomendação de alguém de confiança', text: 'Mentora, colega ou amiga que experimentou e recomenda. O peso de uma referência pessoal é muito maior que qualquer conteúdo.' },
  { num: 6, title: 'Conteúdo que nomeia exatamente o que sente', text: 'Um post ou vídeo que descreve a sua realidade de forma tão precisa que sente \'isto foi escrito para mim\'. Cria reconhecimento imediato.', quote: '"Esta pessoa percebe o que eu vivo. Posso confiar."' },
  { num: 7, title: 'Ver o sistema em funcionamento', text: 'Uma demonstração ou caso real — a reação é imediata. O visual do sistema com a cara do negócio dela é um trigger poderoso de decisão.', quote: '"Só de ver já me sinto entusiasmada. Quero isto para o meu negócio."' },
];

export function SectionTriggers() {
  return (
    <Section id="triggers" num="11" label="Triggers de compra" title="O que ativa a decisão de avançar">
      <NoteBox>A maioria das compras não acontece a frio. Há sempre um evento ou combinação de eventos que transforma o "sei que preciso" em "preciso agora".</NoteBox>
      <div className="space-y-3 mt-4">
        {TRIGGERS.map(t => (
          <div key={t.num} className="flex gap-3 items-start">
            <span className="shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {t.num}
            </span>
            <Card className="flex-1">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-foreground mb-1">{t.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.text}</p>
                {t.quote && <Quote>{t.quote}</Quote>}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </Section>
  );
}
