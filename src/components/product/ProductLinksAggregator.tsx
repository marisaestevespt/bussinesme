import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Link2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useProduct } from '@/hooks/useProducts';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface AggregatedLink {
  label: string;
  url: string;
  origin: string;
}

interface Props {
  productId: string;
  /** Links manuais já carregados em product_useful_links (para incluir na agregação). */
  manualLinks: Array<Record<string, unknown>>;
}

/**
 * Agregador de todos os links espalhados pela ficha do produto:
 * sales_page_url, drive_url, branding.folders, branding.visual_assets,
 * sales_presentation_url, sales_materials e os manuais de product_useful_links.
 * Tudo read-only — para editar, vai à secção de origem.
 */
export function ProductLinksAggregator({ productId, manualLinks }: Props) {
  const { data: product } = useProduct(productId);

  const aggregated = useMemo<AggregatedLink[]>(() => {
    if (!product) return [];
    const out: AggregatedLink[] = [];
    const push = (label: string, url: unknown, origin: string) => {
      if (typeof url === 'string' && url.trim()) out.push({ label: label || url, url: url.trim(), origin });
    };

    // Header / Geral
    push('Página de Vendas', (product as any).sales_page_url, 'Geral');
    push('Drive', (product as any).drive_url, 'Geral');

    // Branding
    const branding: any = (product as any).branding || {};
    (branding.folders || []).forEach((l: any) =>
      push(l?.label || 'Pasta', l?.url, 'Branding · Pastas'));
    (branding.visual_assets || []).forEach((l: any) =>
      push(l?.label || 'Asset visual', l?.url, 'Branding · Assets'));

    // Sales kit
    push('Apresentação de Vendas', (product as any).sales_presentation_url, 'Comercial · Sales Kit');
    ((product as any).sales_materials || []).forEach((m: any) =>
      push(m?.name || 'Material', m?.url, 'Comercial · Materiais'));

    // Links manuais (Backoffice)
    manualLinks.forEach(l =>
      push((l.name as string) || 'Link', l.url, 'Backoffice · Manual'));

    // Dedupe por URL mantendo primeira origem
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
            Vista agregada (read-only). Para editar, vai à secção de origem.
          </p>
        </div>
        {aggregated.length > 0 && (
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar todos
          </Button>
        )}
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
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.map((l, i) => (
                <TableRow key={`${l.url}-${i}`}>
                  <TableCell className="font-medium text-sm">{l.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {l.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-normal">{l.origin}</Badge>
                  </TableCell>
                  <TableCell>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex p-1 rounded hover:bg-muted">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
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