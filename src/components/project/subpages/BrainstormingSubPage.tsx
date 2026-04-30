import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { SubPageShell } from './SubPageShell';
import { RichTextEditor } from '@/components/RichTextEditor';

interface Props {
  value: string;
  onChange: (html: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  onBack: () => void;
}

/**
 * Brainstorming sub-page (substitui o Briefing em projetos internos).
 * Editor rico com headings, negrito, listas, etc., para registar ideias livres.
 */
export function BrainstormingSubPage({ value, onChange, onSave, saving, dirty, onBack }: Props) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  return (
    <SubPageShell
      title="Brainstorming"
      description="Espaço livre para ideias, hipóteses e notas exploratórias deste projeto interno."
      icon={Lightbulb}
      onBack={onBack}
      onSave={onSave}
      saving={saving}
      dirty={dirty}
    >
      <div className="rounded-xl border border-border/60 bg-card p-2">
        <RichTextEditor
          content={local}
          onChange={(html) => { setLocal(html); onChange(html); }}
          placeholder="Escreve aqui as ideias, perguntas, hipóteses, referências..."
          enableMentions
          minHeight={420}
        />
      </div>
    </SubPageShell>
  );
}