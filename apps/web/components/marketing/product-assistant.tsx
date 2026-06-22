"use client";

import * as React from "react";
import { BotIcon, HandIcon, SendIcon, XIcon } from "lucide-react";
import { MarkdownText } from "@/components/assistant-ui/thread";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import { Button } from "@/components/ui/button";
import { stripHiddenReasoning } from "@/lib/chat/reasoning";
import { cn } from "@/lib/utils";

type ProductMessage = {
  role: "assistant" | "user";
  content: string;
};

const suggestions = [
  "How does staking work?",
  "Do I need crypto?",
  "Can I be both roles?",
];

export function ProductAssistant() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [messages, setMessages] = React.useState<ProductMessage[]>([
    {
      role: "assistant",
      content: "Ask me product questions about Shire, staking, roles, AI matching, or escrow.",
    },
  ]);

  async function submit(question = input) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setError(null);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const response = await fetch("/api/product-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("rate-limited");
        }
        throw new Error(
          typeof body.error === "string" || typeof body.status === "string"
            ? String(body.error ?? body.status)
            : "product-assistant-error",
        );
      }

      const answer =
        typeof body.answer === "string" && body.answer.trim().length > 0
          ? stripHiddenReasoning(body.answer) ||
            "The product assistant could not return an answer yet."
          : "The product assistant could not return an answer yet.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer },
      ]);
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }
      setError(
        requestError instanceof Error && requestError.message === "rate-limited"
          ? "Too many questions in a short time. Please wait a moment, then ask again."
          : "Product assistant is unavailable right now. Please try again.",
      );
    } finally {
      setLoading(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex h-[min(78vh,34rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                <BotIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Shire Q&A</p>
                <p className="text-[11px] text-muted-foreground">Product questions only</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Close product assistant"
              onClick={() => setOpen(false)}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-6",
                  message.role === "user"
                    ? "ml-auto max-w-[82%] bg-primary text-primary-foreground"
                    : "mr-auto max-w-[88%] border border-border bg-background text-foreground",
                )}
              >
                {message.role === "assistant" ? (
                  <MarkdownText text={message.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
              </div>
            ))}
            {loading ? (
              <div className="mr-auto max-w-[88%] rounded-2xl border border-border bg-background px-4 py-3">
                <AITextLoading
                  containerClassName="justify-start p-0"
                  className="text-xs font-normal tracking-normal text-muted-foreground"
                  interval={1400}
                  texts={[
                    "Reading Shire product context...",
                    "Checking the public knowledge base...",
                    "Preparing a concise answer...",
                  ]}
                />
              </div>
            ) : null}
            {error ? (
              <div className="mr-auto max-w-[88%] rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-2.5 text-sm leading-6 text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about Shire..."
                rows={1}
                className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" size="icon" className="size-9 rounded-full" disabled={loading}>
                <SendIcon className="size-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative flex items-center gap-2 rounded-2xl border border-primary/20 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-xl shadow-primary/10 transition-transform hover:-translate-y-0.5"
          >
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
              <HandIcon
                className="size-3.5 origin-bottom-right animate-[shire-wave_1.6s_ease-in-out_infinite]"
                aria-hidden="true"
              />
            </span>
            <span className="text-left leading-tight">
              Ask me
              <span className="block text-[10px] font-medium text-muted-foreground">
                about Shire
              </span>
            </span>
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary shadow-lg shadow-primary/60" />
            <span className="absolute -bottom-1.5 right-5 size-3 rotate-45 border-b border-r border-primary/20 bg-card" />
          </button>
          <Button
            type="button"
            size="icon"
            aria-label="Open Shire product assistant"
            className="size-14 rounded-full shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            onClick={() => setOpen(true)}
          >
            <BotIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
