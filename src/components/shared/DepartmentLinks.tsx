import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircle, FolderOpen, FileText, Figma, Slack, Trello, Video,
  Plus, Pencil, Trash2, ExternalLink, Link2,
} from "lucide-react";
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type DepartmentKey =
  | "comercial" | "marketing" | "trafego" | "conteudo" | "clientes"
  | "financeiro" | "executive" | "equipa" | "secretaria"
  | "produtos" | "operacao" | "hub";

type LinkType = "whatsapp" | "drive" | "notion" | "figma" | "slack" | "trello" | "loom";

interface DepartmentLink {
  id: string;
  department: string;
  link_type: LinkType;
  label: string | null;
  url: string;
  sort_order: number;
}

const TYPE_META: Record<LinkType, { label: string; icon: any; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-success" },
  drive:    { label: "Drive",    icon: FolderOpen,   color: "text-info" },
  notion:   { label: "Notion",   icon: FileText,     color: "text-foreground" },
  figma:    { label: "Figma",    icon: Figma,        color: "text-accent-violet" },
  slack:    { label: "Slack",    icon: Slack,        color: "text-accent-violet" },
  trello:   { label: "Trello",   icon: Trello,       color: "text-info" },
  loom:     { label: "Loom",     icon: Video,        color: "text-info" },
};

const TYPES: LinkType[] = ["whatsapp", "drive", "notion", "figma", "slack", "trello", "loom"];

export function DepartmentLinks({
  department,
  variant = "card",
}: {
  department: DepartmentKey;
  variant?: "card" | "inline";
}) {
  const { isOwner } = useAuth();
  const [links, setLinks] = useState<DepartmentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentLink | null>(null);
  const [form, setForm] = useState<{ link_type: LinkType; label: string; url: string }>({
    link_type: "whatsapp", label: "", url: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("department_links" as any)
      .select("*")
      .eq("department", department)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [department]);

  const startCreate = () => {
    setEditing(null);
    setForm({ link_type: "whatsapp", label: "", url: "" });
    setOpen(true);
  };

  const startEdit = (l: DepartmentLink) => {
    setEditing(l);
    setForm({ link_type: l.link_type, label: l.label || "", url: l.url });
    setOpen(true);
  };

  const save = async () => {
    if (!form.url.trim()) {
      toast.error("URL obrigatório");
      return;
    }
    const payload = {
      department,
      link_type: form.link_type,
      label: form.label.trim() || null,
      url: form.url.trim(),
    };
    if (editing) {
      const { error } = await supabase.from("department_links" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao guardar"); return; }
      toast.success("Link atualizado");
    } else {
      const { error } = await supabase.from("department_links" as any).insert([payload]);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Link adicionado");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!(await confirmDestructive())) return;
    if (!confirm("Eliminar este link?")) return;
    const { error } = await supabase.from("department_links" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao eliminar"); return; }
    toast.success("Link eliminado");
    load();
  };

  // NOTE: Planeamento foi MOVIDO para a grelha principal de cada dashboard
  // (ver `src/lib/department-planning.ts`). NÃO voltar a colocar aqui.

  if (loading && links.length === 0 && !isOwner) return null;
  if (!isOwner && links.length === 0) return null;

  const isInline = variant === "inline";
  const wrapperCls = isInline
    ? "flex flex-wrap items-center gap-2"
    : "flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50";
  const chipCls = isInline
    ? "inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-background/70 backdrop-blur-sm border border-border/60 hover:bg-background text-[11px] font-medium transition-colors"
    : "inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-background border border-border hover:bg-accent text-xs font-medium transition-colors";

  return (
    <div className={wrapperCls}>
      {!isInline && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
          <Link2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Links rápidos:</span>
        </div>
      )}

      {links.map((l) => {
        const meta = TYPE_META[l.link_type];
        const Icon = meta.icon;
        return (
          <div key={l.id} className="group inline-flex items-center">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={chipCls}
              title={l.url}
            >
              <Icon className={`${isInline ? "h-3 w-3" : "h-3.5 w-3.5"} ${meta.color}`} />
              <span>{l.label || meta.label}</span>
              {!isInline && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            </a>
            {isOwner && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                <button
                  onClick={() => startEdit(l)}
                  className="ml-1 p-1 rounded hover:bg-accent text-muted-foreground"
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => remove(l.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {isOwner && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={isInline ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-xs"}
              onClick={startCreate}
            >
              <Plus className="h-3 w-3 mr-1" /> {isInline ? "Link" : "Adicionar link"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar link" : "Novo link"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.link_type} onValueChange={(v) => setForm({ ...form, link_type: v as LinkType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => {
                      const Icon = TYPE_META[t].icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="inline-flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${TYPE_META[t].color}`} />
                            {TYPE_META[t].label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etiqueta (opcional)</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={`Ex: Grupo da equipa`}
                />
              </div>
              <div>
                <Label>URL *</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Guardar" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default DepartmentLinks;