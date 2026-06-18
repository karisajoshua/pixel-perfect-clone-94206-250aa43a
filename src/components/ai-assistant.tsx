import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

// Detect routes mentioned in a response: `/clients`, `/admin/users`, etc.
const ROUTE_RE = /`(\/[a-zA-Z0-9/_-]+)`/g;

function extractRoutes(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = ROUTE_RE.exec(text)) !== null) out.add(m[1]);
  return Array.from(out);
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input, init) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = new Headers(init?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    sendMessage({ text: t });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
          aria-label="Open AI assistant"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>Zest Assistant</SheetTitle>
          <p className="text-xs text-muted-foreground">Ask about how to use the app.</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Try asking:</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>"How do I add a new client?"</li>
                <li>"Where do I record a payment?"</li>
                <li>"How do renewal reminders work?"</li>
              </ul>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const routes = m.role === "assistant" ? extractRoutes(text) : [];
            return (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                      : "max-w-[95%] text-sm prose prose-sm dark:prose-invert"
                  }
                >
                  <ReactMarkdown>{text}</ReactMarkdown>
                  {routes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {routes.map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOpen(false);
                            navigate({ to: r });
                          }}
                        >
                          Open {r}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>
        <form onSubmit={onSubmit} className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about the app…"
            disabled={busy}
            autoFocus
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}