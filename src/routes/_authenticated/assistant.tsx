import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ipenAssistantChat } from "@/lib/ipen/assistant.functions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI assistant" },
      { name: "description", content: "Chat with the IPEN AI assistant to draft quotes, answer coverage questions, and get help." },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function AssistantPage() {
  const fn = useServerFn(ipenAssistantChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res: any = await fn({
        data: { message: text, history: messages },
      });
      const reply =
        res?.reply ?? res?.message ?? res?.response ?? res?.data?.reply ??
        (typeof res === "string" ? res : JSON.stringify(res));
      setMessages((m) => [...m, { role: "assistant", content: String(reply ?? "") }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e?.message ?? "failed"}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-8 space-y-4">
        <PageHeader title="AI assistant" subtitle="Powered by IPEN" />
        <Card className="flex flex-col h-[70vh]">
          <CardContent className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Ask about policies, quotes, claims, or coverage options.
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              )}
            </div>
            <form
              className="flex gap-2 p-3 border-t"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}