import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Generic record dialog used by Contracts & Payments tabs.
export function RecordDialog({ open, onClose, title, fields, initial, onSave }: any) {
  const [f, setF] = useState(initial || {});
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((field: any) => {
            if (field.type === 'select') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={f[field.key] || ''} onValueChange={v => set(field.key, v)}>
                    <SelectTrigger><SelectValue placeholder={field.placeholder || `Selecionar ${field.label.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{field.options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.type === 'textarea') {
              return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Textarea value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} rows={2} /></div>);
            }
            if (field.type === 'number') {
              return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Input type="number" value={f[field.key] || ''} onChange={e => set(field.key, e.target.value ? Number(e.target.value) : '')} /></div>);
            }
            return (<div key={field.key}><label className="text-xs text-muted-foreground">{field.label}</label><Input type={field.type || 'text'} value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} /></div>);
          })}
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}