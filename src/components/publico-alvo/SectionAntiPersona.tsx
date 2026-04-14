import { Card, CardContent } from '@/components/ui/card';
import { Section, NoteBox } from './shared';

const ITEMS = [
  { title: 'A que ainda não validou a oferta', text: 'Está no início, sem receita consistente. Precisa primeiro de validar o negócio — estrutura operacional agora seria prematuro e pouco aproveitado.' },
  { title: 'A que acha que processos são para empresas grandes', text: 'Não acredita que precisa de estrutura enquanto for pequena. Vai continuar a improvisar até a situação forçar mudança.' },
  { title: 'A que quer delegar tudo sem envolvimento', text: 'Espera receber um sistema pronto sem participar no processo. A consultoria requer envolvimento ativo da fundadora — sem isso não resulta.' },
  { title: 'A que não está disposta a parar para estruturar', text: 'Sabe que precisa mas recusa-se a investir tempo no processo. O resultado não seria sustentável nem genuíno.' },
  { title: 'A com negócio de produto físico como core', text: 'O sistema foi desenhado para serviços digitais e presenciais — negócios de produto físico têm operação muito diferente.' },
  { title: 'A que só quer ferramenta barata', text: 'Está à procura de substituto do Notion. A proposta vai muito além — e o investimento reflete isso.' },
];

export function SectionAntiPersona() {
  return (
    <Section id="anti-persona" num="12" label="Anti-persona" title="Quem NÃO é cliente ideal">
      <NoteBox>Saber quem não é cliente poupa tempo, energia e evita trabalho que não resulta para nenhuma das partes.</NoteBox>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {ITEMS.map(item => (
          <Card key={item.title} className="overflow-hidden bg-destructive/5 border-destructive/20">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-destructive mb-2">{item.title}</p>
              <p className="text-xs text-destructive/80 leading-relaxed">{item.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
