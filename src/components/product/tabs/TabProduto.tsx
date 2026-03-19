import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, X, Trash2, Upload } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Product } from '@/hooks/useProducts';

interface Props {
  form: Partial<Product>;
  update: (field: string, value: any) => void;
  isOwner: boolean;
  id: string;
  feedbacks: any[];
  addRow: any;
  updateRow: any;
  deleteRow: any;
}

export function TabProduto({ form, update, isOwner, id, feedbacks, addRow, updateRow, deleteRow }: Props) {
  const includedItems: string[] = Array.isArray(form.included_items) ? form.included_items : [];
  const faqs: { question: string; answer: string }[] = Array.isArray(form.faqs) ? form.faqs : [];
  const clientProfile = form.client_profile || {};

  const updateIncludedItems = (items: string[]) => update('included_items', items);
  const updateFaqs = (f: any[]) => update('faqs', f);
  const updateClientProfile = (key: string, val: string[]) => update('client_profile', { ...clientProfile, [key]: val });

  return (
    <div className="space-y-6">
      {/* Sobre o Produto */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sobre o Produto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm italic text-muted-foreground">O produto...</p>
            <RichTextEditor
              content={form.about_content || ''}
              onChange={v => update('about_content', v)}
              editable={isOwner}
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">O que está incluído</h4>
            {includedItems.map((item, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <Input value={item} onChange={e => { const next = [...includedItems]; next[i] = e.target.value; updateIncludedItems(next); }} className="h-8 text-sm" readOnly={!isOwner} />
                {isOwner && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => updateIncludedItems(includedItems.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
              </div>
            ))}
            {isOwner && <Button variant="outline" size="sm" className="mt-1" onClick={() => updateIncludedItems([...includedItems, ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar item</Button>}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Por dentro</h4>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4"><p className="text-sm font-medium mb-1">Aula</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
              <Card className="p-4"><p className="text-sm font-medium mb-1">Materiais</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Tempo de Ciclo / Acesso</h4>
            <p className="text-xs text-muted-foreground mb-2">Duração em dias do acesso ou ciclo do produto.</p>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} placeholder="Ex: 90" value={form.cycle_duration ?? ''} onChange={e => update('cycle_duration', e.target.value ? parseInt(e.target.value) : null)} className="h-8 text-sm w-32" readOnly={!isOwner} />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">FAQ's</h4>
            <Accordion type="multiple" className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm">
                    <Input value={faq.question} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], question: e.target.value }; updateFaqs(next); }} placeholder={`Pergunta ${i + 1}`} className="border-none shadow-none h-auto p-0 focus-visible:ring-0 text-sm" onClick={e => e.stopPropagation()} readOnly={!isOwner} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <Textarea value={faq.answer} onChange={e => { const next = [...faqs]; next[i] = { ...next[i], answer: e.target.value }; updateFaqs(next); }} placeholder="Resposta..." className="min-h-[60px]" readOnly={!isOwner} />
                    {isOwner && <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => updateFaqs(faqs.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button>}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {isOwner && <Button variant="outline" size="sm" className="mt-2" onClick={() => updateFaqs([...faqs, { question: '', answer: '' }])}><Plus className="h-3 w-3 mr-1" /> Adicionar FAQ</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Materiais de Divulgação */}
      <Card>
        <CardHeader><CardTitle className="text-base">Materiais de Divulgação</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4"><p className="text-sm font-medium mb-1">Páginas</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
            <Card className="p-4"><p className="text-sm font-medium mb-1">Branding</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
            <Card className="p-4"><p className="text-sm font-medium mb-1">Materiais</p><p className="text-xs text-muted-foreground">Conteúdo em branco</p></Card>
          </div>
        </CardContent>
      </Card>

      {/* Feedbacks */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Feedbacks</CardTitle>
          {isOwner && <Button size="sm" variant="outline" onClick={() => addRow.mutate({ table: 'product_feedbacks', data: { product_id: id, feedback: '', client_name: '' } })}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 && <p className="text-center text-muted-foreground py-4">Sem feedbacks</p>}
          {feedbacks.map((f: any) => (
            <div key={f.id} className="border rounded-lg p-4 space-y-3 mb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Feedback</Label>
                  <Textarea defaultValue={f.feedback} onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { feedback: e.target.value } })} className="min-h-[60px] text-sm" readOnly={!isOwner} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Input defaultValue={f.client_name} onBlur={e => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { client_name: e.target.value } })} className="h-9" readOnly={!isOwner} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Imagem / Print</Label>
                {f.image_url ? (
                  <div className="relative group inline-block">
                    <img src={f.image_url} alt="Feedback" className="max-h-48 rounded-md border object-contain" />
                    {isOwner && <Button variant="destructive" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { image_url: null } })}><X className="h-3 w-3" /></Button>}
                  </div>
                ) : isOwner ? (
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors w-fit">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregar imagem</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const path = `feedbacks/${f.id}-${Date.now()}.${file.name.split('.').pop()}`;
                      const { error } = await supabase.storage.from('product-files').upload(path, file, { upsert: true });
                      if (error) { toast.error('Erro ao enviar imagem'); return; }
                      const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
                      updateRow.mutate({ table: 'product_feedbacks', id: f.id, data: { image_url: urlData.publicUrl } });
                    }} />
                  </label>
                ) : <p className="text-xs text-muted-foreground">Sem imagem</p>}
              </div>
              {isOwner && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRow.mutate({ table: 'product_feedbacks', id: f.id })}><Trash2 className="h-3 w-3 mr-1" /> Remover</Button></div>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cliente do Produto */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cliente do Produto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'dificuldades', label: 'Dificuldades' },
              { key: 'dores', label: 'Dores' },
              { key: 'desejo', label: 'Desejo' },
            ].map(({ key, label }) => (
              <EditableList key={key} label={label} items={clientProfile[key] || []} onChange={val => updateClientProfile(key, val)} isOwner={isOwner} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'pensa', label: 'O que ela pensa' },
              { key: 'expressoes', label: 'Expressões que usa' },
              { key: 'ouve', label: 'O que ela ouve' },
            ].map(({ key, label }) => (
              <EditableList key={key} label={label} items={clientProfile[key] || []} onChange={val => updateClientProfile(key, val)} isOwner={isOwner} />
            ))}
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Linguagem</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'linguagem_nucleo', label: 'Núcleo (usar sempre)' },
                { key: 'linguagem_apoio', label: 'Apoio (usar quando faz sentido)' },
                { key: 'linguagem_evitar', label: 'Evitar' },
              ].map(({ key, label }) => (
                <EditableList key={key} label={label} items={clientProfile[key] || []} onChange={val => updateClientProfile(key, val)} isOwner={isOwner} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditableList({ label, items, onChange, isOwner }: { label: string; items: string[]; onChange: (v: string[]) => void; isOwner: boolean }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{label}</h4>
      {items.map((item: string, i: number) => (
        <div key={i} className="flex gap-1">
          <Input value={item} onChange={e => { const arr = [...items]; arr[i] = e.target.value; onChange(arr); }} className="h-7 text-xs" readOnly={!isOwner} />
          {isOwner && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
        </div>
      ))}
      {isOwner && <Button variant="ghost" size="sm" className="text-xs" onClick={() => onChange([...items, ''])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>}
    </div>
  );
}
