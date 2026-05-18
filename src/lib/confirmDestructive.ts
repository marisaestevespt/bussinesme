/**
 * Global confirm-before-destroy helper.
 *
 * Pode ser usado em qualquer parte do código (hooks, mutações, handlers)
 * sem precisar do contexto React. A `DialogsProvider` regista o resolver
 * no arranque da app.
 */

interface ConfirmDestructiveOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

type Resolver = (opts: {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}) => Promise<boolean>;

let resolver: Resolver | null = null;

export function registerConfirmResolver(fn: Resolver) {
  resolver = fn;
}

export class ConfirmCancelledError extends Error {
  constructor() {
    super('__confirm_cancelled__');
    this.name = 'ConfirmCancelledError';
  }
}

export function isConfirmCancelled(err: unknown): boolean {
  return err instanceof ConfirmCancelledError;
}

/**
 * Mostra um diálogo "Tens a certeza?" e devolve true/false.
 * Se o provider ainda não tiver montado (caso raro), devolve true para não bloquear.
 */
export async function confirmDestructive(
  opts: ConfirmDestructiveOptions = {},
): Promise<boolean> {
  if (!resolver) return true;
  return resolver({
    title: opts.title ?? 'Eliminar?',
    description: opts.description ?? 'Esta ação não pode ser desfeita.',
    confirmText: opts.confirmText ?? 'Eliminar',
    cancelText: opts.cancelText ?? 'Cancelar',
    variant: 'destructive',
  });
}

/**
 * Atalho para usar dentro de `mutationFn`. Se o utilizador cancelar,
 * lança ConfirmCancelledError — a `MutationCache` global silencia este erro.
 */
export async function requireConfirm(opts: ConfirmDestructiveOptions = {}) {
  const ok = await confirmDestructive(opts);
  if (!ok) throw new ConfirmCancelledError();
}