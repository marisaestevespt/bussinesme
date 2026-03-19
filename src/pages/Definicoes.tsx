import { AppLayout } from '@/components/AppLayout';
import { BrandSettings } from '@/components/settings/BrandSettings';
import { ChannelSettings } from '@/components/settings/ChannelSettings';

export default function DefinicoesPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8 py-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Definições</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere a identidade visual e configurações do teu negócio.
          </p>
        </div>
        <BrandSettings />
        <ChannelSettings />
      </div>
    </AppLayout>
  );
}
