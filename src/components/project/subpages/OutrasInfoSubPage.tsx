import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { MentionTextarea } from '@/components/MentionTextarea';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function OutrasInfoSubPage({ value, onChange, onBack, onSave, saving, dirty }: Props) {
  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <h2 className="text-xl font-bold">Outras Informações</h2>
        <MentionTextarea value={value} onChange={onChange} rows={12} placeholder="Informações adicionais sobre o projeto..." />
        {dirty && <Button onClick={onSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
      </div>
    </AppLayout>
  );
}