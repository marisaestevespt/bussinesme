import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Handshake, XCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const REASON_OPTIONS = [
  'Renovação de contrato',
  'Preço',
  'Scope / âmbito',
  'Pausa temporária',
  'Concorrência',
  'Insatisfação',
  'Upsell',
  'Downsell',
  'Outro',
] as const;

interface Props {
  status: string | undefined;
  reason: string | undefined;
  startedAt: string | undefined;
  ownerId: string | undefined;
  notes: string | undefined;
  onChange: (field: string, value: any) => void;
  onRenewCycle?: () => void;
}

export function RenegotiationBlock({ status, reason, startedAt, ownerId, notes, onChange, onRenewCycle }: Props) {
  const current = status || 'nenhuma';
  const isActive = current === 'em_curso';
  const isClosed = current === 'concluida_renovada' || current === 'concluida_perdida';

  const { data: members = [] } = useQuery({
    queryKey: ['team_members_min'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, status')
        .eq('status', 'ativo')
        .order('full_name');
      return data || [];
    },
  });

  const start = (presetReason?: string) => {
    onChange('renegotiation_status', 'em_curso');
    if (!startedAt) onChange('renegotiation_started_at', format(new Date(), 'yyyy-MM-dd'));
    if (presetReason && !reason) onChange('renegotiation_reason', presetReason);
  };
  const close = (outcome: 'concluida_renovada' | 'concluida_perdida') => {
    onChange('renegotiation_status', outcome);
  };
  const reopen = () => {
    onChange('renegotiation_status', 'em_curso');
  };
  const cancel = () => {
    onChange('renegotiation_status', 'nenhuma');
  };

  const daysOpen = startedAt
    ? differenceInDays(new Date(), parseISO(startedAt))
    : 0;

  // Idle state: just a CTA
  if (current === 'nenhuma') {
    return (
      <Card className="border-dashed bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Handshake className="h-4 w-4" />
            <span>Sem renegociação ativa com este cliente.</span>
          </div>
          <div className="flex items-center gap-2">
            {onRenewCycle && (
              <Button size="sm" variant="outline" onClick={onRenewCycle}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Renovar ciclo
              </Button>
            )}
            <Button size="sm" onClick={() => start()}>
              <Handshake className="h-4 w-4 mr-1.5" /> Abrir renegociação
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4 border-l-4 border-l-warning">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
            <Handshake className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Renegociação</h3>
            <p className="text-[11px] text-muted-foreground">
              {isActive
                ? `Aberta há ${daysOpen} dia${daysOpen === 1 ? '' : 's'}`
                : current === 'concluida_renovada' ? 'Concluída — renovada'
                : 'Concluída — perdida'}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={
          isActive ? 'border-warning/40 text-warning'
          : current === 'concluida_renovada' ? 'border-success/40 text-success'
          : 'border-destructive/40 text-destructive'
        }>
          {isActive ? 'Em curso' : current === 'concluida_renovada' ? 'Renovada' : 'Perdida'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Motivo</Label>
          <Select
            value={reason && REASON_OPTIONS.includes(reason as any) ? reason : (reason ? 'Outro' : '')}
            onValueChange={v => onChange('renegotiation_reason', v)}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Select
            value={ownerId || ''}
            onValueChange={v => onChange('renegotiation_owner_id', v || null)}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Atribuir..." /></SelectTrigger>
            <SelectContent>
              {members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Início</Label>
          <Input
            type="date"
            className="h-9"
            value={startedAt || ''}
            onChange={e => onChange('renegotiation_started_at', e.target.value || null)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notas</Label>
        <Textarea
          rows={2}
          placeholder="Contexto, propostas, próximos passos..."
          value={notes || ''}
          onChange={e => onChange('renegotiation_notes', e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isActive && (
          <>
            {onRenewCycle && (
              <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={onRenewCycle}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Renovar ciclo
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => close('concluida_perdida')}>
              <XCircle className="h-4 w-4 mr-1.5" /> Marcar como perdida
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancelar renegociação
            </Button>
          </>
        )}
        {isClosed && (
          <>
            <Button size="sm" variant="outline" onClick={reopen}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir
            </Button>
            {current === 'concluida_renovada' && onRenewCycle && (
              <Button size="sm" onClick={onRenewCycle}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Renovar ciclo
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
