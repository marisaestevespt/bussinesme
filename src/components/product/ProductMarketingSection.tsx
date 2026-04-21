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
  const sections = (Array.isArray(sp.sections) ? sp.sections : []) as Array<{ title: string; notes: string; done: boolean }>;
  const inspirations = (Array.isArray(sp.inspirations) ? sp.inspirations : []) as Array<{ label: string; url: string }>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Página de Vendas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Página de Vendas</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL da página</Label>
              <div className="flex items-center gap-1">
                <Input
                  value={salesPageUrl || ''}
                  onChange={(e) => onUpdateSalesPageUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-9"
                  readOnly={!isOwner}
                />
                {salesPageUrl && (
                  <a href={salesPageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CTA Principal</Label>
              <Input
                value={(sp.cta as string) || ''}
                onChange={(e) => setSp({ cta: e.target.value })}
                placeholder="Ex: Quero candidatar-me"
                className="h-9"
                readOnly={!isOwner}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Headline</Label>
            <Input
              value={(sp.headline as string) || ''}
              onChange={(e) => setSp({ headline: e.target.value })}
              placeholder="Título principal da página"
              className="h-9"
              readOnly={!isOwner}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sub-headline</Label>
            <Textarea
              value={(sp.subheadline as string) || ''}
              onChange={(e) => setSp({ subheadline: e.target.value })}
              placeholder="Frase de apoio ao headline"
              className="min-h-[60px] text-sm"
              readOnly={!isOwner}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Copy completo da página</Label>
            <RichTextEditor
              content={(sp.copy as string) || ''}
              onChange={(v) => setSp({ copy: v })}
              editable={isOwner}
            />
          </div>

          {/* Secções / checklist */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Secções da página</Label>
            {sections.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sem secções definidas.</p>
            )}
            {sections.map((s, i) => (
              <div key={i} className="flex gap-2 items-start border rounded-md p-2">
                <input
                  type="checkbox"
                  checked={!!s.done}
                  onChange={(e) => {
                    const next = [...sections];
                    next[i] = { ...next[i], done: e.target.checked };
                    setSp({ sections: next });
                  }}
                  disabled={!isOwner}
                  className="mt-2 shrink-0"
                />
                <div className="flex-1 space-y-1">
                  <Input
                    value={s.title}
                    onChange={(e) => {
                      const next = [...sections];
                      next[i] = { ...next[i], title: e.target.value };
                      setSp({ sections: next });
                    }}
                    placeholder="Nome da secção (ex: Hero, Benefícios, FAQ)"
                    className="h-8 text-sm"
                    readOnly={!isOwner}
                  />
                  <Textarea
                    value={s.notes}
                    onChange={(e) => {
                      const next = [...sections];
                      next[i] = { ...next[i], notes: e.target.value };
                      setSp({ sections: next });
                    }}
                    placeholder="Notas / copy desta secção"
                    className="min-h-[50px] text-xs"
                    readOnly={!isOwner}
                  />
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setSp({ sections: sections.filter((_, j) => j !== i) })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSp({ sections: [...sections, { title: '', notes: '', done: false }] })}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar secção
              </Button>
            )}
          </div>

          {/* Inspirações */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Inspirações / Referências</Label>
            {inspirations.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...inspirations];
                    next[i] = { ...next[i], label: e.target.value };
                    setSp({ inspirations: next });
                  }}
                  placeholder="Nome"
                  className="h-8 text-sm w-1/3"
                  readOnly={!isOwner}
                />
                <Input
                  value={item.url}
                  onChange={(e) => {
                    const next = [...inspirations];
                    next[i] = { ...next[i], url: e.target.value };
                    setSp({ inspirations: next });
                  }}
                  placeholder="https://..."
                  className="h-8 text-sm flex-1"
                  readOnly={!isOwner}
                />
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </a>
                )}
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setSp({ inspirations: inspirations.filter((_, j) => j !== i) })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSp({ inspirations: [...inspirations, { label: '', url: '' }] })}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar inspiração
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notas internas</Label>
            <Textarea
              value={(sp.notes as string) || ''}
              onChange={(e) => setSp({ notes: e.target.value })}
              placeholder="Pendências, ideias, testes A/B..."
              className="min-h-[80px] text-sm"
              readOnly={!isOwner}
            />
          </div>
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
