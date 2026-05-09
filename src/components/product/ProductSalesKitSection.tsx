import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ExternalLink, FileText, Shield, Sparkles, Quote, Megaphone } from 'lucide-react';
import { useDeleteWithConfirm } from '@/hooks/useDeleteWithConfirm';

type Benefit       = { title: string; description: string };
type Material      = { name: string; url: string; type: string };
type Objection     = { objection: string; response: string };
type CaseStudy     = { client: string; result: string; description: string };

interface Props {
  presentationUrl: string;
  pitch: string;
  benefits: Benefit[];
  materials: Material[];
  objections: Objection[];
  caseStudies: CaseStudy[];
  isOwner: boolean;
  onUpdate: (field: string, value: unknown) => void;
}

export function ProductSalesKitSection({
  presentationUrl, pitch, benefits, materials, objections, caseStudies, isOwner, onUpdate,
}: Props) {
  const confirmDelete = useDeleteWithConfirm();

  // Generic helpers
  const updateAt = <T,>(arr: T[], i: number, patch: Partial<T>): T[] =>
    arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
  const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, idx) => idx !== i);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">

      {/* ─── Apresentação + Pitch ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Apresentação Comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Link da apresentação (Google Slides, PDF, etc.)</Label>
            <div className="flex gap-2">
              <Input
                value={presentationUrl || ''}
                onChange={e => onUpdate('sales_presentation_url', e.target.value)}
                placeholder="https://..."
                disabled={!isOwner}
              />
              {presentationUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={presentationUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Argumentário / Pitch (o que dizer ao cliente)</Label>
            <Textarea
              value={pitch || ''}
              onChange={e => onUpdate('sales_pitch', e.target.value)}
              placeholder="Resumo persuasivo: problema, solução, transformação..."
              rows={5}
              disabled={!isOwner}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Benefícios ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-success" />
            Benefícios para destacar
          </CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('sales_benefits', [...benefits, { title: '', description: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {benefits.length === 0 && <p className="text-xs text-muted-foreground">Sem benefícios definidos.</p>}
          {benefits.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <Input value={b.title} placeholder="Benefício" disabled={!isOwner}
                onChange={e => onUpdate('sales_benefits', updateAt(benefits, i, { title: e.target.value }))} />
              <Input value={b.description} placeholder="Como explicar este benefício" disabled={!isOwner}
                onChange={e => onUpdate('sales_benefits', updateAt(benefits, i, { description: e.target.value }))} />
              {isOwner && (
                <Button size="sm" variant="ghost"
                  onClick={() => confirmDelete({ entity: 'benefício', name: b.title }, () =>
                    onUpdate('sales_benefits', removeAt(benefits, i)))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Materiais (links/PDFs) ────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Materiais de apoio
          </CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('sales_materials', [...materials, { name: '', url: '', type: 'link' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {materials.length === 0 && <p className="text-xs text-muted-foreground">Sem materiais.</p>}
          {materials.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto_auto] gap-2 items-center">
              <Input value={m.name} placeholder="Nome" disabled={!isOwner}
                onChange={e => onUpdate('sales_materials', updateAt(materials, i, { name: e.target.value }))} />
              <Input value={m.type} placeholder="PDF / Vídeo / Link" disabled={!isOwner}
                onChange={e => onUpdate('sales_materials', updateAt(materials, i, { type: e.target.value }))} />
              <Input value={m.url} placeholder="https://..." disabled={!isOwner}
                onChange={e => onUpdate('sales_materials', updateAt(materials, i, { url: e.target.value }))} />
              {m.url ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={m.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              ) : <span />}
              {isOwner && (
                <Button size="sm" variant="ghost"
                  onClick={() => confirmDelete({ entity: 'material', name: m.name }, () =>
                    onUpdate('sales_materials', removeAt(materials, i)))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Objeções ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-warning" />
            Perguntas e Objeções de Venda
          </CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('sales_objections', [...objections, { objection: '', response: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {objections.length === 0 && <p className="text-xs text-muted-foreground">Sem objeções registadas.</p>}
          {objections.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start border border-border/50 rounded-md p-3">
              <div className="space-y-2 min-w-0">
                <Input value={o.objection} placeholder="Objeção (ex: É caro)" disabled={!isOwner}
                  onChange={e => onUpdate('sales_objections', updateAt(objections, i, { objection: e.target.value }))} />
                <Textarea value={o.response} placeholder="Como responder" rows={2} disabled={!isOwner}
                  onChange={e => onUpdate('sales_objections', updateAt(objections, i, { response: e.target.value }))} />
              </div>
              {isOwner && (
                <Button size="sm" variant="ghost"
                  onClick={() => confirmDelete({ entity: 'objeção', name: o.objection }, () =>
                    onUpdate('sales_objections', removeAt(objections, i)))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Casos de sucesso ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Quote className="h-4 w-4 text-accent-violet" />
            Casos de sucesso / testemunhos
          </CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('sales_case_studies', [...caseStudies, { client: '', result: '', description: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {caseStudies.length === 0 && <p className="text-xs text-muted-foreground">Sem casos.</p>}
          {caseStudies.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start border border-border/50 rounded-md p-3">
              <div className="grid grid-cols-2 gap-2 min-w-0">
                <Input value={c.client} placeholder="Cliente" disabled={!isOwner}
                  onChange={e => onUpdate('sales_case_studies', updateAt(caseStudies, i, { client: e.target.value }))} />
                <Input value={c.result} placeholder="Resultado-chave (ex: +30% vendas)" disabled={!isOwner}
                  onChange={e => onUpdate('sales_case_studies', updateAt(caseStudies, i, { result: e.target.value }))} />
                <Textarea className="col-span-2" value={c.description} placeholder="Detalhe do caso" rows={2} disabled={!isOwner}
                  onChange={e => onUpdate('sales_case_studies', updateAt(caseStudies, i, { description: e.target.value }))} />
              </div>
              {isOwner && (
                <Button size="sm" variant="ghost"
                  onClick={() => confirmDelete({ entity: 'caso', name: c.client }, () =>
                    onUpdate('sales_case_studies', removeAt(caseStudies, i)))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}