import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PipelineFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    product: string | null;
    project_id: string | null;
  }) => void;
  products: string[];
  projects: { id: string; name: string }[];
  initialData?: any;
}

export function PipelineFormDialog({ open, onOpenChange, onSave, products, projects, initialData }: PipelineFormDialogProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [product, setProduct] = useState('');
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '');
      setStartDate(initialData.start_date ? new Date(initialData.start_date) : undefined);
      setEndDate(initialData.end_date ? new Date(initialData.end_date) : undefined);
      setProduct(initialData.product || '');
      setProjectId(initialData.project_id || '');
    } else if (open) {
      setName('');
      setStartDate(undefined);
      setEndDate(undefined);
      setProduct('');
      setProjectId('');
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      product: product || null,
      project_id: projectId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Pipeline' : 'Novo Pipeline'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pipeline Q1 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={pt} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={pt} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {products.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim()} variant="soft">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
