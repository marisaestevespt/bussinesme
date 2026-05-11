import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Editable } from '@/components/ui/editable';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Check, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { ObjetivoFinalField, parseObjetivoFinal, serializeObjetivoFinal, type ObjetivoFinalType } from '@/components/traffic/ObjetivoFinalField';
import { resolveProductId } from '@/lib/productResolver';
import { InlineLoader } from '@/components/ui/loading-skeletons';

const STATUSES = [
  { value: 'em_desenho', label: 'Em desenho', color: 'bg-accent-violet/15 text-accent-violet' },
  { value: 'escrita_copy', label: 'Escrita de copy', color: 'bg-warning/15 text-warning' },
  { value: 'gravacao', label: 'Gravação', color: 'bg-warning/15 text-warning' },
  { value: 'edicao', label: 'Edição', color: 'bg-info/15 text-info' },
  { value: 'design', label: 'Design', color: 'bg-accent-violet/15 text-accent-violet' },
  { value: 'para_aprovacao', label: 'Para aprovação final', color: 'bg-warning/15 text-warning' },
  { value: 'em_campanha', label: 'Em campanha', color: 'bg-success/15 text-success' },
  { value: 'ajustes', label: 'Ajustes a fazer', color: 'bg-destructive/15 text-destructive' },
  { value: 'off', label: 'OFF', color: 'bg-muted text-muted-foreground' },
];

const FORMATOS = ['Vídeo', 'Imagem', 'Carrossel', 'Stories', 'Outro'];

type CreativeFull = {
  id: string; name: string; status: string; start_date: string | null;
  formato: string | null; objetivo: string | null; oferta_goal: string | null;
  link: string | null; titulo_principal: string | null; headline: string | null;
  legenda: string | null; product_name?: string | null;
};

export default function TrafegoCriativoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: item, isLoading } = useQuery({
    queryKey: ['traffic-creative', id],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_creatives').select('*').eq('id', id!).maybeSingle() as any;
      return data as CreativeFull | null;
    },
    enabled: !!id,
  });

  const [form, setForm] = useState({
    name: '', status: 'em_desenho', start_date: null as Date | null, formato: '',
    objetivo: '', oferta_type: '' as ObjetivoFinalType, oferta_value: '', link: '', titulo_principal: '', headline: '', legenda: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      const parsed = parseObjetivoFinal(item.oferta_goal);
      setForm({
        name: item.name || '', status: item.status || 'em_desenho',
        start_date: item.start_date ? new Date(item.start_date) : null,
        formato: item.formato || '', objetivo: item.objetivo || '',
        oferta_type: parsed.type, oferta_value: parsed.value, link: item.link || '',
        titulo_principal: item.titulo_principal || '', headline: item.headline || '',
        legenda: item.legenda || '',
      });
    }
  }, [item]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('traffic_creatives').update({
      name: form.name, status: form.status,
      start_date: form.start_date ? format(form.start_date, 'yyyy-MM-dd') : null,
      formato: form.formato || null, objetivo: form.objetivo || null,
      oferta_goal: serializeObjetivoFinal(form.oferta_type, form.oferta_value),
      link: form.link || null,
      titulo_principal: form.titulo_principal || null, headline: form.headline || null,
      legenda: form.legenda || null,
    } as any).eq('id', id!);
    setSaving(false);
    if (error) toast.error('Não consegui guardar a criativo. Tenta novamente.');
    else { toast.success('Guardado'); qc.invalidateQueries({ queryKey: ['traffic-creative', id] }); }
  };

  if (isLoading || !item) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><InlineLoader /></div></AppLayout>
  );

  const st = STATUSES.find(s => s.value === form.status) || STATUSES[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <EntityHeroHeader
          icon={parseIcon((item as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('traffic_creatives').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['traffic-creative', id] });
          }}
          coverUrl={(item as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('traffic_creatives').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['traffic-creative', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`creatives/${id}`}
          disabled={!isOwner}
        />
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Criativo</p>
          <div className="flex items-center gap-3">
            <Editable
              display={form.name}
              disabled={!isOwner}
              placeholder="Sem nome"
              bold
              className="text-2xl md:text-3xl tracking-tight text-primary-foreground hover:bg-white/10"
              hidePencil={!isOwner}
              render={({ stop, autoFocusRef }) => (
                <Input ref={autoFocusRef as any} value={form.name} onBlur={stop}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="text-2xl md:kpi-display-sm mt-1 bg-transparent border-none text-center h-auto p-0 text-primary-foreground" />
              )}
            />
            <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
          </div>
        </div>

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing/trafego-pago" parentLabel="Tráfego Pago" />

          {/* Meta fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} disabled={!isOwner}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Formato</label>
              <Select value={form.formato} onValueChange={v => setForm(f => ({ ...f, formato: v }))} disabled={!isOwner}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{FORMATOS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !form.start_date && "text-muted-foreground")} disabled={!isOwner}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {form.start_date ? format(form.start_date, 'dd MMM yyyy', { locale: pt }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.start_date || undefined}
                    onSelect={d => setForm(f => ({ ...f, start_date: d || null }))}
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-4">
            <ObjetivoFinalField
              type={form.oferta_type}
              value={form.oferta_value}
              onTypeChange={t => setForm(f => ({ ...f, oferta_type: t, oferta_value: '' }))}
              onValueChange={v => setForm(f => ({ ...f, oferta_value: v }))}
              disabled={!isOwner}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Link</label>
              <Editable display={form.link} disabled={!isOwner} placeholder="https://..." render={({ stop, autoFocusRef }) => (
                <Input ref={autoFocusRef as any} value={form.link} onBlur={stop} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="h-9" />
              )} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Objetivo</label>
            <Editable display={form.objetivo} disabled={!isOwner} placeholder="Objetivo do criativo" render={({ stop, autoFocusRef }) => (
              <Textarea ref={autoFocusRef as any} value={form.objetivo} onBlur={stop} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} className="min-h-[80px] resize-y" />
            )} />
          </div>

          <Separator />

          {/* Título Principal */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Título Principal</h2>
            <Card className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <Editable display={form.titulo_principal} disabled={!isOwner} placeholder="Escreve aqui o título principal do criativo." render={({ stop, autoFocusRef }) => (
                  <Textarea ref={autoFocusRef as any} value={form.titulo_principal} onBlur={stop}
                    onChange={e => setForm(f => ({ ...f, titulo_principal: e.target.value }))}
                    className="min-h-[80px] resize-y" />
                )} />
              </CardContent>
            </Card>
          </section>

          {/* Headline */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Headline</h2>
            <Card className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <Editable display={form.headline} disabled={!isOwner} placeholder="Escreve aqui a headline do criativo." render={({ stop, autoFocusRef }) => (
                  <Textarea ref={autoFocusRef as any} value={form.headline} onBlur={stop}
                    onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                    className="min-h-[80px] resize-y" />
                )} />
              </CardContent>
            </Card>
          </section>

          {/* Legenda */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Legenda</h2>
            <Card className="border-l-4 border-l-primary/30">
              <CardContent className="p-4">
                <Editable display={form.legenda} disabled={!isOwner} placeholder="Escreve aqui a legenda completa do criativo." render={({ stop, autoFocusRef }) => (
                  <Textarea ref={autoFocusRef as any} value={form.legenda} onBlur={stop}
                    onChange={e => setForm(f => ({ ...f, legenda: e.target.value }))}
                    className="min-h-[120px] resize-y" />
                )} />
              </CardContent>
            </Card>
          </section>

          {isOwner && (
            <div className="flex justify-end pt-4">
              <Button onClick={save} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
