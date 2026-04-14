import { Card, CardContent } from '@/components/ui/card';
import { Section, Tag, AccentColor } from './shared';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<AccentColor, string> = {
  coral: 'bg-primary', info: 'bg-info', success: 'bg-success',
  warning: 'bg-warning', accent: 'bg-accent', muted: 'bg-muted-foreground',
  destructive: 'bg-destructive',
};

const LEVELS = [
  { num: 1, color: 'muted' as const, title: 'Inconsciente do problema', desc: 'Sabe que está ocupada e cansada, mas não identificou a causa como um problema de estrutura operacional. Acha que é assim mesmo ter um negócio.', example: '"Trabalho muito, mas é o que é preciso para crescer."', tags: [{ color: 'muted' as const, text: 'Menos frequente no nosso público' }] },
  { num: 2, color: 'warning' as const, title: 'Consciente do problema, não da solução', desc: 'Sente que algo não está a funcionar — dispersão, dependência dela, falta de visibilidade — mas não nomeou ainda o problema como falta de estrutura operacional.', example: '"Sinto que há coisas que me estão a falhar. Não sei bem o quê, mas está a tirar-me dinheiro."', tags: [{ color: 'warning' as const, text: 'Persona C principalmente' }] },
  { num: 3, color: 'coral' as const, title: 'Consciente do problema e da solução em abstrato', desc: 'Sabe que precisa de processos, de documentar, de ter um sistema. Já tentou algumas coisas. Mas ainda não encontrou algo que realmente resulte ou que acompanhe com a implementação.', example: '"Sei que preciso de documentar os processos. Ando a arrastar isso há meses. Comprei templates no Notion mas não implementei."', tags: [{ color: 'coral' as const, text: 'Maioria do nosso público' }, { color: 'coral' as const, text: 'Personas A e B' }] },
  { num: 4, color: 'info' as const, title: 'Consciente do produto', desc: 'Já sabe que existe esta consultoria. Está a avaliar se é a certa para ela — comparando, avaliando prova social, verificando se o método faz sentido.', example: '"Já vi o perfil. Parece que percebe o que eu vivo. Quero perceber melhor como funciona antes de avançar."', tags: [{ color: 'info' as const, text: 'Leads qualificadas em avaliação' }] },
  { num: 5, color: 'success' as const, title: 'Mais consciente — pronta para comprar', desc: 'Já decidiu que quer avançar. Está à procura de confirmação final, condições de pagamento, e da sensação de segurança de que isto vai funcionar para ela especificamente.', example: '"Quero avançar. Só preciso de perceber como funciona o processo e o que está incluído."', tags: [{ color: 'success' as const, text: 'Sessão de diagnóstico / proposta' }] },
];

export function SectionNiveisConsciencia() {
  return (
    <Section id="niveis-consciencia" num="04" label="Níveis de consciência" title="Onde ela está na escala de Schwartz" subtitle="A maioria do nosso público está entre os níveis 2 e 3. O conteúdo de topo de funil deve ativar o nível 1→2. A consultoria serve principalmente o nível 3→4.">
      <div className="space-y-0">
        {LEVELS.map(l => (
          <div key={l.num} className="flex items-start gap-4 py-4 border-b">
            <span className={cn('shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white', COLOR_MAP[l.color])}>
              {l.num}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{l.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
              <p className="text-xs italic text-muted-foreground/70 mt-1">{l.example}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">{l.tags.map((t, i) => <Tag key={i} color={t.color}>{t.text}</Tag>)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        <Card className="border-l-[3px] border-primary bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Conteúdo orgânico (nível 1→3)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Nomear a realidade que ela vive. Não falar do sistema nem da consultoria. Mostrar que o que ela sente tem nome e tem causa — e que não é inevitável.</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-info bg-info/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Conteúdo de conversão (nível 3→5)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Provas sociais, processo claro, antes/depois concreto. Mostrar que há acompanhamento — não é mais uma ferramenta que ela vai configurar sozinha.</p>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

// ─── Buyer level ───────────────────────────────────────────────
const TEMPS = [
  { border: 'border-t-muted-foreground/30', title: 'Fria', desc: 'Nunca ouviu falar / não identificou o problema', text: 'Não conhece a Business ME. Sente dificuldades mas não as nomeou como problema de operação. Está nas redes a consumir conteúdo de marketing/crescimento.', tag: 'Ativada por conteúdo orgânico', tagColor: 'muted' as const },
  { border: 'border-t-warning', title: 'Morna', desc: 'Reconhece o problema, segue o conteúdo, ainda não avaliou', text: 'Segue o perfil, reconhece-se nas publicações, já tentou resolver por conta própria. Sabe que precisa de algo mas ainda não está em modo de decisão.', tag: 'Ativada por prova social e processo claro', tagColor: 'warning' as const },
  { border: 'border-t-primary', title: 'Quente', desc: 'Já decidiu que precisa de ajuda, está a avaliar opções', text: 'Urgência real (um gatilho aconteceu). Está em modo de comparar e decidir. Precisa de sentir segurança no processo, clareza no preço e prova de que resulta.', tag: 'Ativada por sessão de diagnóstico', tagColor: 'coral' as const },
];

const BUYING_STEPS = [
  { num: '01', title: 'Reconhecimento via conteúdo', text: 'Encontra conteúdo orgânico que nomeia algo que sente. Começa a seguir. O conteúdo não vende — cria reconhecimento e confiança ao longo do tempo.' },
  { num: '02', title: 'Gatilho de urgência', text: 'Algo acontece no negócio que torna o problema urgente. Passa de \'sei que preciso\' para \'preciso agora\'.' },
  { num: '03', title: 'Validação por referência ou mentoria', text: 'Muitas vezes alguém de confiança fala ou recomenda. A decisão raramente acontece a frio — há quase sempre um mediador.' },
  { num: '04', title: 'Sessão de diagnóstico / conversa', text: 'A compra concretiza-se quase sempre numa conversa ao vivo. O processo precisa de ser claro e o preço precisa de fazer sentido no contexto do que ela vai ganhar.' },
  { num: '05', title: 'Decisão baseada em segurança', text: 'O que fecha a venda não é o preço — é a sensação de que \'isto foi feito para mim\' e de que haverá acompanhamento real.' },
];

export function SectionNivelComprador() {
  return (
    <Section id="nivel-comprador" num="05" label="Nível de comprador" title="Temperatura e prontidão para comprar">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {TEMPS.map(t => (
          <Card key={t.title} className={cn('overflow-hidden border-t-[3px]', t.border)}>
            <CardContent className="p-4">
              <p className="text-sm font-bold text-foreground mb-1">{t.title}</p>
              <p className="text-xs font-medium text-foreground mb-2">{t.desc}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{t.text}</p>
              <Tag color={t.tagColor}>{t.tag}</Tag>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs font-semibold text-foreground mb-3">Padrão de compra</p>
      <div className="relative">
        {BUYING_STEPS.map((s, i) => (
          <div key={s.num} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                {s.num}
              </span>
              {i < BUYING_STEPS.length - 1 && <div className="w-px flex-1 min-h-[40px] border-l-2 border-dashed border-border" />}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <Card><CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </CardContent></Card>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
