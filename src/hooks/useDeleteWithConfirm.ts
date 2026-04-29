import { useConfirm } from '@/components/ui/confirm-dialog';

/**
 * Wrapper around useConfirm() that enforces a destructive confirmation
 * before running any delete action. Use it everywhere we delete data.
 *
 * Example:
 *   const confirmDelete = useDeleteWithConfirm();
 *   await confirmDelete({ entity: 'projeto', name: project.name }, async () => {
 *     await supabase.from('projects').delete().eq('id', project.id);
 *   });
 */
export function useDeleteWithConfirm() {
  const confirm = useConfirm();

  return async (
    opts: {
      entity: string;          // e.g. "projeto", "tarefa"
      name?: string | null;    // optional name of the item
      title?: string;          // override title
      description?: string;    // override description
      confirmText?: string;    // default "Eliminar permanentemente"
    },
    onConfirm: () => void | Promise<void>,
  ): Promise<boolean> => {
    const title = opts.title ?? `Eliminar ${opts.entity}?`;
    const description =
      opts.description ??
      `${opts.name ? `"${opts.name}"` : `Este ${opts.entity}`} será removido(a) permanentemente. Esta ação não pode ser desfeita.`;

    const ok = await confirm({
      title,
      description,
      confirmText: opts.confirmText ?? 'Eliminar permanentemente',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return false;
    await onConfirm();
    return true;
  };
}