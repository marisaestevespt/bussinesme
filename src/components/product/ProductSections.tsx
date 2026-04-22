import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X, Upload, Download, FileText, Video } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/RichTextEditor';
import { LinkedSopsSection } from '@/components/LinkedSopsSection';
import { ProductDiagnosticQuestions } from '@/components/product/ProductDiagnosticQuestions';
import { ProductPriceTiers } from '@/components/product/ProductPriceTiers';

// ─── Processos Section ─────────────────────────────────────────
import { getSopStatusInfo } from '@/lib/sopStatus';

interface ProcessosSectionProps {
  productSops: Array<Record<string, unknown>>;
  projectTemplate: Array<Record<string, unknown>>;
  isOwner: boolean;
  productId: string;
  onAddProjectTask: () => void;
  onUpdateRow: (table: string, id: string, data: Record<string, unknown>) => void;
  onDeleteRow: (table: string, id: string) => void;
}

export function ProductProcessosSection({ productSops, projectTemplate, isOwner, productId, onAddProjectTask, onUpdateRow, onDeleteRow }: ProcessosSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    <TableCell className="text-xs font-mono text-muted-foreground">{sop.sop_id as string}</TableCell>
                    <TableCell className="font-medium text-sm">{sop.name as string}</TableCell>
                    <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Template de Projeto</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddProjectTask}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Tarefa
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Tarefas que serão criadas automaticamente no projeto de cada cliente deste produto.</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Tarefa</TableHead>
                  <TableHead className="min-w-[120px]">Regra</TableHead>
                  <TableHead className="min-w-[120px]">Responsável (Função)</TableHead>
                  <TableHead className="min-w-[90px]">Prioridade</TableHead>
                  <TableHead className="min-w-[100px]">Departamento</TableHead>
                  <TableHead className="w-[60px]">Subtarefa</TableHead>
                  <TableHead className="w-[80px]">Tempo Est. (h)</TableHead>
                  <TableHead className="min-w-[140px]">Notas</TableHead>
                  {isOwner && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectTemplate.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-4">Sem tarefas no template</TableCell></TableRow>
                )}
                {projectTemplate.map((t) => (
                  <TableRow key={t.id as string} className={t.is_subtask ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <Input defaultValue={(t.task_name as string) || ''} placeholder="Nome da tarefa" onBlur={e => onUpdateRow('product_project_templates', t.id as string, { task_name: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={(t.rule as string) || ''} placeholder="Ex: +5 dias" onBlur={e => onUpdateRow('product_project_templates', t.id as string, { rule: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={(t.responsible as string) || ''} placeholder="Ex: Designer" onBlur={e => onUpdateRow('product_project_templates', t.id as string, { responsible: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Select defaultValue={(t.priority as string) || 'media'} onValueChange={v => onUpdateRow('product_project_templates', t.id as string, { priority: v })}>
                          <SelectTrigger className="h-7 text-xs border-none shadow-none p-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs capitalize">{(t.priority as string) || 'media'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={(t.department as string) || ''} placeholder="Departamento" onBlur={e => onUpdateRow('product_project_templates', t.id as string, { department: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={!!t.is_subtask}
                        onCheckedChange={v => isOwner && onUpdateRow('product_project_templates', t.id as string, { is_subtask: !!v })}
                        disabled={!isOwner}
                      />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.5" defaultValue={t.estimated_time != null ? String(t.estimated_time) : ''} placeholder="h" onBlur={e => onUpdateRow('product_project_templates', t.id as string, { estimated_time: e.target.value ? Number(e.target.value) : null })} className="border-none shadow-none h-auto p-0 text-sm w-16" readOnly={!isOwner} />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={(t.notes as string) || ''} placeholder="Notas..." onBlur={e => onUpdateRow('product_project_templates', t.id as string, { notes: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                    </TableCell>
                    {isOwner && (
                      <TableCell><Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => onDeleteRow('product_project_templates', t.id as string)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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

export function ProductBackofficeSection({ usefulLinks, improvements, productMeetings, isOwner, onAddLink, onAddImprovement, onUpdateRow, onDeleteRow }: BackofficeSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Links Úteis</CardTitle>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onAddLink}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Link</TableHead>
                {isOwner && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {usefulLinks.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem links</TableCell></TableRow>
              )}
              {usefulLinks.map((l) => (
                <TableRow key={l.id as string}>
                  <TableCell>
                    <Input defaultValue={l.name as string} onBlur={e => onUpdateRow('product_useful_links', l.id as string, { name: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                  </TableCell>
                  <TableCell>
                    <Input defaultValue={l.url as string} onBlur={e => onUpdateRow('product_useful_links', l.id as string, { url: e.target.value })} className="border-none shadow-none h-auto p-0 text-sm" readOnly={!isOwner} />
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => onDeleteRow('product_useful_links', l.id as string)}><Trash2 className="h-3 w-3" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <p className="text-sm text-muted-foreground">Nenhuma melhoria registada.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4" /> Reuniões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem reuniões associadas a este produto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productMeetings.map((mt) => (
                  <TableRow key={mt.id as string} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/reunioes/${mt.id}`)}>
                    <TableCell className="font-medium">{mt.title as string}</TableCell>
                    <TableCell>{mt.date_time ? format(new Date(mt.date_time as string), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                    <TableCell>{(mt.client_name as string) || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{mt.status as string}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
  const qc = useQueryClient();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos</CardTitle>
          {isOwner && (
            <label className="cursor-pointer">
              <Button size="sm" variant="outline" asChild>
                <span><Upload className="h-3 w-3 mr-1" /> Carregar</span>
              </Button>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  for (const file of files) {
                    const path = `documents/${productId}/${Date.now()}-${file.name}`;
                    const { error } = await supabase.storage.from('product-files').upload(path, file);
                    if (error) { toast.error(`Erro ao enviar ${file.name}`); continue; }
                    const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                    await supabase.from('product_documents' as 'clients').insert({
                      product_id: productId,
                      file_name: file.name,
                      file_url: urlData.publicUrl,
                      file_type: file.type || 'application/octet-stream',
                      sort_order: productDocuments.length,
                    } as never);
                  }
                  qc.invalidateQueries({ queryKey: ['product-documents', productId] });
                  toast.success('Documento(s) carregado(s)');
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </CardHeader>
        <CardContent>
          {productDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem documentos. Carrega ficheiros para os guardar aqui.</p>
          ) : (
            <div className="space-y-2">
              {productDocuments.map((doc) => (
                <div key={doc.id as string} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{doc.file_name as string}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={doc.file_url as string} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" aria-label="Transferir" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        aria-label="Eliminar" size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={async () => {
                          await supabase.from('product_documents' as 'clients').delete().eq('id', doc.id as string);
                          qc.invalidateQueries({ queryKey: ['product-documents', productId] });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor
            content={archiveNotes}
            onChange={v => onUpdateField('archive_notes', v)}
            editable={isOwner}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Brainstorming</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor
            content={brainstormingContent}
            onChange={v => onUpdateField('brainstorming_content', v)}
            editable={isOwner}
          />
        </CardContent>
      </Card>
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
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Tabela de Preços */}
      {((form.ticket_type as string) || 'fixo') === 'variavel' && productId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tabela de Preços</CardTitle></CardHeader>
          <CardContent>
            <ProductPriceTiers productId={productId} readOnly={!isOwner} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados de Faturação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Denominação para Faturas</label>
              <Input
                value={(form.invoice_denomination as string) || ''}
                onChange={e => onUpdateField('invoice_denomination', e.target.value)}
                placeholder="Ex: Consultoria de Marketing Digital"
                readOnly={!isOwner}
              />
            </div>
          </div>
          <div className="space-y-1.5">
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
      <OfferCalculatorWrapper
        vatRate={(form.vat_rate as string) || '23'}
        costs={costs}
        isOwner={isOwner}
        onAddCost={onAddCost}
        onUpdateCost={onUpdateCost}
        onDeleteCost={onDeleteCost}
      />
    </div>
  );
}

// Lazy import wrapper to avoid circular deps
import { OfferCalculator } from '@/components/product/OfferCalculator';

function OfferCalculatorWrapper(props: {
  vatRate: string;
  costs: Array<Record<string, unknown>>;
  isOwner: boolean;
  onAddCost: () => void;
  onUpdateCost: (id: string, data: Record<string, unknown>) => void;
  onDeleteCost: (id: string) => void;
}) {
  return (
    <OfferCalculator
      vatRate={props.vatRate}
      costs={props.costs as Array<{ id: string; name: string; value: number; usage_desc: string }>}
      isOwner={props.isOwner}
      onAddCost={props.onAddCost}
      onUpdateCost={props.onUpdateCost}
      onDeleteCost={props.onDeleteCost}
    />
  );
}
