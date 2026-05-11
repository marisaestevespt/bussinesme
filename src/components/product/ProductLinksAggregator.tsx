import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Link2, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProduct } from '@/hooks/useProducts';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { InlineField } from '@/components/product/InlineField';

interface AggregatedLink {
  id?: string;
  label: string;
  url: string;
  origin: string;
  editable?: boolean;
}

interface Props {
  productId: string;
  manualLinks: Array<Record<string, unknown>>;
  isOwner?: boolean;
  onAddManual?: () => void;
  onUpdateManual?: (id: string, data: Record<string, unknown>) => void;
  onDeleteManual?: (id: string) => void;
}

/**
 * Card único de "Todos os Links do Produto":
 * - Recolhe automaticamente links de outras secções (Geral, Branding, Comercial) — read-only.
 * - Permite criar / editar / remover links manuais inline.
 */
export function ProductLinksAggregator({
  productId, manualLinks, isOwner = false, onAddManual, onUpdateManual, onDeleteManual,
}: Props) {
  const { data: product } = useProduct(productId);

  const aggregated = useMemo<AggregatedLink[]>(() => {
    if (!product) return [];
    const out: AggregatedLink[] = [];
    const push = (label: string, url: unknown, origin: string, opts?: { id?: string; editable?: boolean }) => {
      if (typeof url === 'string' && url.trim()) {
        out.push({ label: label || url, url: url.trim(), origin, ...(opts || {}) });
      }
    };

    push('Página de Vendas', (product as any).sales_page_url, 'Geral');
    push('Drive', (product as any).drive_url, 'Geral');

    const branding: any = (product as any).branding || {};
    (branding.folders || []).forEach((l: any) =>
      push(l?.label || 'Pasta', l?.url, 'Branding · Pastas'));
    (branding.visual_assets || []).forEach((l: any) =>
      push(l?.label || 'Asset visual', l?.url, 'Branding · Assets'));

    push('Apresentação de Vendas', (product as any).sales_presentation_url, 'Comercial · Sales Kit');
    ((product as any).sales_materials || []).forEach((m: any) =>
      push(m?.name || 'Material', m?.url, 'Comercial · Materiais'));

    manualLinks.forEach(l =>
      push((l.name as string) || 'Link', l.url, 'Manual', { id: l.id as string, editable: true }));

    const seen = new Set<string>();
    return out.filter(l => {
      const k = l.url.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [product, manualLinks]);

  const copyAll = () => {
    const text = aggregated.map(l => `${l.label} — ${l.url}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`${aggregated.length} links copiados`);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Todos os Links do Produto
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Recolhe automaticamente links de outras secções (Geral, Branding, Comercial). Podes também adicionar manuais aqui.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aggregated.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar todos
            </Button>
          )}
          {isOwner && onAddManual && (
            <Button size="sm" variant="outline" onClick={onAddManual}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar manual
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {aggregated.length === 0 ? (
          <EmptyHint>Sem links registados em nenhuma secção.</EmptyHint>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.map((l, i) => (
                <TableRow key={`${l.url}-${i}`}>
                  <TableCell className="font-medium text-sm">
                    {isOwner && l.editable && l.id ? (
                      <InlineField
                        value={l.label === l.url ? '' : l.label}
                        placeholder="Nome (opcional)…"
                        bold
                        onSave={v => onUpdateManual?.(l.id!, { name: v.trim() || null })}
                      />
                    ) : l.label}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                    {isOwner && l.editable && l.id ? (
                      <InlineField
                        value={l.url}
                        placeholder="https://…"
                        onSave={v => {
                          const url = v.trim();
                          if (!url) { toast.error('URL obrigatório'); return; }
                          onUpdateManual?.(l.id!, { url });
                        }}
                      />
                    ) : (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate block">
                        {l.url}
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-normal">{l.origin}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex p-1 rounded hover:bg-muted" aria-label="Abrir">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                      {isOwner && l.editable && l.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteManual?.(l.id!)} aria-label="Eliminar"><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}