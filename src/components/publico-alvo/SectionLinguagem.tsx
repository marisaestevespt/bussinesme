import { Card, CardContent } from '@/components/ui/card';
import { Section, NoteBox, InfoCard } from './shared';

const PROBLEM_QUOTES = [
  'Está tudo na minha cabeça.',
  'Tenho de ser eu a ponte entre toda a gente.',
  'Está tudo muito espalhado.',
  'O negócio só funciona quando estou em cima de tudo.',
  'Sei o que preciso de fazer, só que não consigo fazer.',
  'Ando sempre atrás das coisas.',
  'Uma coisa que podia demorar 10 minutos, demorava uma hora.',
  'Tenho que estar em cima de tudo para não falhar.',
  'Se eu parar, o negócio para.',
];

const DESIRE_QUOTES = [
  'Quero crescer sem sacrificar a minha vida.',
  'Quero que a equipa seja autónoma sem mim.',
  'Quero ter tudo concentrado no mesmo sítio.',
  'Quero saber o que se passa sem ter de perguntar.',
  'Adorava que fossem buscar os dados automaticamente.',
  'Tudo que me economize tempo na gestão é ok.',
  'Quero um negócio que trabalha comigo.',
  'Quero ter aquela sensação de controlo.',
];

const GLOSSARY = [
  { word: 'Disperso / espalhado', text: 'Como ela descreve o estado atual das ferramentas e informação. Evitar "fragmentado" ou "descentralizado" — não é a linguagem dela.' },
  { word: 'Estar em cima de tudo', text: 'A sua forma de dizer que microgere e que tudo depende dela. Usar esta expressão no conteúdo cria reconhecimento imediato.' },
  { word: 'Na cabeça', text: 'Como descreve o estado dos processos. "Os processos estão na minha cabeça" — expressão universal em todas as entrevistas.' },
  { word: 'Delegar', text: 'Palavra central. Mas com conotação de risco — já tentou e correu mal. Usar com cuidado e contexto.' },
  { word: 'Baby steps', text: 'Como descreve a abordagem à delegação e à mudança. Quer fazer as coisas gradualmente, com segurança.' },
  { word: 'Crescer de forma sustentável', text: 'O resultado que procura. Não crescimento rápido — crescimento que não a destrua pelo caminho.' },
];

export function SectionLinguagem() {
  return (
    <Section id="linguagem" num="13" label="Linguagem do público" title="Palavras exatas que ela usa">
      <NoteBox>Usar a linguagem dela — não a nossa. As palavras certas criam reconhecimento imediato. As palavras erradas criam distância.</NoteBox>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-3">Para descrever o problema</p>
            <div className="space-y-2">
              {PROBLEM_QUOTES.map((q, i) => (
                <p key={i} className="text-xs italic text-foreground pl-3 border-l-2 border-primary/30">"{q}"</p>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-3">Para descrever o que quer</p>
            <div className="space-y-2">
              {DESIRE_QUOTES.map((q, i) => (
                <p key={i} className="text-xs italic text-foreground pl-3 border-l-2 border-teal-500/30">"{q}"</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs font-semibold text-foreground mb-3">Glossário</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GLOSSARY.map(g => <InfoCard key={g.word} title={g.word} text={g.text} />)}
      </div>
    </Section>
  );
}
