import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import {
  fetchSiteChat,
  sendSiteChatMessage,
  startSiteChat,
  type ChatMessage,
} from "@/lib/ims-api";
import { clearStoredChatToken, getStoredChatToken, setStoredChatToken } from "@/lib/chat-storage";
import { cn } from "@/lib/utils";

const identitySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
});

const POLL_MS = 5000;

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [sessionClosed, setSessionClosed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const needsIdentity = !visitorToken;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const loadSession = useCallback(async (token: string) => {
    const data = await fetchSiteChat(token);
    if (!data) {
      clearStoredChatToken();
      setVisitorToken(null);
      setMessages([]);
      return;
    }
    setVisitorToken(token);
    setName(data.session.name);
    setEmail(data.session.email);
    setSessionClosed(data.session.status === "closed");
    setMessages(data.messages);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    const token = getStoredChatToken();
    if (token) {
      setLoading(true);
      loadSession(token).finally(() => setLoading(false));
    }
  }, [loadSession]);

  useEffect(() => {
    if (!open || !visitorToken || sessionClosed) return;
    const id = window.setInterval(() => {
      loadSession(visitorToken);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [open, visitorToken, sessionClosed, loadSession]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, scrollToBottom]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = identitySchema.safeParse({ name, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    const text = draft.trim();
    if (!text) {
      toast.error("Type a message to start");
      return;
    }
    setSending(true);
    try {
      const result = await startSiteChat({
        visitor_token: getStoredChatToken() ?? undefined,
        name: parsed.data.name,
        email: parsed.data.email,
        message: text,
      });
      setStoredChatToken(result.visitor_token);
      setVisitorToken(result.visitor_token);
      setMessages(result.messages);
      setDraft("");
      setSessionClosed(false);
      scrollToBottom();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorToken) return handleStart(e);
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      const result = await sendSiteChatMessage(visitorToken, text);
      setMessages(result.messages);
      setDraft("");
      setSessionClosed(result.session.status === "closed");
      scrollToBottom();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    clearStoredChatToken();
    setVisitorToken(null);
    setMessages([]);
    setDraft("");
    setSessionClosed(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="mb-3 flex w-[min(100vw-2.5rem,22rem)] flex-col overflow-hidden rounded-[5px] glass shadow-card"
          >
            <div className="bg-gradient-brand text-primary-foreground p-4 shrink-0">
              <div className="font-semibold">Chat with Shopynn</div>
              <div className="text-xs opacity-90">We typically reply within 2 minutes</div>
            </div>

            <div ref={scrollRef} className="flex-1 max-h-64 min-h-[10rem] overflow-y-auto p-3 space-y-2 bg-background/50">
              {loading ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 && !needsIdentity ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.is_staff
                        ? "mr-auto bg-muted text-foreground rounded-bl-sm"
                        : "ml-auto bg-gradient-brand text-primary-foreground rounded-br-sm",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] opacity-70",
                        m.is_staff ? "text-muted-foreground" : "text-primary-foreground",
                      )}
                    >
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>

            {needsIdentity ? (
              <form onSubmit={handleStart} className="border-t border-border p-3 space-y-2 shrink-0">
                <p className="text-xs text-muted-foreground">Introduce yourself to start the conversation.</p>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <input
                  type="email"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="h-9 w-9 shrink-0 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSend} className="border-t border-border p-3 shrink-0 space-y-2">
                {sessionClosed ? (
                  <p className="text-xs text-muted-foreground">
                    This chat is closed.{" "}
                    <button type="button" className="text-primary underline" onClick={handleNewChat}>
                      Start a new chat
                    </button>
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-transparent text-sm outline-none"
                      placeholder="Type a message…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending}
                      className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="h-12 w-12 rounded-full bg-gradient-brand text-primary-foreground grid place-items-center shadow-glow hover:scale-105 transition-transform"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
