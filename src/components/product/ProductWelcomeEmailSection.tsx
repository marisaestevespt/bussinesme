import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  productId: string;
  bannerUrl: string | null | undefined;
  isOwner: boolean;
  onUpdate: (field: 'welcome_email_banner_url', value: string | null) => void;
}

export function ProductWelcomeEmailSection({ productId, bannerUrl, isOwner, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem demasiado grande (máx. 5MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `welcome-banner/${productId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('content-files').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('content-files').getPublicUrl(path);
      onUpdate('welcome_email_banner_url', data.publicUrl);
      toast.success('Banner atualizado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="hq-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email de boas-vindas
        </CardTitle>
        <CardDescription>
          Personaliza o email que o cliente recebe quando lhe envias as boas-vindas a este produto. Os campos abaixo aplicam-se apenas a este produto — quando vazios, é usado o template global definido em <strong>Definições → Emails</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Banner */}
        <div className="space-y-2">
          <Label className="text-sm">Banner (topo do email)</Label>
          {bannerUrl ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border bg-muted/20">
                <img src={bannerUrl} alt="Banner do email" className="w-full max-h-48 object-cover" />
                {isOwner && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => onUpdate('welcome_email_banner_url', null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 px-4 text-center cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                {uploading ? 'A enviar…' : 'Carrega uma imagem (JPG/PNG, recomendado 1200×400, máx 5MB)'}
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={!isOwner || uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          As cores dos botões e elementos de destaque do email são automaticamente as da identidade visual deste produto (definidas no separador Branding).
        </p>
      </CardContent>
    </Card>
  );
}