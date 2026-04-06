import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Bot, RotateCcw, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type WorkflowStep = {
  step_label: string;
  action_type: string;
  details: Record<string, unknown>;
};

type ActionProposal = {
  action_type: "create" | "update" | "delete" | "send_email" | "workflow";
  description: string;
  details?: Record<string, unknown>;
  workflow?: boolean;
  steps?: WorkflowStep[];
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  action_proposal?: ActionProposal | null;
  confirmed?: boolean;
};

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  create: { label: "Criar", icon: "➕", color: "text-green-600" },
  update: { label: "Editar", icon: "✏️", color: "text-blue-600" },
  delete: { label: "Eliminar", icon: "🗑️", color: "text-red-600" },
  send_email: { label: "Enviar email", icon: "📧", color: "text-purple-600" },
  workflow: { label: "Workflow", icon: "⚡", color: "text-amber-600" },
};

const STORAGE_KEY_MESSAGES = "lirah-ai-messages";
const STORAGE_KEY_OPEN = "lirah-ai-open";

function loadPersistedMessages(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function FloatingAiChat() {
  const [open, setOpen] = useState(() => sessionStorage.getItem(STORAGE_KEY_OPEN) === "true");
  const [messages, setMessages] = useState<Msg[]>(loadPersistedMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  // Persist open state
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_OPEN, String(open));
  }, [open]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (open && textareaRef.current) textareaRef.current.focus(); }, [open]);

  const sendMessage = async (text: string, isConfirmation = false) => {
    if (!text.trim() || loading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: newMessages.map((m) => ({ role: m.role, content: m.content })) },
      });

      if (error) throw error;

      if (data?.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        const assistantMsg: Msg = {
          role: "assistant",
          content: data.content || "Sem resposta.",
          action_proposal: data.action_proposal || null,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error("AI chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro ao comunicar com o assistente." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = (msgIndex: number) => {
    // Mark proposal as confirmed
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: true } : m));
    // Send confirmation message
    sendMessage("[AÇÃO CONFIRMADA] Sim, pode executar.", true);
  };

  const handleReject = (msgIndex: number) => {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: false, action_proposal: null } : m));
    sendMessage("[AÇÃO REJEITADA] Não, cancela esta ação.");
  };

  const send = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const renderContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>');
      if (processed.match(/^[-•]\s/)) {
        processed = `<span class="flex gap-1.5"><span class="text-primary">•</span><span>${processed.replace(/^[-•]\s/, "")}</span></span>`;
      }
      const numMatch = processed.match(/^(\d+)\.\s/);
      if (numMatch) {
        processed = `<span class="flex gap-1.5"><span class="text-primary font-medium">${numMatch[1]}.</span><span>${processed.replace(/^\d+\.\s/, "")}</span></span>`;
      }
      if (processed.startsWith("### ")) processed = `<span class="font-semibold text-sm block mt-2 mb-1">${processed.slice(4)}</span>`;
      else if (processed.startsWith("## ")) processed = `<span class="font-bold text-sm block mt-2 mb-1">${processed.slice(3)}</span>`;
      return <span key={i} className={cn("block", line === "" && "h-2")} dangerouslySetInnerHTML={{ __html: processed || "&nbsp;" }} />;
    });
  };

  const renderActionProposal = (proposal: ActionProposal, msgIndex: number, confirmed?: boolean) => {
    const actionInfo = ACTION_LABELS[proposal.action_type] || { label: proposal.action_type, icon: "⚡", color: "text-foreground" };
    const isDecided = confirmed !== undefined;
    const isWorkflow = proposal.workflow && proposal.steps;

    return (
      <div className="mt-2 border rounded-xl p-3 bg-background/80 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{actionInfo.icon}</span>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", actionInfo.color)}>{actionInfo.label}</span>
          {isWorkflow && <span className="text-[10px] text-muted-foreground">({proposal.steps!.length} passos)</span>}
        </div>
        <p className="text-xs text-foreground leading-relaxed">{proposal.description}</p>
        
        {isWorkflow && (
          <div className="space-y-1 pl-1">
            {proposal.steps!.map((step, idx) => {
              const stepInfo = ACTION_LABELS[step.action_type] || { icon: "•", color: "text-foreground" };
              return (
                <div key={idx} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-[10px]">{stepInfo.icon}</span>
                  <span className="font-medium">{idx + 1}.</span>
                  <span>{step.step_label}</span>
                </div>
              );
            })}
          </div>
        )}
        
        {!isDecided && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="default" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => handleConfirm(msgIndex)}>
              <Check className="h-3 w-3" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => handleReject(msgIndex)}>
              <XCircle className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        )}
        {confirmed === true && (
          <p className="text-[11px] text-green-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Confirmado</p>
        )}
        {confirmed === false && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelado</p>
        )}
      </div>
    );
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-7rem)] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-primary/5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Lirah AI</p>
              <p className="text-[11px] text-muted-foreground">Assistente inteligente</p>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setMessages([]); sessionStorage.removeItem(STORAGE_KEY_MESSAGES); }} title="Nova conversa">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Olá! Sou a Lirah AI 👋</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                    Posso consultar dados, criar, editar, eliminar registos e enviar emails.
                  </p>
                </div>
                <div className="w-full space-y-2 mt-2 text-left px-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Experimenta perguntar</p>
                  {[
                    { icon: "👥", text: "Quantos clientes ativos tenho?" },
                    { icon: "✅", text: "Cria uma tarefa para amanhã" },
                    { icon: "💰", text: "Resumo financeiro deste mês" },
                    { icon: "📅", text: "Marca a reunião de hoje como concluída" },
                    { icon: "📊", text: "Como estão as vendas este trimestre?" },
                    { icon: "📧", text: "Envia um email ao João" },
                  ].map((q) => (
                    <button
                      key={q.text}
                      onClick={() => sendMessage(q.text)}
                      className="w-full flex items-center gap-2.5 text-[12px] px-3 py-2 rounded-xl border bg-muted/30 hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground text-left"
                    >
                      <span className="text-sm">{q.icon}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted/70 text-foreground rounded-bl-md"
                )}>
                  {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                  {msg.action_proposal && renderActionProposal(msg.action_proposal, i, msg.confirmed)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">A analisar...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-background">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunta algo..."
                className="min-h-[38px] max-h-[100px] resize-none text-sm rounded-xl border-muted-foreground/20"
                rows={1}
              />
              <Button size="icon" onClick={send} disabled={!input.trim() || loading} className="h-[38px] w-[38px] rounded-xl shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105",
          open ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:shadow-xl"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  );
}
