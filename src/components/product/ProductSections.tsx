import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, X, Upload, Download, FileText, Video, ArrowLeft, StickyNote, Lightbulb, Calculator } from 'lucide-react';
import { SharedMeetingsList, type SharedMeetingItem } from '@/components/shared/SharedMeetingsList';

import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/RichTextEditor';
import { LinkedSopsSection } from '@/components/LinkedSopsSection';
import { ProductDiagnosticQuestions } from '@/components/product/ProductDiagnosticQuestions';
import { ArchiveDocumentsView } from '@/components/product/archive/ArchiveDocumentsView';
import { RichEditor } from '@/components/product/archive/RichEditor';
import { ProductLinksAggregator } from '@/components/product/ProductLinksAggregator';
import { PricingWorkspace } from '@/components/product/PricingWorkspace';

// ─── Processos Section ─────────────────────────────────────────
import { getSopStatusInfo } from '@/lib/sopStatus';

interface ProcessosSectionProps {
  productSops: Array<Record<string, unknown>>;
  isOwner: boolean;
  productId: string;
  onUpdateRow: (table: string, id: string, data: Record<string, unknown>) => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductProcessosSection({ productSops, isOwner, productId, onUpdateRow, onDeleteRow }: ProcessosSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card>
        <CardHeader><CardTitle className="text-base">Processos (SOPs)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productSops.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem processos associados</TableCell></TableRow>
              )}
              {productSops.map((sop) => {
                const st = getSopStatusInfo(sop.status as string);
                return (
                  <TableRow key={sop.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                    <TableCell className="font-mono text-muted-foreground">{sop.sop_id as string}</TableCell>
                    <TableCell className="font-medium text-sm">{sop.name as string}</TableCell>
                    <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diagnostic Questions */}
      <ProductDiagnosticQuestions productId={productId} isOwner={isOwner} />
    </div>
  );
}

// ─── Backoffice Section ────────────────────────────────────────

interface BackofficeSectionProps {
  usefulLinks: Array<Record<string, unknown>>;
  improvements: Array<Record<string, unknown>>;
  productMeetings: Array<Record<string, unknown>>;
  isOwner: boolean;
  productId: string;
  onAddLink: () => void;
  onAddImprovement: () => void;
  onUpdateRow: (table: string, id: string, data: Record<string, unknown>) => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductBackofficeSection({ usefulLinks, improvements, productMeetings, isOwner, productId, onAddLink, onAddImprovement, onUpdateRow, onDeleteRow }: BackofficeSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      {productId && (
        <ProductLinksAggregator
          productId={productId}
          manualLinks={usefulLinks}
          isOwner={isOwner}
          onAddManual={onAddLink}
          onUpdateManual={(id, data) => onUpdateRow('product_useful_links', id, data)}
          onDeleteManual={(id) => onDeleteRow('product_useful_links', id)}
        />
      )}

      {/* Reuniões do produto (operacional) — usa o mesmo UI da página Reuniões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" /> Reuniões deste Produto
          </CardTitle>
          <p className="text-xs text-muted-foreground">Inclui reuniões com clientes e internas.</p>
        </CardHeader>
        <CardContent>
          <SharedMeetingsList
            items={productMeetings as unknown as SharedMeetingItem[]}
            emptyLabel="Sem reuniões associadas a este produto."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Melhorias</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddImprovement}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {improvements.length === 0 ? (
            <EmptyHint>Nenhuma melhoria registada.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {improvements.map((item) => (
                <div key={item.id as string} className="flex items-start gap-3 group">
                  <Checkbox
                    checked={item.completed as boolean}
                    onCheckedChange={(checked) => onUpdateRow('product_improvements', item.id as string, { completed: !!checked })}
                    disabled={!isOwner}
                    className="mt-0.5"
                  />
                  <Input
                    value={item.description as string}
                    onChange={e => onUpdateRow('product_improvements', item.id as string, { description: e.target.value })}
                    className={cn("flex-1 h-8 text-sm", item.completed && "line-through text-muted-foreground")}
                    placeholder="Descrever melhoria..."
                    readOnly={!isOwner}
                  />
                  {isOwner && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => onDeleteRow('product_improvements', item.id as string)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Arquivo Section ───────────────────────────────────────────

interface ArquivoSectionProps {
  productDocuments: Array<Record<string, unknown>>;
  archiveNotes: string;
  brainstormingContent: string;
  isOwner: boolean;
  productId: string;
  onUpdateField: (field: string, value: string) => void;
}

export function ProductArquivoSection({ productDocuments, archiveNotes, brainstormingContent, isOwner, productId, onUpdateField }: ArquivoSectionProps) {
  const [view, setView] = useState<'gallery' | 'documentos' | 'notas' | 'brainstorming'>('gallery');
  const navigate = useNavigate();
  const [projectBrainstorms, setProjectBrainstorms] = useState<Array<{ id: string; name: string; client_name: string | null; brainstorming: string }>>([]);

  useEffect(() => {
    if (view !== 'brainstorming' || !productId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_name, brainstorming')
        .eq('product_id', productId)
        .not('brainstorming', 'is', null);
      if (cancelled) return;
      const rows = (data || []).filter((p: any) => (p.brainstorming || '').replace(/<[^>]+>/g, '').trim().length > 0);
      setProjectBrainstorms(rows as any);
    })();
    return () => { cancelled = true; };
  }, [view, productId]);

  if (view === 'documentos') {
    return (
      <ArchiveDocumentsView
        productId={productId}
        documents={productDocuments as unknown as Parameters<typeof ArchiveDocumentsView>[0]['documents']}
        isOwner={isOwner}
        onBack={() => setView('gallery')}
      />
    );
  }

  if (view === 'notas') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Arquivo
          </Button>
          <h2 className="text-lg font-semibold">Notas</h2>
          <div className="w-32" />
        </div>
        <Textarea
          value={archiveNotes}
          onChange={e => onUpdateField('archive_notes', e.target.value)}
          readOnly={!isOwner}
          placeholder="Escreve as tuas notas aqui..."
          className="min-h-[500px] resize-y text-sm leading-relaxed"
        />
      </div>
    );
  }

  if (view === 'brainstorming') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Arquivo
          </Button>
          <h2 className="text-lg font-semibold">Brainstorming</h2>
          <div className="w-32" />
        </div>
        <RichEditor
          content={brainstormingContent}
          onChange={v => onUpdateField('brainstorming_content', v)}
          editable={isOwner}
          uploadFolder={`brainstorming/${productId}`}
          variant="full"
        />
        {projectBrainstorms.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Brainstorms de Projetos ({projectBrainstorms.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Brainstorms feitos em projetos internos associados a este produto.</p>
              {projectBrainstorms.map((p) => {
                const preview = (p.brainstorming || '').replace(/<[^>]+>/g, '').slice(0, 140);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/hub/projetos/${p.id}`)}
                    className="w-full text-left p-3 rounded-md border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.client_name && <Badge variant="outline" className="text-[10px]">{p.client_name}</Badge>}
                    </div>
                    {preview && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Gallery
  const docCount = productDocuments.length;
  const notesPreview = (archiveNotes || '').replace(/<[^>]+>/g, '').slice(0, 80);
  const brainPreview = (brainstormingContent || '').replace(/<[^>]+>/g, '').slice(0, 80);

  const cards = [
    {
      key: 'documentos' as const,
      title: 'Documentos',
      description: docCount > 0 ? `${docCount} ${docCount === 1 ? 'documento' : 'documentos'}` : 'Tabela com nome, link, ficheiros e etiquetas',
      icon: FileText,
      gradient: 'from-info/10 to-info/10',
      iconColor: 'text-info dark:text-info',
    },
    {
      key: 'notas' as const,
      title: 'Notas',
      description: notesPreview || 'Notas rápidas em texto simples',
      icon: StickyNote,
      gradient: 'from-warning/10 to-warning/10',
      iconColor: 'text-warning dark:text-warning',
    },
    {
      key: 'brainstorming' as const,
      title: 'Brainstorming',
      description: brainPreview || 'Editor rico com imagens, tabelas e formatação',
      icon: Lightbulb,
      gradient: 'from-accent-violet/10 to-accent-violet/10',
      iconColor: 'text-accent-violet dark:text-accent-violet',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            onClick={() => setView(card.key)}
            className="group text-left"
          >
            <Card className={`relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer h-full bg-gradient-to-br ${card.gradient}`}>
              <CardContent className="p-6 flex flex-col gap-3 min-h-[180px]">
                <div className={`w-12 h-12 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center ${card.iconColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{card.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

// ─── Contabilidade Section ─────────────────────────────────────

interface ContabilidadeSectionProps {
  form: Record<string, unknown>;
  costs: Array<Record<string, unknown>>;
  isOwner: boolean;
  productId: string;
  onUpdateField: (field: string, value: unknown) => void;
  onAddCost: () => void;
  onUpdateCost: (id: string, data: Record<string, unknown>) => void;
  onDeleteCost: (id: string) => void;
}

export function ProductContabilidadeSection({ form, costs, isOwner, productId, onUpdateField, onAddCost, onUpdateCost, onDeleteCost }: ContabilidadeSectionProps) {
  const [simOpen, setSimOpen] = useState(false);
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between rounded-lg border bg-muted/10 p-3">
        <div>
          <h3 className="text-sm font-semibold">Simular orçamento</h3>
          <p className="text-xs text-muted-foreground">Testa a Calculadora de Orçamento sem ligar a lead/cliente — útil para validar a configuração da Oferta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSimOpen(true)}>
          <Calculator className="h-4 w-4 mr-1" /> Simular
        </Button>
      </div>
      {productId && (
        <PricingWorkspace
          productId={productId}
          ticketType={((form.ticket_type as string) || 'fixo') as 'fixo' | 'variavel'}
          isOwner={isOwner}
          vatRate={(form.vat_rate as string) || '23'}
          initial={{
            base_price: (form.base_price as number) ?? null,
            price_min: (form.price_min as number) ?? null,
            price_max: (form.price_max as number) ?? null,
            volume_discounts: (form.volume_discounts as any) ?? [],
          }}
        />
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados de Faturação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Taxa de IVA</label>
              <select
                value={(form.vat_rate as string) || '23'}
                onChange={e => onUpdateField('vat_rate', e.target.value)}
                disabled={!isOwner}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="isento">Isento</option>
                <option value="6">6%</option>
                <option value="13">13%</option>
                <option value="23">23%</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Denominação para Faturas</label>
              <Input
                value={(form.invoice_denomination as string) || ''}
                onChange={e => onUpdateField('invoice_denomination', e.target.value)}
                placeholder="Ex: Consultoria de Marketing Digital"
                readOnly={!isOwner}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notas de Contabilidade</label>
            <textarea
              value={(form.accounting_notes as string) || ''}
              onChange={e => onUpdateField('accounting_notes', e.target.value)}
              placeholder="Notas adicionais sobre faturação, isenções, etc."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              readOnly={!isOwner}
            />
          </div>
        </CardContent>
      </Card>
      <QuoteCalculatorDialog open={simOpen} onOpenChange={setSimOpen} productId={productId} />
    </div>
  );
}

// Lazy imports to avoid circular deps
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { QuoteCalculatorDialog } from '@/components/product/QuoteCalculatorDialog';
