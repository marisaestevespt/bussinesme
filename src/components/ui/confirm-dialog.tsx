import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { registerConfirmResolver } from '@/lib/confirmDestructive';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/* ── Confirm ───────────────────────────────────────────── */
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

/* ── Prompt ────────────────────────────────────────────── */
interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogsContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);
  const [promptState, setPromptState] = useState<
    (PromptOptions & { resolve: (v: string | null) => void }) | null
  >(null);
  const [promptValue, setPromptValue] = useState('');

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    [],
  );

  // Regista o resolver global para que `confirmDestructive()` funcione em
 // qualquer ponto da app (hooks, mutationFns, helpers fora de componentes).
  useEffect(() => {
    registerConfirmResolver(confirm);
  }, [confirm]);

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPromptValue(opts.defaultValue ?? '');
        setPromptState({ ...opts, resolve });
      }),
    [],
  );

  const handleConfirmClose = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const handlePromptClose = (result: string | null) => {
    promptState?.resolve(result);
    setPromptState(null);
    setPromptValue('');
  };

  return (
    <DialogsContext.Provider value={{ confirm, prompt }}>
      {children}

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open && confirmState) handleConfirmClose(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && (
              <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmClose(false)}>
              {confirmState?.cancelText ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmClose(true)}
              className={cn(
                confirmState?.variant === 'destructive' &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {confirmState?.confirmText ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!promptState}
        onOpenChange={(open) => {
          if (!open && promptState) handlePromptClose(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.title}</DialogTitle>
            {promptState?.description && (
              <DialogDescription>{promptState.description}</DialogDescription>
            )}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = promptValue.trim();
              handlePromptClose(trimmed || null);
            }}
            className="space-y-3"
          >
            {promptState?.label && (
              <label className="text-sm font-medium">{promptState.label}</label>
            )}
            <Input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptState?.placeholder}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handlePromptClose(null)}>
                {promptState?.cancelText ?? 'Cancelar'}
              </Button>
              <Button type="submit">{promptState?.confirmText ?? 'Confirmar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DialogsContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useConfirm must be used within DialogsProvider');
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('usePrompt must be used within DialogsProvider');
  return ctx.prompt;
}