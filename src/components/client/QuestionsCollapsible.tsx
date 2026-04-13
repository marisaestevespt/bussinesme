import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Plus, RefreshCw, X, FileText, Upload, Image as ImageIcon, Pencil, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  portalId: string | undefined;
  questions: any;
  addQuestion: any;
  updateQuestion: any;
  deleteQuestion: any;
  seedQuestionsFromProduct: () => void;
}

export function QuestionsCollapsible({
  portalId,
  questions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  seedQuestionsFromProduct,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const questionsList = questions.data || [];
  const answeredCount = questionsList.filter((q: any) => q.answer || (Array.isArray(q.file_urls) && q.file_urls.length > 0)).length;

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setEditValue(q.question || '');
  };

  const saveEdit = (id: string, original: string) => {
    if (editValue !== original) {
      updateQuestion.mutate({ id, question: editValue });
    }
    setEditingId(null);
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80">
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
            <CardTitle className="text-sm">Perguntas Iniciais</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{answeredCount}/{questionsList.length}</Badge>
          </CollapsibleTrigger>
          <div className="flex gap-2">
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
              <p className="text-xs text-muted-foreground">Sem perguntas definidas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Pergunta</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead className="w-[140px]">Data da Resposta</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questionsList.map((q: any) => {
                    const answerType = q.answer_type || 'text';
                    const fileUrls: string[] = Array.isArray(q.file_urls) ? q.file_urls : [];
                    const isEditing = editingId === q.id;
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="align-top py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-7 text-xs flex-1"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(q.id, q.question); }}
                                autoFocus
                              />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary shrink-0" onClick={() => saveEdit(q.id, q.question)}>
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className="text-xs">{q.question || <span className="text-muted-foreground italic">Sem pergunta</span>}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => startEdit(q)}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-2">
                          {q.answer ? (
                            <span className="text-xs">{q.answer}</span>
                          ) : fileUrls.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {fileUrls.map((url: string, i: number) => {
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return isImage ? (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="" className="h-10 w-10 object-cover rounded border" />
                                  </a>
                                ) : (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <FileText className="h-3 w-3" />{url.split('/').pop()}
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Aguardando resposta</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-2">
                          {q.answered_at ? (
                            <span className="text-xs text-muted-foreground">{format(parseISO(q.answered_at), 'dd/MM/yyyy HH:mm')}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-2">
                          <Select value={answerType} onValueChange={v => updateQuestion.mutate({ id: q.id, answer_type: v } as any)}>
                            <SelectTrigger className="h-7 w-[90px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text"><span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Texto</span></SelectItem>
                              <SelectItem value="file"><span className="flex items-center gap-1"><Upload className="h-3 w-3" /> Ficheiro</span></SelectItem>
                              <SelectItem value="image"><span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Imagem</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top py-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteQuestion.mutate(q.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
