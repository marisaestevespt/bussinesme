import { Card, CardContent } from '@/components/ui/card';
import { Section, NoteBox, Tag, AccentColor } from './shared';

interface PhraseItem {
  type: string;
  color: AccentColor;
  phrase: string;
  why: string;
}

const GROUPS: { label: string; color: AccentColor; phrases: PhraseItem[] }[] = [
  {
    label: 'Nomear a realidade',
    color: 'coral',
    phrases: [
      { type: 'NOMEAR A REALIDADE · Carrossel / Reel', color: 'coral', phrase: 'Se a tua equipa precisa de te perguntar tudo, o problema não é a equipa.', why: 'Nomeia o padrão sem acusar — reconhecimento imediato nas Personas A e B' },
      { type: 'NOMEAR A REALIDADE · Carrossel reflexivo', color: 'coral', phrase: '5 sinais de que o teu negócio só funciona quando estás em cima de tudo', why: 'Checklists de reconhecimento são os mais partilhados. Gatilho de consciência.' },
      { type: 'NOMEAR A REALIDADE · Vídeo / Reel', color: 'coral', phrase: 'O que acontece quando tentas delegar sem ter os processos documentados', why: 'Educativo com prova de realidade — vivido por quase todas as entrevistadas' },
      { type: 'NOMEAR A REALIDADE · Post / Stories', color: 'coral', phrase: '90% das empreendedoras que conheço têm os processos do negócio… na cabeça.', why: 'Dado real das entrevistas. Específico e incomodativo.' },
    ],
  },
  {
    label: 'Pintar o sonho',
    color: 'teal',
    phrases: [
      { type: 'PINTAR O SONHO · Carrossel aspiracional', color: 'teal', phrase: 'O que muda quando a equipa deixa de precisar de ti para tudo', why: 'Apela ao desejo de autonomia da equipa sem falar em ferramentas' },
      { type: 'PINTAR O SONHO · Story / vídeo íntimo', color: 'teal', phrase: 'Fui de fazer tudo na minha cabeça a ter um negócio que funciona quando não estou', why: 'Narrativa pessoal genuína que ressoa com todas as personas' },
      { type: 'PINTAR O SONHO · Reel educativo', color: 'teal', phrase: 'A diferença entre tarefas estratégicas, táticas e operacionais — e porque importa antes de contratares alguém', why: 'Insight mencionado como transformador por uma entrevistada. Posicionador.' },
    ],
  },
  {
    label: 'Educar com autoridade',
    color: 'blue',
    phrases: [
      { type: 'EDUCAR COM AUTORIDADE · Carrossel / Série', color: 'blue', phrase: 'Antes de contratares alguém: o que precisas de ter pronto primeiro', why: 'Responde à dor universal. Posiciona como especialista em estrutura sem vender.' },
      { type: 'EDUCAR COM AUTORIDADE · Vídeo educativo', color: 'blue', phrase: 'Porque é que templates de Notion não resolvem o problema de processos', why: 'Desmonta a solução que já tentaram — abre espaço para a abordagem certa' },
      { type: 'EDUCAR COM AUTORIDADE · Post reflexivo', color: 'blue', phrase: 'O negócio não precisa de mais de ti. Precisa de funcionar melhor sem ti.', why: 'Frase de posicionamento — reencuadra o problema de "esforço" para "sistema"' },
    ],
  },
  {
    label: 'Bastidores e conexão',
    color: 'purple',
    phrases: [
      { type: 'BASTIDORES E CONEXÃO · Série', color: 'purple', phrase: 'O que acontece operacionalmente no meu negócio esta semana', why: 'Mostra a realidade dos bastidores — não é marketing, é prova de método' },
      { type: 'BASTIDORES E CONEXÃO · Story / vídeo', color: 'purple', phrase: 'O que ninguém fala sobre ter equipa: a parte emocional de aprender a largar', why: 'Conteúdo raro — toca a resistência emocional que nenhuma outra criadora aborda' },
    ],
  },
];

export function SectionFrases() {
  return (
    <Section id="frases" num="14" label="Frases para conteúdo" title="Ideias prontas — sem mencionar consultoria ou sistema">
      <NoteBox>Regra absoluta: conteúdo orgânico não menciona a consultoria, o sistema Lirah, ou faz CTAs comerciais. Cria reconhecimento — a conversão acontece noutro momento.</NoteBox>
      <div className="space-y-6 mt-4">
        {GROUPS.map(g => (
          <div key={g.label}>
            <p className="text-xs font-semibold text-foreground mb-3">{g.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {g.phrases.map((p, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Tag color={p.color}>{p.type}</Tag>
                    <p className="mt-3 text-[15px] font-semibold leading-snug text-foreground">
                      "{p.phrase}"
                    </p>
                    <p className="mt-2 text-[11px] italic text-muted-foreground">{p.why}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
