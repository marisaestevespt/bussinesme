import { Construction } from 'lucide-react';

interface EmptyModulePageProps {
  title: string;
  description?: string;
}

export function EmptyModulePage({ title, description }: EmptyModulePageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {description || 'Este módulo será construído em breve. Fica atenta!'}
      </p>
    </div>
  );
}
