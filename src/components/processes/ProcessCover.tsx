import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProcessCoverProps {
  /** Aspect/height of the cover */
  className?: string;
  /** Image url to display (when not using department key) */
  imageUrl?: string | null;
  /** Department key — when present, fetches/saves to department_covers */
  departmentKey?: string;
  /** Fallback content rendered when there is no image (icon + label) */
  fallback?: React.ReactNode;
  /** Called after a new image is saved (when not using departmentKey) */
  onUpload?: (url: string) => Promise<void> | void;
  /** Storage bucket */
  bucket?: string;
  /** Path prefix inside the bucket */
  pathPrefix?: string;
  /** Allow editing (admin gate) */
  editable?: boolean;
}

/**
 * Sober cover for process / department cards.
 * - If image_url present → render the image (object-cover)
 * - Otherwise → render fallback (icon + label) on a muted surface
 * - Owners/admins see a small "Alterar capa" button overlay
 */
export function ProcessCover({
  className,
  imageUrl: imageUrlProp,
  departmentKey,
  fallback,
  onUpload,
  bucket = 'process-covers',
  pathPrefix = 'covers',
  editable = true,
}: ProcessCoverProps) {
  const { user, isOwner } = useAuth();
  const { canAccess } = usePermissions();
  const isAdmin = isOwner || canAccess('admin' as any);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Quando temos departmentKey, vamos à BD buscar a imagem
  const deptCoverQ = useQuery({
    queryKey: ['department-cover', departmentKey],
    enabled: !!departmentKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('department_covers')
        .select('image_url')
        .eq('department_key', departmentKey!)
        .maybeSingle();
      return data?.image_url as string | null;
    },
  });

  const imageUrl = departmentKey ? deptCoverQ.data : imageUrlProp;

  const saveDeptCover = useMutation({
    mutationFn: async (url: string) => {
      if (!departmentKey) return;
      const { data: existing } = await supabase
        .from('department_covers')
        .select('id')
        .eq('department_key', departmentKey)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('department_covers')
          .update({ image_url: url, updated_by: user?.id })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('department_covers')
          .insert({ department_key: departmentKey, image_url: url, updated_by: user?.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department-cover', departmentKey] });
      toast.success('Capa atualizada');
    },
    onError: () => toast.error('Não consegui guardar a capa'),
  });

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem demasiado grande (máx. 5 MB)');
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const safeName = (departmentKey || 'sop') + '-' + Date.now() + '.' + ext;
      const path = pathPrefix + '/' + safeName;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub.publicUrl;
      if (departmentKey) {
        await saveDeptCover.mutateAsync(url);
      } else if (onUpload) {
        await onUpload(url);
      }
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'desconhecido'));
    } finally {
      setUploading(false);
    }
  };

  const showEdit = editable && isAdmin;

  return (
    <div className={cn('relative w-full overflow-hidden bg-muted', className)}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          {fallback}
        </div>
      )}

      {showEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelectFile}
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-2 right-2 h-7 px-2 text-[11px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); fileRef.current?.click(); }}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1" />}
            {imageUrl ? 'Alterar' : 'Adicionar capa'}
          </Button>
        </>
      )}
    </div>
  );
}