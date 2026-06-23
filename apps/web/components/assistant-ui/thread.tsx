"use client";

import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { AlertCircle, ArrowUpIcon, BotIcon, SparklesIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";

import AITextLoading from "@/components/kokonutui/ai-text-loading";
import type { ChatScopeRequest } from "@/lib/chat/types";
import { buildThreadCopy, type ThreadCopy } from "@/lib/chat/thread-copy";
import { hasHiddenReasoning, stripHiddenReasoning } from "@/lib/chat/reasoning";
import { cn } from "@/lib/utils";

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[82%] rounded-2xl bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground shadow-sm">
        <MessagePrimitive.Parts
          components={{
            Text: ({ text }) => <span className="whitespace-pre-wrap">{text}</span>,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage({ thinkingTexts }: { thinkingTexts: string[] }) {
  const error = useAuiState((state) =>
    state.message.status?.type === "incomplete" &&
    state.message.status.reason === "error"
      ? (state.message.status.error ?? "The assistant could not finish this response.")
      : undefined,
  );

  return (
    <MessagePrimitive.Root className="flex justify-start gap-3">
      <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <BotIcon className="size-4" aria-hidden="true" />
      </div>
      <div className="max-w-[86%] space-y-2">
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
          <MessagePrimitive.Parts>
            {({ part }) => {
              if (part.type === "text") {
                const cleanText = stripHiddenReasoning(part.text);
                if (part.status?.type === "running" && cleanText.length === 0) {
                  return <ThinkingState texts={thinkingTexts} />;
                }
                if (
                  part.status?.type !== "running" &&
                  cleanText.length === 0 &&
                  hasHiddenReasoning(part.text)
                ) {
                  return (
                    <StatusPanel title="Assistant is still preparing" tone="neutral">
                      The model returned internal reasoning without a final answer. Please send the question again.
                    </StatusPanel>
                  );
                }
                if (cleanText.length === 0) {
                  return null;
                }
                return <MarkdownText text={cleanText} />;
              }

              if (part.type === "tool-call") {
                return (
                  <StatusPanel title="Using a tool" tone="neutral">
                    Reading page context and preparing the answer.
                  </StatusPanel>
                );
              }

              if (part.type === "reasoning") {
                if (part.status?.type !== "running") {
                  return null;
                }

                const reasoningText =
                  "text" in part && typeof part.text === "string"
                    ? part.text.trim()
                    : "";

                return (
                  <ThinkingState
                    texts={reasoningText ? [reasoningText] : thinkingTexts}
                  />
                );
              }

              return null;
            }}
          </MessagePrimitive.Parts>
        </div>

        {error ? (
          <StatusPanel title="Assistant response failed" tone="error">
            {String(error)}
          </StatusPanel>
        ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyThread({ copy }: { copy: ThreadCopy }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <SparklesIcon className="size-4" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground">{copy.emptyTitle}</p>
            <p className="mt-1 text-muted-foreground">{copy.emptyDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {copy.suggestions.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingState({ texts }: { texts: string[] }) {
  const loadingTexts = texts[0] === "Thinking..." ? texts : ["Thinking...", ...texts];

  return (
    <AITextLoading
      containerClassName="justify-start p-0"
      className="text-xs font-normal tracking-normal text-muted-foreground"
      interval={1400}
      texts={loadingTexts}
    />
  );
}

function StatusPanel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "neutral" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5",
        tone === "error"
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function MarkdownText({ text }: { text: string }) {
  const cleanText = stripHiddenReasoning(text);
  const blocks = parseMarkdownBlocks(cleanText);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="text-sm font-semibold text-foreground">
              {renderInlineMarkdown(block.text)}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1.5 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-disc marker:text-primary">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-primary/40 pl-3 text-muted-foreground"
            >
              {renderInlineMarkdown(block.text)}
            </blockquote>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5"
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "table") {
          return <MarkdownTable key={index} header={block.header} rows={block.rows} />;
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[2] });
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quote[1] });
      continue;
    }

    const maybeTable = parseTableAt(lines, index);
    if (maybeTable) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "table",
        header: maybeTable.header,
        rows: maybeTable.rows,
      });
      index += maybeTable.consumed - 1;
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (code) blocks.push({ type: "code", text: code.join("\n") });
  flushParagraph();
  flushList();

  return blocks.length ? blocks : [{ type: "paragraph", text }];
}

function MarkdownTable({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {header.map((cell, index) => (
              <th key={index} className="border-b border-border px-3 py-2 font-semibold">
                {renderInlineMarkdown(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-background even:bg-muted/20">
              {header.map((_, cellIndex) => (
                <td key={cellIndex} className="border-b border-border/60 px-3 py-2">
                  {renderInlineMarkdown(row[cellIndex] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseTableAt(lines: string[], startIndex: number) {
  const headerLine = lines[startIndex]?.trim();
  const separatorLine = lines[startIndex + 1]?.trim();
  if (!headerLine?.includes("|") || !separatorLine?.includes("|")) {
    return undefined;
  }

  const header = splitTableRow(headerLine);
  const separator = splitTableRow(separatorLine);
  const validSeparator =
    header.length > 1 &&
    separator.length === header.length &&
    separator.every((cell) => /^:?-{3,}:?$/.test(cell));

  if (!validSeparator) {
    return undefined;
  }

  const rows: string[][] = [];
  let consumed = 2;
  for (let index = startIndex + 2; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line || !line.includes("|")) {
      break;
    }
    rows.push(splitTableRow(line));
    consumed += 1;
  }

  return { header, rows, consumed };
}

function splitTableRow(line: string) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInlineMarkdown(text: string) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeMarkdownHref(link[2]);
      if (!href) return link[1];

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

function safeMarkdownHref(href: string) {
  const normalized = href.trim();
  if (
    normalized.startsWith("https://") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("/") ||
    normalized.startsWith("#")
  ) {
    return normalized;
  }
  return undefined;
}

export function Thread({ scope }: { scope?: ChatScopeRequest }) {
  const copy = buildThreadCopy(scope);

  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
      <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <EmptyThread copy={copy} />
        </AuiIf>

        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? (
              <UserMessage />
            ) : (
              <AssistantMessage thinkingTexts={copy.thinkingTexts} />
            )
          }
        </ThreadPrimitive.Messages>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pt-2">
          <ComposerPrimitive.Root className="rounded-2xl border border-border bg-background p-2 shadow-sm">
            <ComposerPrimitive.Input
              placeholder={copy.placeholder}
              className="min-h-11 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
              rows={1}
            />
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <UserIcon className="size-3.5" aria-hidden="true" />
                {copy.contextLabel}
              </div>
              <ComposerPrimitive.Send className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
                <ArrowUpIcon className="size-4" />
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
