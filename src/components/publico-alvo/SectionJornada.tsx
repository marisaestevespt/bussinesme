import { Card, CardContent } from '@/components/ui/card';
import { Section, Tag, AccentColor } from './shared';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-muted-foreground', amber: 'bg-amber-500', coral: 'bg-primary',
  red: 'bg-destructive', purple: 'bg-purple-500', blue: 'bg-blue-500', teal: 'bg-teal-600',
};

const STEPS = [
  { num: 1, color: 'gray', title: 'Normalização do caos', desc: 'Está exausta mas acha que é assim mesmo. O negócio funciona com muito esforço. Não identifica o caos como problema evitável.', emotion: 'Resignação' },
  { num: 2, color: 'amber', title: 'Primeiro sinal de alarme', desc: 'Algo falha — uma entrega atrasada, um cliente perdido, uma oportunidade que passou. Começa a questionar o modelo.', emotion: 'Inquietação' },
  { num: 3, color: 'coral', title: 'Tentativa de resolver sozinha', desc: 'Compra templates, experimenta o Notion, contrata uma gestora de redes. Melhora bocadinho mas não resolve — falta o acompanhamento para implementar de verdade.', emotion: 'Frustração + esperança' },
  { num: 4, color: 'red', title: 'Ponto de rutura', desc: 'A urgência chega — gravidez, lançamento, nova contratação. O \'já sei que preciso\' transforma-se em \'preciso agora, não posso adiar mais\'.', emotion: 'Urgência + vulnerabilidade' },
  { num: 5, color: 'purple', title: 'Encontro com a solução certa', desc: 'Encontra conteúdo que nomeia exatamente o que sente. Ou alguém de confiança refere. Sente reconhecimento — \'esta pessoa percebe o que eu vivo\'.', emotion: 'Alívio + curiosidade' },
  { num: 6, color: 'blue', title: 'Avaliação e decisão', desc: 'Quer perceber o processo, ver prova social, sentir que não é mais um produto genérico. Precisa de sentir que \'foi feito para mim\' e que haverá acompanhamento real.', emotion: 'Avaliação crítica + esperança cautelosa' },
  { num: 7, color: 'teal', title: 'Transformação', desc: 'A equipa ganha autonomia. Ela sente controlo sem microgestão. Cresce sem sacrificar a vida pessoal. Recomenda naturalmente.', emotion: 'Leveza + orgulho + controlo' },
];

export function SectionJornada() {
  return (
    <Section id="jornada-emocional" num="06" label="Jornada emocional" title="O caminho interno que ela percorre">
      <div className="relative">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={cn('shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white', COLOR_MAP[s.color])}>
                {s.num}
              </span>
              {i < STEPS.length - 1 && <div className="w-px flex-1 min-h-[40px] border-l-2 border-dashed border-border" />}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              <Card><CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                <Tag color={s.color as AccentColor}>{s.emotion}</Tag>
              </CardContent></Card>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
