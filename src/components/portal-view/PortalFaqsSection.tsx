import { HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import type { PortalFaq } from '@/types/portal';

interface Props {
  faqs: PortalFaq[];
  pc: string;
  pcAlpha: (a: number) => string;
}

export function PortalFaqsSection({ faqs, pc, pcAlpha }: Props) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={HelpCircle}>
        Perguntas Frequentes · {faqs.length} {faqs.length === 1 ? 'pergunta' : 'perguntas'}
      </SectionTitle>

      <p className="text-sm text-muted-foreground -mt-2">
        As respostas às dúvidas mais comuns. Não encontras o que procuras? Fala connosco através dos comentários.
      </p>

      {faqs.length > 0 ? (
        <SectionCard className="p-2 sm:p-4">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem
                key={f.id}
                value={f.id}
                className={i === faqs.length - 1 ? 'border-0' : 'border-border/30'}
              >
                <AccordionTrigger className="text-base sm:text-lg font-medium hover:no-underline py-5 text-left">
                  <span className="flex items-start gap-3">
                    <span
                      className="inline-flex items-center justify-center text-xs font-semibold rounded-full h-6 w-6 shrink-0 mt-0.5"
                      style={{ backgroundColor: pcAlpha(0.12), color: pc }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">{f.question}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed pb-5 pl-9">
                  {f.answer || 'Resposta em breve.'}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>
      ) : (
        <SectionCard className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Ainda sem perguntas frequentes.</p>
        </SectionCard>
      )}
    </div>
  );
}