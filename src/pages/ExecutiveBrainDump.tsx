import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Settings2, Pencil, Lightbulb } from 'lucide-react';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { useDialogs } from '@/components/ui/confirm-dialog';
import {
  useBrainDump,
  BRAIN_DUMP_STATUS_LABEL,
  type BrainDumpItem,
  type BrainDumpStatus,
} from '@/hooks/useBrainDump';

const STATUS_OPTIONS: BrainDumpStatus[] = ['em_ideia', 'aplicado', 'desconsiderado'];

const STATUS_VARIANT: Record<BrainDumpStatus, 'secondary' | 'default' | 'outline'> = {
  em_ideia: 'secondary',
  aplicado: 'default',
  desconsiderado: 'outline',
};

export default function ExecutiveBrainDump() {
  const { confirm } = useDialogs();
  const {
    items,
    categories,
    addItem,
    updateItem,
    deleteItem,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useBrainDump();

  const [newIdea, setNewIdea] = useState('');
  const [newIdeaCategory, setNewIdeaCategory] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<BrainDumpStatus | 'todas'>('todas');
  const [editing, setEditing] = useState<BrainDumpItem | null>(null);
  const [showCategoriesManager, setShowCategoriesManager] = useState(false);

  const cats = categories.data || [];
  const catById = useMemo(
    () => Object.fromEntries(cats.map(c => [c.id, c])),
    [cats]
  );

  const filtered = useMemo(() => {
    const list = items.data || [];
    return statusFilter === 'todas' ? list : list.filter(i => i.status === statusFilter);
  }, [items.data, statusFilter]);

  const handleAdd = () => {
    if (!newIdea.trim()) return;
    addItem.mutate(
      { task: newIdea, category_id: newIdeaCategory ?? null },
      {
        onSuccess: () => {
          setNewIdea('');
          setNewIdeaCategory(undefined);
        },
      }
    );
  };

  const handleDelete = async (item: BrainDumpItem) => {
    const ok = await confirm({
      title: 'Eliminar ideia?',
      description: `"${item.task}" será removida permanentemente.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (ok) deleteItem.mutate(item.id);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader
          title="Brain Dump"
          subtitle="Guarda ideias rápidas, organiza por categoria e segue o que foi aplicado."
        />

        {/* Adicionar ideia */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Nova ideia…"
                value={newIdea}
                onChange={e => setNewIdea(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="flex-1"
                maxLength={500}
              />
              <Select
                value={newIdeaCategory ?? '__none'}
                onValueChange={v => setNewIdeaCategory(v === '__none' ? undefined : v)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem categoria</SelectItem>
                  {cats.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={!newIdea.trim() || addItem.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCategoriesManager(true)}
                title="Gerir categorias"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Filtrar:</span>
              {(['todas', ...STATUS_OPTIONS] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s as any)}
                  className="h-7 px-2 text-xs"
                >
                  {s === 'todas' ? 'Todas' : BRAIN_DUMP_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <EmptyHint>
                  {items.data && items.data.length === 0
                    ? 'Sem ideias registadas. Começa a escrever acima.'
                    : 'Nenhuma ideia para este filtro.'}
                </EmptyHint>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ideia</TableHead>
                    <TableHead className="w-[180px]">Categoria</TableHead>
                    <TableHead className="w-[180px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const cat = item.category_id ? catById[item.category_id] : null;
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setEditing(item)}
                      >
                        <TableCell className="max-w-md">
                          <div className="font-medium text-sm line-clamp-2">{item.task}</div>
                          {item.notes && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {item.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select
                            value={item.category_id ?? '__none'}
                            onValueChange={v =>
                              updateItem.mutate({
                                id: item.id,
                                category_id: v === '__none' ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue>
                                {cat ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: cat.color }}
                                    />
                                    {cat.name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Sem categoria</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">Sem categoria</SelectItem>
                              {cats.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select
                            value={item.status}
                            onValueChange={(v: BrainDumpStatus) =>
                              updateItem.mutate({
                                id: item.id,
                                status: v,
                                completed: v === 'aplicado',
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue>
                                <Badge variant={STATUS_VARIANT[item.status]} className="text-[10px]">
                                  {BRAIN_DUMP_STATUS_LABEL[item.status]}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s} value={s}>
                                  {BRAIN_DUMP_STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditing(item)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editor lateral (notas + ideia) */}
      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>Editar ideia</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Ideia</label>
                  <Input
                    value={editing.task}
                    onChange={e => setEditing({ ...editing, task: e.target.value })}
                    onBlur={() =>
                      editing.task.trim() &&
                      updateItem.mutate({ id: editing.id, task: editing.task })
                    }
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Textarea
                    value={editing.notes ?? ''}
                    onChange={e => setEditing({ ...editing, notes: e.target.value })}
                    onBlur={() =>
                      updateItem.mutate({ id: editing.id, notes: editing.notes ?? '' })
                    }
                    placeholder="Escreve aqui o detalhe, contexto ou referências…"
                    rows={12}
                    maxLength={5000}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {(editing.notes ?? '').length}/5000
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Gestor de categorias */}
      <Dialog open={showCategoriesManager} onOpenChange={setShowCategoriesManager}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerir categorias</DialogTitle>
          </DialogHeader>
          <CategoriesManager
            categories={cats}
            onCreate={(name, color) => addCategory.mutate({ name, color })}
            onUpdate={(id, patch) => updateCategory.mutate({ id, ...patch })}
            onDelete={async (id, name) => {
              const ok = await confirm({
                title: 'Eliminar categoria?',
                description: `"${name}" será removida. Ideias associadas ficam sem categoria.`,
                confirmLabel: 'Eliminar',
                variant: 'destructive',
              });
              if (ok) deleteCategory.mutate(id);
            }}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function CategoriesManager({
  categories,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: { id: string; name: string; color: string }[];
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, patch: { name?: string; color?: string }) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#94a3b8');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nome da categoria"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          className="flex-1"
        />
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-9 w-12 rounded border cursor-pointer"
          aria-label="Cor"
        />
        <Button
          onClick={() => {
            if (!name.trim()) return;
            onCreate(name, color);
            setName('');
            setColor('#94a3b8');
          }}
          disabled={!name.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
        {categories.length === 0 ? (
          <EmptyHint>Sem categorias criadas.</EmptyHint>
        ) : (
          categories.map(c => (
            <CategoryRow
              key={c.id}
              category={c}
              onUpdate={patch => onUpdate(c.id, patch)}
              onDelete={() => onDelete(c.id, c.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onUpdate,
  onDelete,
}: {
  category: { id: string; name: string; color: string };
  onUpdate: (patch: { name?: string; color?: string }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2">
      <input
        type="color"
        value={color}
        onChange={e => {
          setColor(e.target.value);
          onUpdate({ color: e.target.value });
        }}
        className="h-7 w-9 rounded border cursor-pointer shrink-0"
        aria-label="Cor"
      />
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name.trim() && name !== category.name && onUpdate({ name })}
        maxLength={60}
        className="h-8 text-sm"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
        onClick={onDelete}
        title="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}