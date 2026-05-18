import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertCircle, AlertTriangle, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enrichQuestionsWithAutoFill } from '@/lib/portalAutoFill';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Health {
  portal_active: boolean;
  has_account_manager: boolean;
  last_login_at: string | null;
  pending_requests: number;
  pending_feedback: number;
  overdue_recolhas: number;
}

type Tone = 'good' | 'warn' | 'bad';
const TONE_STYLES: Record<Tone, string> = {
  good: 'bg-success/10 text-success border-success/30',
  warn: 'bg-warning/10 text-warning border-warning/30',
  bad: 'bg-destructive/10 text-destructive border-destructive/30',
};
const TONE_ICONS: Record<Tone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  bad: AlertCircle,
};

function Indicator({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const Icon = TONE_ICONS[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium mb-0.5 opacity-80">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function ClientPortalHealthBlock({ clientId }: { clientId: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const loadHealth = async () => {
    const { data, error } = await supabase.rpc('get_client_portal_health', { _client_id: clientId });
    if (!error && data) setHealth(data as unknown as Health);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_client_portal_health', { _client_id: clientId });
      if (alive) {
        if (!error && data) setHealth(data as unknown as Health);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  const activatePortal = async () => {
    setActivating(true);
    try {
      // Get client + product to determine portal type
      const { data: client } = await supabase
        .from('clients')
        .select('email, full_name, nif, fiscal_address, current_product_id')
        .eq('id', clientId)
        .maybeSingle();
      if (!client?.current_product_id) {
        toast.error('O cliente precisa de ter um produto associado para ativar o portal.');
        setActivating(false);
        return;
      }
      const { data: product } = await supabase
        .from('products')
        .select('id, product_type, faqs')
        .eq('id', client.current_product_id)
        .maybeSingle();
      const projetoTypes = ['projeto_1_1', 'servico_pontual', 'consulta', 'consultoria_individual', 'consultoria_grupo', 'mentoria_individual', 'mentoria_grupo', 'workshop'];
      let portalType: 'projeto_unico' | 'servico_mensal' | null = null;
      if (product?.product_type && projetoTypes.includes(product.product_type)) portalType = 'projeto_unico';
      else if (product?.product_type === 'servico_mensal') portalType = 'servico_mensal';
      if (!portalType) {
        toast.error('Este tipo de produto não suporta portal.');
        setActivating(false);
        return;
      }

      // Create or reactivate portal
      const { data: existingPortal } = await supabase.from('client_portals').select('id').eq('client_id', clientId).maybeSingle();
      let portalId: string | null;
      if (existingPortal) {
        await supabase.from('client_portals').update({ is_active: true, portal_type: portalType }).eq('id', existingPortal.id);
        portalId = existingPortal.id;
      } else {
        const { data: newPortal, error: portalErr } = await supabase.from('client_portals').insert({ client_id: clientId, portal_type: portalType, is_active: true }).select('id').single();
        if (portalErr) throw portalErr;
        portalId = newPortal.id;
      }

      // Copy FAQs from product (only if portal has none)
      const { data: existingFaqs } = await supabase.from('portal_faqs').select('id').eq('portal_id', portalId!).limit(1);
      if (!existingFaqs?.length) {
        const productFaqs: { question: string; answer: string }[] = Array.isArray(product?.faqs)
          ? (product!.faqs as unknown as { question: string; answer: string }[])
          : [];
        const validFaqs = productFaqs.filter(f => f.question?.trim());
        if (validFaqs.length > 0) {
          await supabase.from('portal_faqs').insert(
            validFaqs.map((f, i) => ({ portal_id: portalId!, question: f.question, answer: f.answer || '', sort_order: i }))
          );
        }
      }

      // Copy diagnostic questions (only if portal has none)
      const { data: existingQ } = await supabase.from('portal_initial_questions').select('id').eq('portal_id', portalId!).limit(1);
      if (!existingQ?.length) {
        const { data: diagQuestions } = await supabase
          .from('product_diagnostic_questions')
          .select('question, sort_order, question_group, answer_type, group_sort_order')
          .eq('product_id', client.current_product_id!)
          .order('group_sort_order')
          .order('sort_order');
        if (diagQuestions?.length) {
          const { data: businessData } = await supabase.from('business_setup').select('*').limit(1).maybeSingle();
          const clientData = { email: client.email, nif: client.nif, fiscal_address: client.fiscal_address, full_name: client.full_name };
          const rows = diagQuestions.map((dq, i) => ({
            portal_id: portalId!,
            question: dq.question,
            sort_order: dq.sort_order ?? i,
            question_group: dq.question_group || null,
            answer_type: dq.answer_type || 'text',
            group_sort_order: dq.group_sort_order ?? 0,
          }));
          const enrichedRows = enrichQuestionsWithAutoFill(rows, clientData, businessData || null);
          await supabase.from('portal_initial_questions').insert(enrichedRows as any);
        }
      }

      toast.success('Portal ativado.');
      await loadHealth();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao ativar portal: ${err?.message || 'tenta novamente'}`);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <Card className="hq-card p-5">
        <p className="text-xs text-muted-foreground">A carregar saúde do portal…</p>
      </Card>
    );
  }
  if (!health) return null;

  const lastLoginTone: Tone = (() => {
    if (!health.last_login_at) return 'bad';
    const days = differenceInDays(new Date(), parseISO(health.last_login_at));
    if (days < 7) return 'good';
    if (days <= 30) return 'warn';
    return 'bad';
  })();
  const lastLoginLabel = health.last_login_at
    ? format(parseISO(health.last_login_at), "d MMM yyyy", { locale: pt })
    : 'Nunca';

  const reqTone: Tone = health.pending_requests === 0 ? 'good' : health.pending_requests <= 2 ? 'warn' : 'bad';
  const fbTone: Tone = health.pending_feedback === 0 ? 'good' : health.pending_feedback === 1 ? 'warn' : 'bad';
  const recTone: Tone = health.overdue_recolhas === 0 ? 'good' : health.overdue_recolhas === 1 ? 'warn' : 'bad';

  return (
    <Card className="hq-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Saúde do portal</h3>
        </div>
        {!health.portal_active && (
          <Button size="sm" variant="outline" onClick={activatePortal} disabled={activating}>
            <Power className="h-3.5 w-3.5 mr-1.5" />
            {activating ? 'A ativar…' : 'Ativar portal'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Indicator label="Portal" value={health.portal_active ? 'Ativo' : 'Inativo'} tone={health.portal_active ? 'good' : 'bad'} />
        <Indicator label="Account manager" value={health.has_account_manager ? 'Atribuído' : 'Sem AM'} tone={health.has_account_manager ? 'good' : 'bad'} />
        <Indicator label="Último acesso" value={lastLoginLabel} tone={lastLoginTone} />
        <Indicator label="Pedidos pendentes" value={String(health.pending_requests)} tone={reqTone} />
        <Indicator label="Feedback por responder" value={String(health.pending_feedback)} tone={fbTone} />
        <Indicator label="Recolhas em atraso" value={String(health.overdue_recolhas)} tone={recTone} />
      </div>
    </Card>
  );
}