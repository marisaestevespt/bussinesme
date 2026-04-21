import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAGE_TYPES = [
  { value: 'vendas', label: 'Vendas' },
  { value: 'candidatura', label: 'Candidatura' },
  { value: 'obrigado', label: 'Obrigado' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'downsell', label: 'Downsell' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'optin', label: 'Opt-in / Captura' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'outro', label: 'Outro' },
];

const PAGE_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  { value: 'a_escrever', label: 'A escrever', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'em_design', label: 'Em design', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'pronto', label: 'Pronto', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
];

interface PageSection { title: string; notes: string; done: boolean }
interface PageInspiration { label: string; url: string }
interface MarketingPage {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  url?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  copy?: string;
  sections?: PageSection[];
  inspirations?: PageInspiration[];
  notes?: string;
}

interface Props {
  productContents: Array<Record<string, unknown>>;
  funnels: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
  trafficAds: Array<Record<string, unknown>>;
  isOwner: boolean;
  productName: string;
  salesPage: Record<string, unknown>;
  salesPageUrl: string;
  onUpdateSalesPage: (next: Record<string, unknown>) => void;
  onUpdateSalesPageUrl: (url: string) => void;
  onAddFunnel: () => void;
  onAddAutomation: () => void;
  onAddTrafficAd: () => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductMarketingSection({
  productContents, funnels, automations, trafficAds, isOwner,
  salesPage, salesPageUrl, onUpdateSalesPage, onUpdateSalesPageUrl,
  onAddFunnel, onAddAutomation, onAddTrafficAd, onDeleteRow,
}: Props) {
  const navigate = useNavigate();
  const sp = salesPage || {};
  const setSp = (patch: Record<string, unknown>) => onUpdateSalesPage({ ...sp, ...patch });

  // Migração suave: se ainda só existir o objeto antigo (sem `pages`), criamos uma página inicial a partir dele.
  let pages: MarketingPage[] = Array.isArray(sp.pages) ? (sp.pages as MarketingPage[]) : [];
  if (pages.length === 0 && (sp.copy || sp.headline || sp.cta || sp.subheadline || (Array.isArray(sp.sections) && (sp.sections as unknown[]).length))) {
    pages = [{
      id: 'legacy',
      name: 'Página de Vendas',
      type: 'vendas',
      status: 'por_comecar',
      url: salesPageUrl || '',
      headline: (sp.headline as string) || '',
      subheadline: (sp.subheadline as string) || '',
      cta: (sp.cta as string) || '',
      copy: (sp.copy as string) || '',
      sections: (Array.isArray(sp.sections) ? sp.sections : []) as PageSection[],
      inspirations: (Array.isArray(sp.inspirations) ? sp.inspirations : []) as PageInspiration[],
      notes: (sp.notes as string) || '',
    }];
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Páginas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Páginas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Página de vendas, candidatura, obrigado, upsell, etc.</p>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => setSp({ pages: [...pages, { id: crypto.randomUUID(), name: 'Nova página', type: 'vendas', status: 'por_comecar', url: '', headline: '', subheadline: '', cta: '', copy: '', sections: [], inspirations: [], notes: '' }] })}>
              <Plus className="h-3 w-3 mr-1" /> Nova Página
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {pages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sem páginas criadas. Adiciona a primeira (ex: Página de Vendas).</p>
          )}
          <Accordion type="multiple" className="w-full space-y-2">
            {pages.map((page, pageIdx) => {
              const updatePage = (patch: Partial<MarketingPage>) => {
                const next = [...pages];
                next[pageIdx] = { ...next[pageIdx], ...patch };
                setSp({ pages: next });
              };
              const pageSections = page.sections || [];
              const pageInspirations = page.inspirations || [];
              const statusOpt = PAGE_STATUSES.find(s => s.value === (page.status || 'por_comecar')) || PAGE_STATUSES[0];
              return (
                <AccordionItem key={page.id || pageIdx} value={page.id || `p-${pageIdx}`} className="border rounded-lg px-3">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">{page.type || 'vendas'}</Badge>
                      <span className="font-medium text-sm flex-1 truncate">{page.name || 'Sem nome'}</span>
                      <Badge className={cn('text-[10px] shrink-0', statusOpt.color)}>{statusOpt.label}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input value={page.name || ''} onChange={e => updatePage({ name: e.target.value })} className="h-9" readOnly={!isOwner} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Tipo</Label>
                        <Select value={page.type || 'vendas'} onValueChange={v => updatePage({ type: v })} disabled={!isOwner}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select value={page.status || 'por_comecar'} onValueChange={v => updatePage({ status: v })} disabled={!isOwner}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAGE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">URL</Label>
                      <div className="flex items-center gap-1">
                        <Input value={page.url || ''} onChange={e => updatePage({ url: e.target.value })} placeholder="https://..." className="h-9" readOnly={!isOwner} />
                        {page.url && <a href={page.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><ExternalLink className="h-4 w-4 text-primary" /></a>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Headline</Label>
                        <Input value={page.headline || ''} onChange={e => updatePage({ headline: e.target.value })} className="h-9" readOnly={!isOwner} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">CTA Principal</Label>
                        <Input value={page.cta || ''} onChange={e => updatePage({ cta: e.target.value })} className="h-9" readOnly={!isOwner} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Sub-headline</Label>
                      <Textarea value={page.subheadline || ''} onChange={e => updatePage({ subheadline: e.target.value })} className="min-h-[60px] text-sm" readOnly={!isOwner} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Copy completo</Label>
                      <RichTextEditor content={page.copy || ''} onChange={v => updatePage({ copy: v })} editable={isOwner} />
                    </div>

                    {/* Secções */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Secções</Label>
                      {pageSections.length === 0 && <p className="text-xs text-muted-foreground italic">Sem secções.</p>}
                      {pageSections.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start border rounded-md p-2">
                          <input type="checkbox" checked={!!s.done} onChange={e => { const next = [...pageSections]; next[i] = { ...next[i], done: e.target.checked }; updatePage({ sections: next }); }} disabled={!isOwner} className="mt-2 shrink-0" />
                          <div className="flex-1 space-y-1">
                            <Input value={s.title} onChange={e => { const next = [...pageSections]; next[i] = { ...next[i], title: e.target.value }; updatePage({ sections: next }); }} placeholder="Nome da secção (Hero, Benefícios, FAQ...)" className="h-8 text-sm" readOnly={!isOwner} />
                            <Textarea value={s.notes} onChange={e => { const next = [...pageSections]; next[i] = { ...next[i], notes: e.target.value }; updatePage({ sections: next }); }} placeholder="Notas / copy desta secção" className="min-h-[50px] text-xs" readOnly={!isOwner} />
                          </div>
                          {isOwner && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updatePage({ sections: pageSections.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>
                          )}
                        </div>
                      ))}
                      {isOwner && (
                        <Button variant="outline" size="sm" onClick={() => updatePage({ sections: [...pageSections, { title: '', notes: '', done: false }] })}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar secção
                        </Button>
                      )}
                    </div>

                    {/* Inspirações */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Inspirações / Referências</Label>
                      {pageInspirations.map((item, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input value={item.label} onChange={e => { const next = [...pageInspirations]; next[i] = { ...next[i], label: e.target.value }; updatePage({ inspirations: next }); }} placeholder="Nome" className="h-8 text-sm w-1/3" readOnly={!isOwner} />
                          <Input value={item.url} onChange={e => { const next = [...pageInspirations]; next[i] = { ...next[i], url: e.target.value }; updatePage({ inspirations: next }); }} placeholder="https://..." className="h-8 text-sm flex-1" readOnly={!isOwner} />
                          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><ExternalLink className="h-4 w-4 text-primary" /></a>}
                          {isOwner && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => updatePage({ inspirations: pageInspirations.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></Button>}
                        </div>
                      ))}
                      {isOwner && (
                        <Button variant="outline" size="sm" onClick={() => updatePage({ inspirations: [...pageInspirations, { label: '', url: '' }] })}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar inspiração
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notas internas</Label>
                      <Textarea value={page.notes || ''} onChange={e => updatePage({ notes: e.target.value })} className="min-h-[60px] text-sm" readOnly={!isOwner} />
                    </div>

                    {isOwner && (
                      <div className="flex justify-end pt-2 border-t">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setSp({ pages: pages.filter((_, j) => j !== pageIdx) })}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remover página
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>


      {/* Conteúdos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Conteúdos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Conteúdos do calendário de conteúdos associados a este produto.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productContents.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem conteúdos associados a este produto</TableCell></TableRow>
              )}
              {productContents.map((c) => (
                <TableRow key={c.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/marketing/conteudos/${c.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((c.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{c.title as string}</TableCell>
                  <TableCell className="text-sm">{(c.format as string) || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.scheduled_at ? format(new Date(c.scheduled_at as string), 'dd/MM/yyyy') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Funis */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Funis</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddFunnel}>
              <Plus className="h-3 w-3 mr-1" /> Novo Funil
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atualização</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem funis</TableCell></TableRow>
              )}
              {funnels.map((f) => (
                <TableRow key={f.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/funis/${f.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((f.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{f.name as string}</TableCell>
                  <TableCell className="text-sm">{(f.tipo_funil as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(f.objetivo as string) || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(f.updated_at as string), 'dd/MM/yyyy')}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('marketing_funnels', f.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Automações */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Automações</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddAutomation}>
              <Plus className="h-3 w-3 mr-1" /> Nova Automação
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Atualização</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sem automações</TableCell></TableRow>
              )}
              {automations.map((a) => (
                <TableRow key={a.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/automacoes/${a.id}`)}>
                  <TableCell><Badge variant="outline" className="text-xs">{((a.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="font-medium">{a.name as string}</TableCell>
                  <TableCell className="text-sm">{(a.plataforma as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(a.objetivo as string) || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(a.updated_at as string), 'dd/MM/yyyy')}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('marketing_automations', a.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tráfego Pago */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tráfego Pago</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddTrafficAd}>
              <Plus className="h-3 w-3 mr-1" /> Novo Criativo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Início</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Link</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trafficAds.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Sem criativos</TableCell></TableRow>
              )}
              {trafficAds.map((ad) => (
                <TableRow key={ad.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/marketing/trafego-pago/criativo/${ad.id}`)}>
                  <TableCell className="text-sm">{ad.start_date ? format(new Date(ad.start_date as string), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="font-medium">{ad.name as string}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{((ad.status as string) || '').replace('_', ' ') || '—'}</Badge></TableCell>
                  <TableCell className="text-sm">{(ad.formato as string) || '—'}</TableCell>
                  <TableCell className="text-sm">{(ad.objetivo as string) || '—'}</TableCell>
                  <TableCell>{ad.link ? <a href={ad.link as string} target="_blank" rel="noopener noreferrer" className="text-primary text-xs" onClick={e => e.stopPropagation()}><ExternalLink className="h-3 w-3" /></a> : '—'}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDeleteRow('traffic_creatives', ad.id as string); }}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
