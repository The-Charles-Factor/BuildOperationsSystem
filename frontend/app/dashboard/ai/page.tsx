"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  Toast,
} from "@/components";

type AIResponse = {
  question: string;
  answer: string;
  model: string;
};

const MAX_QUESTION_LENGTH = 4000;

const suggestedQuestions = [
  "What are my top-selling products?",
  "Which products are running low on stock?",
  "How are my sales performing?",
  "What should I know about my inventory?",
  "Give me a summary of my business performance.",
  "Which customers have outstanding balances?",
];

const fieldClass =
  "min-w-0 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 text-base leading-6 text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:px-4 sm:text-sm";

/* ------------------------------------------------------------------ */
/* Answer rendering                                                    */
/* ------------------------------------------------------------------ */

/* Renders **bold** and `code` as React nodes. No raw HTML is ever injected. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={index}
          className="font-semibold text-[var(--charcoal-900)]"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="break-words rounded bg-[var(--surface-muted)] px-1 py-0.5 font-mono text-[12px] text-[var(--charcoal-800)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

/* Normalizes responses where a table was flattened onto a single line. */
function normalizeMarkdownText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  return normalized.replace(/\|\s+\|/g, "|\n|");
}

type ListState = { ordered: boolean; items: string[] };

function AnswerBody({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const state: { list: ListState | null; paragraph: string[] } = {
    list: null,
    paragraph: [],
  };

  function flushParagraph() {
    if (state.paragraph.length === 0) return;

    blocks.push(
      <p
        key={blocks.length}
        className="break-words text-sm leading-6 text-[var(--charcoal-700)] sm:leading-7"
      >
        {renderInline(state.paragraph.join(" "))}
      </p>,
    );

    state.paragraph = [];
  }

  function flushList() {
    const list = state.list;

    if (!list) return;

    const Tag = list.ordered ? "ol" : "ul";

    blocks.push(
      <Tag
        key={blocks.length}
        className={`space-y-1.5 break-words pl-5 text-sm leading-6 text-[var(--charcoal-700)] sm:leading-7 ${
          list.ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {list.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </Tag>,
    );

    state.list = null;
  }

  const lines = normalizeMarkdownText(text).split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      flushList();
      i += 1;
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      flushParagraph();
      flushList();

      const headers = splitTableRow(line);
      i += 2;

      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes("|") || isTableSeparator(rowLine)) {
          break;
        }
        rows.push(splitTableRow(rowLine));
        i += 1;
      }

      blocks.push(
        <div
          key={blocks.length}
          className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-[var(--border)] bg-white"
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                {headers.map((header, hIdx) => (
                  <th
                    key={hIdx}
                    className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--charcoal-700)] sm:px-3.5 sm:py-2.5"
                  >
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {rows.map((cells, rIdx) => (
                <tr
                  key={rIdx}
                  className="transition hover:bg-[var(--surface-muted)]/60"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-3 py-2 text-sm text-[var(--charcoal-800)] sm:px-3.5 sm:py-2.5 ${
                        cIdx === 0
                          ? "font-medium text-[var(--charcoal-900)]"
                          : "whitespace-nowrap"
                      }`}
                    >
                      {renderInline(cells[cIdx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(
        <hr
          key={blocks.length}
          className="my-2 border-t border-[var(--border-soft)]"
        />,
      );
      i += 1;
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (heading) {
      flushParagraph();
      flushList();

      blocks.push(
        <h4
          key={blocks.length}
          className="break-words pt-1 text-sm font-semibold text-[var(--charcoal-900)]"
        >
          {renderInline(heading[1])}
        </h4>,
      );
      i += 1;
      continue;
    }

    if (bullet || numbered) {
      flushParagraph();

      const ordered = Boolean(numbered);

      if (state.list && state.list.ordered !== ordered) flushList();

      if (!state.list) state.list = { ordered, items: [] };

      state.list.items.push((bullet || numbered)![1]);
      i += 1;
      continue;
    }

    flushList();
    state.paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  flushList();

  return <div className="min-w-0 space-y-3">{blocks}</div>;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AIPage() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (loading || response || error) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [loading, response, error]);

  async function askAI(event?: FormEvent) {
    event?.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Enter a question first.");
      return;
    }

    const token = getToken();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResponse(null);

      const data = await apiFetch<AIResponse>("/api/ai/ask/", {
        method: "POST",
        token,
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });

      setResponse(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "BuildOps AI could not process your question.",
      );
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion(value: string) {
    setQuestion(value);
    setError("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();

      if (!loading && question.trim()) {
        void askAI();
      }
    }
  }

  function startNewQuestion() {
    setResponse(null);
    setError("");
    setQuestion("");
    textareaRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyAnswer() {
    if (!response) return;

    try {
      await navigator.clipboard.writeText(response.answer);
      setToast({ message: "Answer copied to clipboard.", tone: "success" });
    } catch {
      setToast({
        message: "Could not copy the answer. Select the text and copy it manually.",
        tone: "error",
      });
    }
  }

  const remaining = MAX_QUESTION_LENGTH - question.length;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <Toast
        open={toast !== null}
        message={toast?.message ?? ""}
        tone={toast?.tone ?? "success"}
        onClose={() => setToast(null)}
      />

      <PageHeader
        title="BuildOps AI"
        subtitle="Ask questions about your sales, stock, and customers using live shop data."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "BuildOps AI" },
        ]}
        action={<StatusBadge variant="active">Read-only</StatusBadge>}
      />

      {/* COMPACT PROMPT COMPOSER + QUICK PROMPTS */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <form onSubmit={askAI} className="p-3.5 sm:p-4">
          <label
            htmlFor="ai-question"
            className="mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]"
          >
            Ask a question
          </label>

          <textarea
            id="ai-question"
            ref={textareaRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Which products have sold the most this month?"
            rows={3}
            maxLength={MAX_QUESTION_LENGTH}
            className={fieldClass}
          />

          {!response && !loading && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="min-h-9 max-w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-left text-xs font-medium text-[var(--charcoal-700)] transition hover:border-[var(--emerald-500)] hover:bg-[var(--emerald-50)] hover:text-[var(--charcoal-900)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3.5 flex flex-col gap-2.5 border-t border-[var(--border-soft)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--charcoal-500)]">
              <span className="hidden sm:inline">
                <kbd className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
                  Enter
                </kbd>{" "}
                ·{" "}
              </span>
              <span
                className={
                  remaining < 200 ? "font-semibold text-amber-700" : undefined
                }
              >
                {remaining.toLocaleString()} chars left
              </span>
            </p>

            <div className="flex items-center gap-2">
              {question && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuestion("");
                    setError("");
                    textareaRef.current?.focus();
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}

              <Button
                type="submit"
                size="sm"
                loading={loading}
                loadingText="Analyzing..."
                disabled={!question.trim()}
                className="flex-1 sm:flex-initial"
              >
                Ask AI
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* RESULT AREA */}
      <div ref={resultRef} className="min-w-0 scroll-mt-16 space-y-4">
        {loading && (
          <section
            aria-live="polite"
            className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-[var(--shadow-card)] sm:p-4"
          >
            <p className="text-sm font-semibold text-[var(--charcoal-900)]">
              Analyzing your BuildOps data...
            </p>
            <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
              Gathering sales, stock, and customer figures.
            </p>
            <div className="mt-3">
              <LoadingState rows={2} />
            </div>
          </section>
        )}

        {error && (
          <ErrorState
            title="AI request failed"
            message={error}
            action={
              question.trim() && !loading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void askAI()}
                >
                  Try again
                </Button>
              ) : undefined
            }
          />
        )}

        {response && !loading && (
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-2.5 border-b border-[var(--border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--charcoal-900)]">
                  Response
                </h2>
                <p className="truncate text-xs text-[var(--charcoal-500)]">
                  Model:{" "}
                  <span className="font-mono text-[var(--charcoal-700)]">
                    {response.model}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copyAnswer()}
                >
                  Copy
                </Button>
                <Button size="sm" onClick={startNewQuestion}>
                  New question
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3.5 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--charcoal-500)]">
                  Question
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-[var(--charcoal-900)]">
                  {response.question}
                </p>
              </div>

              <div className="max-h-[60dvh] min-w-0 overflow-y-auto overscroll-contain pr-1">
                <AnswerBody text={response.answer} />
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--charcoal-500)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--emerald-500)]" />
                <span>
                  Read-only analysis from your current BuildOps organization data.
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* COMPACT GUARDRAILS STRIP */}
      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3">
        <InfoCard
          title="Organization scoped"
          text="Strictly limited to your authenticated shop/organization records."
        />
        <InfoCard
          title="Read-only"
          text="Analyzes data without modifying sales, stock, or customer records."
        />
        <InfoCard
          title="Shop source of truth"
          text="Grounded in your live BuildOps inventory and transaction data."
        />
      </div>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold text-[var(--charcoal-900)]">
        {title}
      </h3>
      <p className="mt-1 break-words text-xs leading-5 text-[var(--charcoal-500)]">
        {text}
      </p>
    </div>
  );
}