import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, FileText, Link2, GitBranch } from 'lucide-react';
import { Label } from '@/components/ui/label';

type FaqItem = { question: string; answer: string };
type MaterialItem = { file_name: string; file_url: string; file_type?: string; description?: string };
type TimelineItem = { title: string; status?: string };

interface Props {
  faqs: FaqItem[];
  materials: MaterialItem[];
  timeline: TimelineItem[];
  isOwner: boolean;
  onUpdate: (field: 'portal_faqs_template' | 'portal_materials_template' | 'portal_timeline_template', value: unknown) => void;
}

export function ProductPortalTemplateSection({ faqs, materials, timeline, isOwner, onUpdate }: Props) {
  const safeFaqs = Array.isArray(faqs) ? faqs : [];
  const safeMaterials = Array.isArray(materials) ? materials : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card className="hq-card">
        <CardHeader>
          <CardTitle className="text-base">Template do Portal de Cliente</CardTitle>
          <CardDescription>
            Estes itens são aplicados aos portais de cliente <strong>quando carregares no botão "Aplicar template"</strong> dentro do portal de cada cliente. Não afetam portais existentes automaticamente.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* FAQs */}
      <Card className="hq-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Perguntas frequentes ({safeFaqs.length})</CardTitle>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('portal_faqs_template', [...safeFaqs, { question: '', answer: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {safeFaqs.length === 0 && <p className="text-sm text-muted-foreground">Sem FAQs no template.</p>}
          {safeFaqs.map((item, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
              <div className="flex gap-2">
                <Input
                  placeholder="Pergunta"
                  value={item.question || ''}
                  disabled={!isOwner}
                  onChange={(e) => {
                    const next = [...safeFaqs];
                    next[idx] = { ...item, question: e.target.value };
                    onUpdate('portal_faqs_template', next);
                  }}
                />
                {isOwner && (
                  <Button size="icon" variant="ghost" onClick={() => onUpdate('portal_faqs_template', safeFaqs.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Resposta"
                value={item.answer || ''}
                disabled={!isOwner}
                rows={2}
                onChange={(e) => {
                  const next = [...safeFaqs];
                  next[idx] = { ...item, answer: e.target.value };
                  onUpdate('portal_faqs_template', next);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Materials */}
      <Card className="hq-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Materiais e links ({safeMaterials.length})</CardTitle>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('portal_materials_template', [...safeMaterials, { file_name: '', file_url: '', file_type: 'link', description: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {safeMaterials.length === 0 && <p className="text-sm text-muted-foreground">Sem materiais no template.</p>}
          {safeMaterials.map((item, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    placeholder="Nome do material"
                    value={item.file_name || ''}
                    disabled={!isOwner}
                    onChange={(e) => {
                      const next = [...safeMaterials];
                      next[idx] = { ...item, file_name: e.target.value };
                      onUpdate('portal_materials_template', next);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input
                    placeholder="https://..."
                    value={item.file_url || ''}
                    disabled={!isOwner}
                    onChange={(e) => {
                      const next = [...safeMaterials];
                      next[idx] = { ...item, file_url: e.target.value };
                      onUpdate('portal_materials_template', next);
                    }}
                  />
                </div>
              </div>
              <Input
                placeholder="Descrição (opcional)"
                value={item.description || ''}
                disabled={!isOwner}
                onChange={(e) => {
                  const next = [...safeMaterials];
                  next[idx] = { ...item, description: e.target.value };
                  onUpdate('portal_materials_template', next);
                }}
              />
              {isOwner && (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => onUpdate('portal_materials_template', safeMaterials.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="hq-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Fases de timeline ({safeTimeline.length})</CardTitle>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={() => onUpdate('portal_timeline_template', [...safeTimeline, { title: '', status: 'por_comecar' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {safeTimeline.length === 0 && <p className="text-sm text-muted-foreground">Sem fases no template.</p>}
          {safeTimeline.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center rounded-lg border p-3 bg-muted/20">
              <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
              <Input
                placeholder="Nome da fase"
                value={item.title || ''}
                disabled={!isOwner}
                onChange={(e) => {
                  const next = [...safeTimeline];
                  next[idx] = { ...item, title: e.target.value };
                  onUpdate('portal_timeline_template', next);
                }}
              />
              {isOwner && (
                <Button size="icon" variant="ghost" onClick={() => onUpdate('portal_timeline_template', safeTimeline.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}