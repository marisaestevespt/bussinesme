import { Card, CardContent } from '@/components/ui/card';
import { Section, Tag, NoteBox, Quote, AccentColor } from './shared';
import { cn } from '@/lib/utils';

const PERSONAS = [
  {
    letter: 'A',
    color: 'coral' as AccentColor,
    name: 'Ana — A Especialista a Escalar',
    role: 'Solo ou até 3 pessoas · Processos 80-100% na cabeça · A tentar delegar pela primeira vez',
    tag: 'Perfil mais comum',
    quem: 'Gestora de tráfego, social media, copywriter, consultora, infoprodutora. 2-4 anos de negócio. Trabalha sozinha ou com prestadores pontuais. Atingiu um teto e sente que não consegue crescer mais sem estrutura.',
    frase: '"Sei o que preciso de fazer para dar certo, só que não consigo fazer." / "Tenho tudo na cabeça — quando quiser delegar vou perder tempo a documentar."',
    dores: 'Processos 100% na cabeça · CRM sem alertas, leads a esfriar · Dispersão e mudança de foco constante · Financeiro feito à mão ou no Excel · Dificuldade em operacionalizar ideias',
    gatilho: 'Lançamento iminente · nova contratação · sensação de teto · alguém de confiança que nomeia o problema',
    ouvir: 'O problema não é falta de talento nem de esforço. É falta de estrutura. E estrutura aprende-se — com o processo certo.',
  },
  {
    letter: 'B',
    color: 'blue' as AccentColor,
    name: 'Beatriz — A Gestora com Equipa Pequena',
    role: '3 a 7 pessoas · Tem processos mas dispersos · Quer parar de ser o centro de tudo',
    quem: 'Agência de redes sociais, consultora com equipa, mentora com prestadores. Já delegou com resultados mistos. A comunicação ainda passa toda por ela e o negócio não funciona sem ela presente.',
    frase: '"Uma coisa que podia demorar 10 minutos, demorava uma hora." / "Não consigo saber se posso aceitar mais clientes — não sei o limite real da equipa."',
    dores: 'Toda a comunicação passa por ela · Não sabe quanto tempo as tarefas demoram · Não vê a capacidade real da equipa · Processos dispersos sem sistema integrado · Relatórios e análise financeira manuais',
    gatilho: 'Licença de maternidade · crescimento rápido · nova contratação que corre mal · cliente importante perdido',
    ouvir: 'Ter equipa não chega. A equipa precisa de saber o que fazer sem te perguntar. Isso não acontece por acidente — acontece com sistema.',
  },
  {
    letter: 'C',
    color: 'green' as AccentColor,
    name: 'Carla — A Prestadora Presencial / Clínica',
    role: 'Saúde, bem-estar, consultoria especializada · Modelo de sessões/consultas · Digitalizando-se',
    quem: 'Psicóloga, nutricionista, instrutora, esteticista, fisioterapeuta. Núcleo presencial consolidado, a construir vertente digital. Não tem projetos — tem clientes com sessões/consultas. Lógica muito diferente de agência.',
    frase: '"Não sei o que me falta — quando me perguntam \'tens isto?\' consigo avaliar, mas partir de mim é difícil." / "Tudo que me economize tempo na gestão, para mim é ok."',
    dores: 'Gestão comercial 100% na cabeça · Contabilidade manual, prazos fiscais falhados · Faturação sazonal sem estratégia · Particularidades éticas que limitam delegação · Sente que ferramentas não foram feitas para ela',
    gatilho: 'Querer reduzir consultas para focar na gestão · crescimento da equipa · alguém que mostre o que está a perder',
    nota: 'Esta persona precisa de diagnóstico guiado — não consegue articular o que precisa sozinha. O valor da consultoria é especialmente alto aqui.',
  },
];

const COLOR_MAP: Record<AccentColor, string> = {
  coral: 'bg-primary',
  blue: 'bg-blue-500',
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-600',
  red: 'bg-destructive',
  gray: 'bg-muted-foreground',
};

const BG_MAP: Record<AccentColor, string> = {
  coral: 'bg-primary/5',
  blue: 'bg-blue-50/50 dark:bg-blue-950/20',
  green: 'bg-green-50/50 dark:bg-green-950/20',
  amber: 'bg-amber-50/50 dark:bg-amber-950/20',
  purple: 'bg-purple-50/50 dark:bg-purple-950/20',
  teal: 'bg-teal-50/50 dark:bg-teal-950/20',
  red: 'bg-destructive/5',
  gray: 'bg-muted/30',
};

export function SectionPersonas() {
  return (
    <Section id="personas" num="02" label="Personas" title="3 perfis identificados">
      <NoteBox>Nomes fictícios. Baseado em padrões extraídos das entrevistas — não em pessoas específicas.</NoteBox>
      <div className="space-y-4 mt-4">
        {PERSONAS.map(p => (
          <Card key={p.letter} className="overflow-hidden">
            <div className={cn('p-5 flex items-center gap-4', BG_MAP[p.color])}>
              <div className={cn('h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0', COLOR_MAP[p.color])}>
                {p.letter}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground">{p.name}</p>
                  {p.tag && <Tag color={p.color}>{p.tag}</Tag>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.role}</p>
              </div>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Quem é</p>
                  <p className="text-xs text-foreground leading-relaxed">{p.quem}</p>
                  <Quote>{p.frase}</Quote>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Dores principais</p>
                  <p className="text-xs text-foreground leading-relaxed">{p.dores}</p>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1 mt-3">Gatilho de ação</p>
                  <p className="text-xs text-foreground leading-relaxed">{p.gatilho}</p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">O que precisa ouvir</p>
                <p className="text-xs text-foreground italic leading-relaxed">{p.ouvir || ''}</p>
                {p.nota && (
                  <p className="text-xs text-primary font-medium mt-2">⚠ {p.nota}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
