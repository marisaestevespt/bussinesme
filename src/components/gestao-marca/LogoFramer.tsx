import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  settings: any;
  uploadLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingLogo: boolean;
  refetchSettings: () => void;
  fill?: boolean;
}

export function LogoFramer({ settings, uploadLogo, uploadingLogo, refetchSettings, fill }: Props) {
  const initialY = settings?.logo_position_y ?? 50;
  const [posY, setPosY] = useState<number>(initialY);
  const draggingRef = useRef<{ startY: number; startPos: number; moved: boolean } | null>(null);

  useEffect(() => {
    setPosY(settings?.logo_position_y ?? 50);
  }, [settings?.id, settings?.logo_position_y]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settings?.logo_url) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    draggingRef.current = { startY: e.clientY, startPos: posY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 2) d.moved = true;
    const next = Math.max(0, Math.min(100, d.startPos - (dy / 160) * 100));
    setPosY(next);
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    draggingRef.current = null;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d || !d.moved) return;
    const v = Math.round(posY);
    if (v !== (settings?.logo_position_y ?? 50) && settings?.id) {
      await supabase.from('business_settings').update({ logo_position_y: v } as any).eq('id', settings.id);
      refetchSettings();
    }
  };

  const sizeCls = fill
    ? 'h-64 md:h-full w-full rounded-none border-0'
    : 'h-40 w-40 rounded-xl border';
  return (
    <div className={`group ${fill ? 'h-full w-full' : 'shrink-0 space-y-2'}`}>
      <div className={`relative ${fill ? 'h-full w-full' : ''}`}>
        {settings?.logo_url ? (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`${sizeCls} bg-muted/30 overflow-hidden cursor-ns-resize select-none touch-none relative`}
            title="Arrasta para cima/baixo para enquadrar"
          >
            <img
              src={settings.logo_url}
              alt={settings.business_name}
              draggable={false}
              className="h-full w-full object-cover pointer-events-none"
              style={{ objectPosition: `center ${posY}%` }}
            />
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              ↕ arrasta
            </div>
            <label
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 hover:bg-background"
              onPointerDown={(e) => e.stopPropagation()}
              title="Trocar logo"
            >
              <Upload className="h-3 w-3" /> Trocar
              <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={uploadingLogo} />
            </label>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <div className={`${fill ? 'h-64 md:h-full w-full' : 'h-40 w-40 rounded-xl'} border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center hover:border-primary/50 hover:bg-muted/40 transition-colors`}>
              <Upload className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={uploadingLogo} />
          </label>
        )}
      </div>
    </div>
  );
}