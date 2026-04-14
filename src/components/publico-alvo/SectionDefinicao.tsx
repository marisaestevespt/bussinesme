import { Card, CardContent } from '@/components/ui/card';
import { Section, AccentCard, InfoCard } from './shared';

export function SectionDefinicao() {
  return (
    <Section id="definicao" num="01" label="Definição central" title="Quem é o nosso público">
      <div className="space-y-4">
        <AccentCard color="coral" title="Definição em uma frase">
          <p className="text-sm text-foreground leading-relaxed">
            Prestadoras de serviços e especialistas digitais que já geram receita validada, sentem desorganização interna crescente e precisam de estrutura operacional para crescer — especialmente no momento em que percebem que o negócio depende demasiado delas.
          </p>
        </AccentCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCard title="Fase do negócio" text="2 a 6 anos de atividade. Já passaram a fase de sobrevivência. Estão em modo de crescimento mas o modelo atual não aguenta mais escala." />
          <InfoCard title="Estrutura de equipa" text="Solo com prestadores, ou equipa de 1-7 pessoas (mix interno + freelancers). Estagiários aparecem muito como tentativa de aliviar sem estrutura." />
          <InfoCard title="Ferramentas atuais" text="Notion como hub + Google Sheets/Drive + ferramentas avulsas (Trello, Toggle, Excel, Canva, Systeme). Sempre tudo disperso." />
          <InfoCard title="Contexto pessoal" text="Maioria tem vida pessoal ativa — filhos, relacionamento, tempo próprio. Trabalham frequentemente à noite." />
          <InfoCard title="Consumo de conteúdo" text="Instagram diário, YouTube educativo aprofundado. Preferem mentorias com processo a cursos gravados genéricos." />
          <InfoCard title="Relação com tecnologia" text="Confortáveis com ferramentas digitais mas saturadas de ter demasiadas. Querem que funcione sem configuração complexa." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AccentCard color="green" title="Precisa ter">
            <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
              <li>Receita validada (já fatura de forma consistente)</li>
              <li>Serviço como produto principal</li>
              <li>Consciência de que há desorganização</li>
              <li>Vontade de crescer ou de ter mais liberdade</li>
              <li>Abertura para investir em estrutura</li>
            </ul>
          </AccentCard>
          <AccentCard color="red" title="Não encaixa se">
            <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
              <li>Ainda não validou a oferta / está no início</li>
              <li>Tem produto físico como core do negócio</li>
              <li>Não tem intenção de delegar nem crescer</li>
              <li>Acha que processos são "coisas para empresas grandes"</li>
              <li>Não está disposta a parar para estruturar</li>
            </ul>
          </AccentCard>
        </div>
      </div>
    </Section>
  );
}
