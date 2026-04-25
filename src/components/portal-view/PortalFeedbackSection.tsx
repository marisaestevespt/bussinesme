import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SectionCard, SectionTitle } from './SectionPrimitives';

interface Props {
  feedback: any[];
  feedbackText: string;
  setFeedbackText: (v: string) => void;
  sendFeedback: () => void | Promise<void>;
  pc: string;
  pcAlpha: (a: number) => string;
}

export function PortalFeedbackSection({
  feedback, feedbackText, setFeedbackText, sendFeedback, pc, pcAlpha,
}: Props) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={MessageSquare}>Feedback</SectionTitle>
      <SectionCard className="p-5 space-y-4">
        <Textarea
          className="rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
          placeholder="Partilha o teu feedback connosco... 💬"
          value={feedbackText}
          onChange={e => setFeedbackText(e.target.value)}
          rows={4}
          style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
        />
        <Button className="rounded-xl text-white" style={{ backgroundColor: pc }} disabled={!feedbackText.trim()} onClick={sendFeedback}>
          <Send className="h-4 w-4 mr-2" />Enviar Feedback
        </Button>
      </SectionCard>
      {feedback.length > 0 && (
        <SectionCard className="p-5">
          <p className="text-sm font-semibold mb-3">Feedback Anterior</p>
          <div className="space-y-3">
            {feedback.map((f: any) => (
              <div key={f.id} className="rounded-xl border border-border/30 bg-muted/10 p-4">
                <p className="text-sm leading-relaxed">{f.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}