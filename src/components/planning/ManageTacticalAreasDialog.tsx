import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TacticalArea } from '@/hooks/useTacticalAreas';

const DEFAULT_AREAS: TacticalArea[] = [
  { key: 'comercial', label: 'Comercial', enabled: true, sort_order: 1 },
  { key: 'marketing', label: 'Marketing', enabled: true, sort_order: 2 },
  { key: 'financeiro', label: 'Contabilidade', enabled: true, sort_order: 3 },
  { key: 'operacao', label: 'Operação', enabled: true, sort_order: 4 },
  { key: 'clientes', label: 'Clientes', enabled: true, sort_order: 5 },
  { key: 'produtos', label: 'Produtos', enabled: true, sort_order: 6 },
  { key: 'recursos-humanos', label: 'Recursos Humanos', enabled: true, sort_order: 7 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManageTacticalAreasDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [areas, setAreas] = useState<TacticalArea[]>([]);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('id, tactical_areas')
        .limit(1)
        .maybeSingle();
      setSettingsId((data as any)?.id ?? null);
      const raw = (data as any)?.tactical_areas;
      const list: TacticalArea[] = Array.isArray(raw) && raw.length ? raw : DEFAULT_AREAS;
      // ensure all default areas are present (backfill new ones)
      const merged = DEFAULT_AREAS.map((d) => list.find((l) => l.key === d.key) ?? d);
      // include any custom extras that may exist in DB
      const extras = list.filter((l) => !DEFAULT_AREAS.some((d) => d.key === l.key));
      const finalList = [...merged, ...extras]
        .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
        .map((a, i) => ({ ...a, sort_order: i + 1 }));
      setAreas(finalList);
      setLoading(false);
    })();
  }, [open]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= areas.length) return;
    const next = [...areas];
    [next[idx], next[j]] = [next[j], next[idx]];
    setAreas(next.map((a, i) => ({ ...a, sort_order: i + 1 })));
  };

  const toggle = (idx: number, v: boolean) => {
    const next = [...areas];
    next[idx] = { ...next[idx], enabled: v };
    setAreas(next);
  };

  const rename = (idx: number, label: string) => {
    const next = [...areas];
    next[idx] = { ...next[idx], label };
    setAreas(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = areas.map((a, i) => ({ ...a, sort_order: i + 1 }));
      let error;
      if (settingsId) {
        ({ error } = await supabase
          .from('business_settings')
          .update({ tactical_areas: payload as any })
          .eq('id', settingsId));
      } else {
        ({ error } = await supabase
          .from('business_settings')
          .insert({ tactical_areas: payload as any } as any));
      }
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['tactical-areas'] });
      toast.success('Áreas atualizadas');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerir áreas táticas</DialogTitle>
          <DialogDescription>
            Ative apenas as áreas relevantes para o seu negócio e ajuste a ordem em que aparecem no planeamento.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> A carregar…
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {areas.map((a, idx) => (
              <div
                key={a.key}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === areas.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={a.label}
                  onChange={(e) => rename(idx, e.target.value)}
                  className="h-8 flex-1"
                />
                <Switch checked={a.enabled !== false} onCheckedChange={(v) => toggle(idx, v)} />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}