import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { MessageCircle, X, Send, Loader2, Sparkles, Bot, RotateCcw, Check, XCircle, Paperclip, FileText, Image as ImageIcon, Download, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

type FileAttachment = {
  name: string;
  type: string;
  base64: string;
  extractedText?: string; // For PDFs: extracted text content
  size: number;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  action_proposal?: ActionProposal | null;
  confirmed?: boolean;
  file?: { name: string; type: string } | null;
  model?: string | null;
  streaming?: boolean;
};

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  create: { label: "Criar", icon: "➕", color: "text-success" },
  update: { label: "Editar", icon: "✏️", color: "text-info" },
  delete: { label: "Eliminar", icon: "🗑️", color: "text-destructive" },
  send_email: { label: "Enviar email", icon: "📧", color: "text-accent-violet" },
  workflow: { label: "Workflow", icon: "⚡", color: "text-warning" },
};

const STORAGE_KEY_OPEN = "lyrata-ai-open";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  try {
    // Lazy-load pdfjs-dist (~280 KB) only when the user attaches a PDF
    const pdfjsLib = await import("pdfjs-dist");
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];
    
    const maxPages = Math.min(pdf.numPages, 20); // Limit to 20 pages
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) textParts.push(`[Página ${i}]\n${pageText}`);
    }
    
    return textParts.join("\n\n").slice(0, 30000); // Limit to 30k chars
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "";
  }
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function FloatingAiChat() {
  const [open, setOpen] = useState(() => sessionStorage.getItem(STORAGE_KEY_OPEN) === "true");
  const [messages, setMessages] = useState<Msg[]>(loadPersistedMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<FileAttachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = "";

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ficheiro demasiado grande (máx. 10MB)");
      return;
    }

    const supportedTypes = [
      "application/pdf",
      "image/png", "image/jpeg", "image/webp", "image/gif",
      "text/plain", "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!supportedTypes.some(t => file.type.startsWith(t.split("/")[0]) || file.type === t)) {
      toast.error("Tipo de ficheiro não suportado. Usa PDF, imagem, CSV ou texto.");
      return;
    }

    try {
      let extractedText: string | undefined;
      
      // For PDFs, extract text client-side
      if (file.type === "application/pdf") {
        toast.info("A extrair texto do PDF...");
        extractedText = await extractPdfText(file);
        if (!extractedText) {
          toast.error("Não foi possível extrair texto do PDF. Tenta um PDF com texto selecionável.");
          return;
        }
      }
      
      const base64 = await fileToBase64(file);
      setPendingFile({ name: file.name, type: file.type, base64, extractedText, size: file.size });
    } catch {
      toast.error("Erro ao ler o ficheiro.");
    }
  };

  const sendMessage = async (text: string, isConfirmation = false) => {
    if ((!text.trim() && !pendingFile) || loading) return;

    const messageText = text.trim() || (pendingFile ? `Analisa este ficheiro: ${pendingFile.name}` : "");
    const userMsg: Msg = {
      role: "user",
      content: messageText,
      file: pendingFile ? { name: pendingFile.name, type: pendingFile.type } : null,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Prepare body
    const body: Record<string, unknown> = {
      messages: newMessages.map((m) => ({
        role: m.role,
        content: m.content,
        action_proposal: m.action_proposal,
        confirmed: m.confirmed,
      })),
    };

    // Attach file if present
    if (pendingFile) {
      if (pendingFile.extractedText) {
        // For PDFs: send extracted text instead of binary
        body.file = {
          name: pendingFile.name,
          type: "text/plain",
          extractedText: pendingFile.extractedText,
        };
      } else {
        // For images and other files: send base64
        body.file = {
          name: pendingFile.name,
          type: pendingFile.type,
          base64: pendingFile.base64,
        };
      }
      setPendingFile(null);
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", { body });

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
    const proposal = messages[msgIndex]?.action_proposal;
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: true } : m));
    // Build full message with details for the AI backend, but show clean text to user
    const proposalSummary = proposal
      ? ` Detalhes da ação a executar:${JSON.stringify({
          action_type: proposal.action_type,
          workflow: proposal.workflow || false,
          steps: proposal.steps,
          details: proposal.details,
          description: proposal.description,
        })}`
      : "";
    const fullMessage = `[AÇÃO CONFIRMADA] Sim, pode executar.${proposalSummary}`;
    // Show clean message to user, send full details to AI
    const userMsg: Msg = { role: "user", content: "✅ Confirmado. Pode executar." };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    // Send the full message with details but don't add it again to messages visually
    const body: Record<string, unknown> = {
      messages: [...messages.filter((_, i) => i !== msgIndex || true), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
        action_proposal: m.action_proposal,
        confirmed: m.confirmed,
      })),
    };
    // Override last user message content with full details for the backend
    const msgArray = body.messages as Array<{ role: string; content: string }>;
    msgArray[msgArray.length - 1].content = fullMessage;

    const invokeConfirmation = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ai-assistant", { body });
        if (error) throw error;
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        const assistantMsg: Msg = {
          role: "assistant",
          content: parsed.reply || parsed.error || "Sem resposta.",
          action_proposal: parsed.action_proposal || null,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("AI chat error:", err);
        setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro ao comunicar com o assistente." }]);
      } finally {
        setLoading(false);
      }
    };
    invokeConfirmation();
  };

  const handleReject = (msgIndex: number) => {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: false, action_proposal: null } : m));
    sendMessage("[AÇÃO REJEITADA] Não, cancela esta ação.");
  };

  const send = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const downloadResponse = (content: string) => {
    // Strip markdown for cleaner text file
    const cleaned = content
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^#{1,3}\s/gm, '')
      .replace(/^[-•]\s/gm, '- ');
    const blob = new Blob([cleaned], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyrata-resumo-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processed = processed.replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>');
      if (processed.match(/^[-•]\s/)) {
        processed = `<span class="flex gap-2"><span class="text-primary">•</span><span>${processed.replace(/^[-•]\s/, "")}</span></span>`;
      }
      const numMatch = processed.match(/^(\d+)\.\s/);
      if (numMatch) {
        processed = `<span class="flex gap-2"><span class="text-primary font-medium">${numMatch[1]}.</span><span>${processed.replace(/^\d+\.\s/, "")}</span></span>`;
      }
      if (processed.startsWith("### ")) processed = `<span class="font-semibold text-sm block mt-2 mb-1">${processed.slice(4)}</span>`;
      else if (processed.startsWith("## ")) processed = `<span class="font-bold text-sm block mt-2 mb-1">${processed.slice(3)}</span>`;
      return <span key={i} className={cn("block", line === "" && "h-2")} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processed || "&nbsp;") }} />;
    });
  };

  const renderFileAttachment = (file: { name: string; type: string }) => (
    <div className="flex items-center gap-2 mt-1 text-[11px] opacity-80">
      {getFileIcon(file.type)}
      <span className="truncate max-w-[180px]">{file.name}</span>
    </div>
  );

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
            <Button size="sm" variant="default" className="h-7 text-xs gap-2 rounded-lg" onClick={() => handleConfirm(msgIndex)}>
              <Check className="h-3 w-3" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-2 rounded-lg" onClick={() => handleReject(msgIndex)}>
              <XCircle className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        )}
        {confirmed === true && (
          <p className="text-[11px] text-success font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Confirmado</p>
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
        <div className="fixed bottom-24 md:bottom-20 right-3 sm:right-5 z-50 w-[380px] max-w-[calc(100vw-1.5rem)] h-[520px] max-h-[calc(100vh-9rem)] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-primary/5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Atena</p>
              <p className="text-[11px] text-muted-foreground">Assistente inteligente</p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setMessages([]); sessionStorage.removeItem(STORAGE_KEY_MESSAGES); }} title="Nova conversa">
                <RotateCcw className="h-3 w-3" />
                Nova
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Minimizar">
                <Minus className="h-4 w-4" />
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
                  <p className="text-sm font-medium">Olá! Sou a Atena 👋</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                    Posso consultar dados, criar registos, analisar ficheiros e muito mais.
                  </p>
                </div>
                <div className="w-full space-y-2 mt-2 text-left px-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Experimenta perguntar</p>
                  {[
                    { icon: "👥", text: "Quantos clientes ativos tenho?" },
                    { icon: "📅", text: "Resumo de 1 a 13 de abril" },
                    { icon: "✅", text: "Cria uma tarefa para amanhã" },
                    { icon: "📎", text: "Analisa este PDF e cria o produto" },
                    { icon: "📊", text: "Como estão as vendas este trimestre?" },
                    { icon: "📧", text: "Envia um email ao João" },
                  ].map((q) => (
                    <button
                      key={q.text}
                      onClick={() => {
                        if (q.text.includes("PDF")) {
                          fileInputRef.current?.click();
                        } else {
                          sendMessage(q.text);
                        }
                      }}
                      className="w-full flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl border bg-muted/30 hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground text-left"
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
                  {msg.file && renderFileAttachment(msg.file)}
                  {msg.action_proposal && renderActionProposal(msg.action_proposal, i, msg.confirmed)}
                  {msg.role === "assistant" && msg.content.length > 200 && !msg.action_proposal && (
                    <button
                      onClick={() => downloadResponse(msg.content)}
                      className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      title="Descarregar resumo"
                    >
                      <Download className="h-3 w-3" />
                      <span>Descarregar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{pendingFile ? "A analisar ficheiro..." : "A analisar..."}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pending file preview */}
          {pendingFile && (
            <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2">
              {getFileIcon(pendingFile.type)}
              <span className="text-xs truncate flex-1">{pendingFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPendingFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t bg-background">
            <div className="flex gap-2 items-end">
              <Button
                variant="ghost"
                aria-label="Anexar" size="icon"
                className="h-[38px] w-[38px] rounded-xl shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Anexar ficheiro"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.txt,.xlsx"
                onChange={handleFileSelect}
              />
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingFile ? "Descreve o que queres fazer com o ficheiro..." : "Pergunta algo..."}
                className="min-h-[38px] max-h-[100px] resize-none text-sm rounded-xl border-muted-foreground/20"
                rows={1}
              />
              <Button aria-label="Enviar" size="icon" onClick={send} disabled={(!input.trim() && !pendingFile) || loading} className="h-[38px] w-[38px] rounded-xl shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-20 md:bottom-5 right-3 sm:right-5 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105",
          open ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:shadow-xl"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-accent border-2 border-background" />
        )}
      </button>
    </>
  );
}
