import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { usePortal, usePortalFeedback } from '@/hooks/usePortalData';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Props {
  clientId: string;
}

export function ClientPortalFeedbackSection({ clientId }: Props) {
  const { portal } = usePortal(clientId);
  const portalId = portal.data?.id;
  const { feedback } = usePortalFeedback(portalId);
  const items = feedback.data || [];

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        {items.map(f => (
          <div key={f.id} className="rounded-lg border p-3 bg-background">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{f.content}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(parseISO(f.submitted_at), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-6">
            <MessageCircle className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
            <EmptyHint>Sem feedback recebido</EmptyHint>
          </div>
        )}
      </CardContent>
    </Card>
  );
}