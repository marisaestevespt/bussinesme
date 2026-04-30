import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  portalId: string;
  productId: string | null | undefined;
  productName?: string | null;
}

export function ApplyPortalTemplateButton({ portalId, productId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [sections, setSections] = useState({ faqs: true, materials: true, timeline: true });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const apply = async () => {
    if (!productId) {
      toast.error('Cliente sem produto associado');
      return;
    }
    const selected = (Object.entries(sections).filter(([, v]) => v).map(([k]) => k));
    if (selected.length === 0) {
      toast.error('Escolhe pelo menos uma secção');
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('apply_product_portal_template', {
      _portal_id: portalId,
      _product_id: productId,
      _sections: selected,
      _mode: mode,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Erro ao aplicar template');
      return;
    }
    const r = data as { faqs_inserted: number; materials_inserted: number; timeline_inserted: number };
    toast.success(`Template aplicado · FAQs +${r.faqs_inserted} · Materiais +${r.materials_inserted} · Fases +${r.timeline_inserted}`);
    queryClient.invalidateQueries({ queryKey: ['portal-faqs'] });
    queryClient.invalidateQueries({ queryKey: ['portal-materials'] });
    queryClient.invalidateQueries({ queryKey: ['portal-timeline'] });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        Aplicar template do produto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar template do produto</DialogTitle>
            <DialogDescription>
              {productName
                ? <>Vai copiar o template do produto <strong>{productName}</strong> para este portal.</>
                : 'Vai copiar o template do produto associado para este portal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Secções</Label>
              <div className="mt-2 space-y-2">
                {(['faqs','materials','timeline'] as const).map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox id={`sec-${key}`} checked={sections[key]} onCheckedChange={(v) => setSections(s => ({ ...s, [key]: !!v }))} />
                    <Label htmlFor={`sec-${key}`} className="font-normal cursor-pointer">
                      {key === 'faqs' ? 'Perguntas frequentes' : key === 'materials' ? 'Materiais e links' : 'Fases de timeline'}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modo</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'append' | 'replace')} className="mt-2 space-y-2">
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="append" id="mode-append" className="mt-0.5" />
                  <div>
                    <Label htmlFor="mode-append" className="font-normal cursor-pointer">Acrescentar (recomendado)</Label>
                    <p className="text-xs text-muted-foreground">Adiciona o template sem apagar o que já existe.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                  <div>
                    <Label htmlFor="mode-replace" className="font-normal cursor-pointer">Substituir</Label>
                    <p className="text-xs text-muted-foreground">Apaga o conteúdo atual nas secções escolhidas e aplica o template.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={apply} disabled={loading}>{loading ? 'A aplicar…' : 'Aplicar template'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}