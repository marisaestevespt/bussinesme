import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Props {
  productContents: Array<Record<string, unknown>>;
  funnels: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
  trafficAds: Array<Record<string, unknown>>;
  isOwner: boolean;
  productName: string;
  onAddFunnel: () => void;
  onAddAutomation: () => void;
  onAddTrafficAd: () => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductMarketingSection({
  productContents, funnels, automations, trafficAds, isOwner,
  onAddFunnel, onAddAutomation, onAddTrafficAd, onDeleteRow,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
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
