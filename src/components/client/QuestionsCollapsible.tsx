import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Plus, RefreshCw, Trash2, FileText, Upload, Image as ImageIcon, Pencil, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExportInitialQuestionsButton } from '@/components/project/ExportInitialQuestionsButton';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Props {
  portalId: string | undefined;
  questions: any;
  addQuestion: any;
  updateQuestion: any;
  deleteQuestion: any;
  seedQuestionsFromProduct: () => void;
  clientId?: string | null;
  clientName?: string | null;
  projectName?: string | null;
}

export function QuestionsCollapsible({
  portalId,
  questions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  seedQuestionsFromProduct,
  clientId,
  clientName,
  projectName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'question' | 'type'>('question');
  const [editValue, setEditValue] = useState('');
  const questionsList = questions.data || [];
  const answeredCount = questionsList.filter((q: any) => q.answer || (Array.isArray(q.file_urls) && q.file_urls.length > 0)).length;

  const startEdit = (q: any, field: 'question' | 'type') => {
    setEditingId(q.id);
    setEditField(field);
    setEditValue(field === 'question' ? (q.question || '') : (q.answer_type || 'text'));
  };

  const saveEdit = (id: string, original: string) => {
    if (editValue !== original) {
      if (editField === 'question') {
        updateQuestion.mutate({ id, question: editValue });
      } else {
        updateQuestion.mutate({ id, answer_type: editValue } as any);
      }
    }
    setEditingId(null);
  };

  // Group questions by question_group
  const grouped: { group: string; items: any[] }[] = [];
  const groupMap = new Map<string, any[]>();
  for (const q of questionsList) {
    const g = q.question_group || 'Outras';
    if (!groupMap.has(g)) { groupMap.set(g, []); grouped.push({ group: g, items: groupMap.get(g)! }); }
    groupMap.get(g)!.push(q);
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80">
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
            <CardTitle className="text-sm">Perguntas Iniciais</CardTitle>
            <Badge variant="secondary" className="text-xs px-2 py-0.5 tabular-nums">{answeredCount}/{questionsList.length}</Badge>
          </CollapsibleTrigger>
          <div className="flex gap-2">
            {clientId && (
              <ExportInitialQuestionsButton clientId={clientId} clientName={clientName} projectName={projectName} />
            )}
            <Button size="sm" variant="outline" onClick={() => seedQuestionsFromProduct()}>
              <RefreshCw className="h-3 w-3 mr-1" />Importar do Produto
            </Button>
            <Button size="sm" variant="outline" onClick={() => addQuestion.mutate({ portal_id: portalId!, question: '', sort_order: questionsList.length, answer_type: 'text' })}>
              <Plus className="h-3 w-3 mr-1" />Nova Pergunta
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {questionsList.length === 0 ? (
              <EmptyHint>Sem perguntas definidas</EmptyHint>
            ) : (
              <div className="space-y-6">
                {grouped.map(({ group, items }, groupIdx) => (
                  <div key={group}>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="!bg-primary/10 hover:!bg-primary/10 border-b-0">
                            <TableHead colSpan={5} className="py-2.5 border-b">
                              <span className="text-sm font-semibold text-primary">{group.replace('Config. Sistema — ', '')}</span>
                              <span className="text-xs text-muted-foreground ml-2">({items.length})</span>
                            </TableHead>
                          </TableRow>
                          <TableRow>
                            <TableHead className="w-[35%]">Pergunta</TableHead>
                            <TableHead>Resposta</TableHead>
                            <TableHead className="w-[150px] whitespace-nowrap">Data da Resposta</TableHead>
                            <TableHead className="w-[100px]">Tipo</TableHead>
                            <TableHead className="w-[44px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((q: any) => {
                            const answerType = q.answer_type || 'text';
                            const fileUrls: string[] = Array.isArray(q.file_urls) ? q.file_urls : [];
                            const isEditing = editingId === q.id;
                            return (
                              <TableRow key={q.id} className="group/row">
                                <TableCell className="align-top py-2.5">
                                  {isEditing && editField === 'question' ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        className="h-8 text-sm flex-1"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(q.id, q.question); if (e.key === 'Escape') setEditingId(null); }}
                                        autoFocus
                                      />
                                      <Button variant="ghost" aria-label="Confirmar" size="icon" className="h-7 w-7 text-primary shrink-0" onClick={() => saveEdit(q.id, q.question)}>
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group/q">
                                      <span className="text-sm">{q.question || <span className="text-muted-foreground italic">Sem pergunta</span>}</span>
                                      <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6 opacity-0 group-hover/q:opacity-100 transition-opacity shrink-0" onClick={() => startEdit(q, 'question')}>
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top py-2.5">
                                  {q.answer ? (
                                    <span className="text-sm">{q.answer}</span>
                                  ) : fileUrls.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {fileUrls.map((url: string, i: number) => {
                                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                        return isImage ? (
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt="" className="h-10 w-10 object-cover rounded border" />
                                          </a>
                                        ) : (
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                                            <FileText className="h-3.5 w-3.5" />{url.split('/').pop()}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">Aguardando resposta</span>
                                  )}
                                </TableCell>
                                <TableCell className="align-top py-2.5 whitespace-nowrap">
                                  {q.answered_at ? (
                                    <span className="text-sm text-muted-foreground">{format(parseISO(q.answered_at), 'dd/MM/yyyy HH:mm')}</span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="align-top py-2.5">
                                  {isEditing && editField === 'type' ? (
                                    <div className="flex items-center gap-1">
                                      <Select value={editValue} onValueChange={v => setEditValue(v)}>
                                        <SelectTrigger className="h-8 w-[100px] text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="text">Texto</SelectItem>
                                          <SelectItem value="file">Ficheiro</SelectItem>
                                          <SelectItem value="image">Imagem</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button variant="ghost" aria-label="Confirmar" size="icon" className="h-7 w-7 text-primary shrink-0" onClick={() => saveEdit(q.id, answerType)}>
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group/t">
                                      <span className="text-sm">{answerType === 'text' ? 'Texto' : answerType === 'file' ? 'Ficheiro' : 'Imagem'}</span>
                                      <Button variant="ghost" aria-label="Editar" size="icon" className="h-6 w-6 opacity-0 group-hover/t:opacity-100 transition-opacity shrink-0" onClick={() => startEdit(q, 'type')}>
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="align-top py-2.5">
                                  <Button
                                    variant="ghost"
                                    aria-label="Eliminar" size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-all"
                                    onClick={() => deleteQuestion.mutate(q.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
