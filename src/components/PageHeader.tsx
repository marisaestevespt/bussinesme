interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="rounded-xl bg-primary px-6 py-5">
      <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-primary-foreground/70">{subtitle}</p>
      )}
    </div>
  );
}
