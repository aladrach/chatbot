"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import PerfectScrollbar from "react-perfect-scrollbar";
import "react-perfect-scrollbar/dist/css/styles.css";

// removed typing animation

type AssistantExtras = {
  answerText?: string;
  sources?: { title?: string; uri: string }[];
  relatedQuestions?: string[];
  raw?: unknown;
  streaming?: boolean;
};

type ChatMessage =
  | { role: "user"; content: string }
  | ({ role: "assistant"; content: string } & AssistantExtras);

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollbarRef = useRef<any>(null);
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const lastSentUserIdRef = useRef<number | null>(null);
  const lastSentUserElementRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToUserRef = useRef(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const followModeRef = useRef<"bottom" | "topAnchor" | "manual">("bottom");
  const listenersAttachedRef = useRef(false);
  const manualLockRef = useRef(false);
  const chatWrapperRef = useRef<HTMLDivElement | null>(null);

  function resolveScrollContainer(): HTMLElement | null {
    // If we already resolved a working scroll container and it's still in the DOM, reuse it
    if (scrollContainerRef.current && document.contains(scrollContainerRef.current)) {
      return scrollContainerRef.current;
    }

    const wrapper = chatWrapperRef.current;
    const anyRef: any = scrollbarRef.current;

    const candidates: (HTMLElement | null)[] = [
      // 1) Explicit containerRef from PerfectScrollbar
      scrollContainerRef.current,
      // 2) The known active PS container classes
      wrapper ? (wrapper.querySelector('.scrollbar-container.ps.ps--active-y') as HTMLElement | null) : null,
      // 3) Generic PS container
      wrapper ? (wrapper.querySelector('.ps') as HTMLElement | null) : null,
      // 4) The messages list itself if it happens to be scrollable
      wrapper ? (wrapper.querySelector('ul.flex.flex-col.gap-3') as HTMLElement | null) : null,
      // 5) Internal refs from the PS component
      (anyRef && (anyRef._container || anyRef.container)) as HTMLElement | null,
      // 6) As a last resort, the wrapper
      wrapper as HTMLElement | null,
    ];

    // Prefer the first actually scrollable candidate
    for (const el of candidates) {
      if (!el) continue;
      const isScrollable = (el.scrollHeight || 0) > (el.clientHeight || 0) + 1;
      if (isScrollable) {
        scrollContainerRef.current = el;
        return el;
      }
    }

    // Otherwise, pick the first non-null
    for (const el of candidates) {
      if (el) {
        scrollContainerRef.current = el;
        return el;
      }
    }
    return null;
  }

  function computeOffsetTop(parent: HTMLElement, el: HTMLElement): number {
    let offset = 0;
    let node: HTMLElement | null = el;
    while (node && node !== parent) {
      offset += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return offset;
  }

  // Attach user-interaction listeners to stop auto-scrolling when the user scrolls or drags
  useEffect(() => {
    if (listenersAttachedRef.current) return;
    const container = resolveScrollContainer();
    if (!container) return;
    const stopAuto = () => {
      manualLockRef.current = true;
      followModeRef.current = "manual";
      pendingScrollToUserRef.current = false;
    };
    container.addEventListener("wheel", stopAuto, { passive: true });
    container.addEventListener("pointerdown", stopAuto, { passive: true });
    container.addEventListener("touchstart", stopAuto, { passive: true });
    listenersAttachedRef.current = true;
    return () => {
      try { container.removeEventListener("wheel", stopAuto as any); } catch {}
      try { container.removeEventListener("pointerdown", stopAuto as any); } catch {}
      try { container.removeEventListener("touchstart", stopAuto as any); } catch {}
      listenersAttachedRef.current = false;
    };
  }, [messages.length]);

  useLayoutEffect(() => {
    if (pendingScrollToUserRef.current && lastSentUserElementRef.current) {
      // Scroll the PerfectScrollbar container so the just-sent user message aligns to top
      const getScrollContainer = (): HTMLElement | null => {
        return resolveScrollContainer();
      };

      const container = getScrollContainer();
      const target = lastSentUserElementRef.current as HTMLElement;
      try {
        if (container) {
          const computeOffsetTop = (parent: HTMLElement, el: HTMLElement): number => {
            let offset = 0;
            let node: HTMLElement | null = el;
            while (node && node !== parent) {
              offset += node.offsetTop;
              node = node.offsetParent as HTMLElement | null;
            }
            return offset;
          };
          const doScroll = () => {
            const padTop = parseFloat(getComputedStyle(container).paddingTop || "0") || 0;
            const topRaw = computeOffsetTop(container, target);
            const top = Math.max(0, topRaw - padTop);
            // Immediate position first to guarantee movement, then smooth-correct slightly after
            container.scrollTop = top;
            setTimeout(() => {
              container.scrollTo({ top, behavior: "smooth" });
            }, 20);
          };
          // Ensure PS has updated sizes before scroll
          try { scrollbarRef.current?.updateScroll?.(); } catch {}
          requestAnimationFrame(() => {
            doScroll();
            setTimeout(() => { try { scrollbarRef.current?.updateScroll?.(); } catch {} }, 60);
          });
        } else {
          // best-effort fallback
          target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }
      } catch {}
      pendingScrollToUserRef.current = false;
      return;
    }

    // While in topAnchor mode, continuously keep the just-sent user bubble at the top
    if (followModeRef.current === "topAnchor" && lastSentUserElementRef.current) {
      const container = resolveScrollContainer();
      const target = lastSentUserElementRef.current as HTMLElement;
      if (container) {
        const padTop = parseFloat(getComputedStyle(container).paddingTop || "0") || 0;
        const topRaw = computeOffsetTop(container, target);
        const top = Math.max(0, topRaw - padTop);
        // Set directly to avoid jitter during frequent updates
        container.scrollTop = top;
        try { scrollbarRef.current?.updateScroll?.(); } catch {}
      }
      return;
    }

    // Default behavior only when in bottom follow mode
    if (followModeRef.current === "bottom") {
      const container = resolveScrollContainer();
      if (container) {
        try { scrollbarRef.current?.updateScroll?.(); } catch {}
        requestAnimationFrame(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
          setTimeout(() => { try { scrollbarRef.current?.updateScroll?.(); } catch {} }, 60);
        });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  // Debug latest assistant related questions
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as any;
      if (m && m.role === "assistant") {
        console.debug("latest assistant relatedQuestions", m.relatedQuestions);
        break;
      }
    }
  }, [messages]);

  // Force PerfectScrollbar initialization on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollbarRef.current) {
        scrollbarRef.current.updateScroll();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  function parseApiPayload(payload: any): AssistantExtras & { content: string } {
    const answerNode = payload?.answer ?? payload;
    const answerText: string | undefined = answerNode?.answerText;
    const relatedQuestions: string[] | undefined = answerNode?.relatedQuestions ?? payload?.relatedQuestions;
    const sourcesInput: any[] | undefined = answerNode?.references ?? payload?.references;
    const sourcesMap = new Map<string, { title?: string; uri: string }>();
    if (Array.isArray(sourcesInput)) {
      for (const ref of sourcesInput) {
        const uri: string | undefined = ref?.chunkInfo?.documentMetadata?.uri;
        const title: string | undefined = ref?.chunkInfo?.documentMetadata?.title;
        const key = uri || title || JSON.stringify(ref);
        if (key && uri && !sourcesMap.has(key)) {
          sourcesMap.set(key, { title, uri });
        }
      }
    }
    const sources = Array.from(sourcesMap.values());

    // Strip proposed follow-ups and prefer them for related questions
    const extraction = extractProposedFollowUps(answerText || "");
    console.debug("parseApiPayload: extraction", { followUps: extraction.followUps, beforeAnswerLen: (answerText || "").length, afterAnswerLen: (extraction.cleanedText || "").length, streamedRelated: relatedQuestions });
    const finalAnswer = extraction.cleanedText || answerText || "";
    const parsedFollowUps = extraction.followUps;
    const finalRelated = (parsedFollowUps && parsedFollowUps.length > 0)
      ? parsedFollowUps
      : (Array.isArray(relatedQuestions) ? relatedQuestions : undefined);

    return {
      content: finalAnswer,
      answerText: finalAnswer || undefined,
      relatedQuestions: finalRelated,
      sources: sources.length ? sources : undefined,
      raw: payload,
    };
  }

  // Fetch recommended questions from a lightweight cached endpoint
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/suggestions", { method: "GET", cache: "force-cache" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!json) return;
        const rqs = (json?.suggestions as string[]) || [];
        if (!cancelled && rqs.length) {
          setRecommendedQuestions(rqs);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-populate input from URL parameter
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const candidateKeys = ["q", "query", "prompt", "message"];
      for (const key of candidateKeys) {
        const value = params.get(key);
        if (value && value.trim()) {
          setInput(value);
          break;
        }
      }
    } catch {}
  }, []);

  function extractProposedFollowUps(input: string): { cleanedText: string; followUps: string[] } {
    if (!input) {
      console.debug("extractProposedFollowUps: empty input");
      return { cleanedText: input, followUps: [] };
    }

    // 1) Try to extract from HTML structure if present
    const htmlSectionRegex = /(<p[^>]*>\s*Proposed\s+follow[-\s]*up\s+questions:\s*<\/p>\s*<ul[^>]*>)([\s\S]*?)(<\/ul>)/i;
    const htmlMatch = input.match(htmlSectionRegex);
    if (htmlMatch) {
      const listHtml = htmlMatch[2] || "";
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const followUps: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = liRegex.exec(listHtml)) !== null) {
        const raw = (m[1] || "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (raw) followUps.push(raw);
      }
      const cleanedText = input.replace(htmlMatch[0], "");
      console.debug("extractProposedFollowUps: HTML section found", { count: followUps.length, followUps });
      return { cleanedText, followUps };
    }

    // 2) Markdown/plain text parsing
    const lines = input.split(/\r?\n/);
    const headingRegex = /^\s*(?:#+\s*)?(?:\*\*[^*]*\*\*\s*)?Proposed\s+follow[-\s]*up\s+questions:\s*$/i;
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (headingRegex.test(lines[i])) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) {
      console.debug("extractProposedFollowUps: no section found");
      return { cleanedText: input, followUps: [] };
    }

    // Optionally skip an empty line after the header
    let idx = headerIndex + 1;
    if (idx < lines.length && /^\s*$/.test(lines[idx])) idx++;

    const bulletRegex = /^\s*(?:[\-\*\u2022]|\d+\.)\s+(.*\S)\s*$/;
    const followUps: string[] = [];
    let endIdx = idx;
    while (endIdx < lines.length) {
      const line = lines[endIdx];
      const m = line.match(bulletRegex);
      if (!m) break;
      const text = (m[1] || "").trim();
      if (text) followUps.push(text);
      endIdx++;
    }

    if (followUps.length === 0) {
      console.debug("extractProposedFollowUps: header found but no bullets");
      return { cleanedText: input, followUps: [] };
    }

    const cleanedLines = lines.slice(0, headerIndex).concat(lines.slice(endIdx));
    const cleanedText = cleanedLines.join("\n");
    console.debug("extractProposedFollowUps: Markdown section found", { count: followUps.length, followUps });
    return { cleanedText, followUps };
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;
    setIsLoading(true);
    const id = Date.now();
    lastSentUserIdRef.current = id;
    pendingScrollToUserRef.current = true;
    manualLockRef.current = false;
    followModeRef.current = "topAnchor";
    setMessages((prev) => [...prev, { role: "user", content: text, id } as any]);
    setInput("");
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (res.ok && res.body) {
        setIsStreaming(true);
        let accumulatedText = "";
        let relatedQuestions: string[] | undefined;
        const sourcesMap = new Map<string, { title?: string; uri: string }>();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // rolling text buffer
        let fullStream = ""; // accumulate for final parsing of references
        const deltaRegex = /\"answerText(?:Delta)?\"\s*:\s*\"((?:\\.|[^"\\])*)\"/g;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          fullStream += chunk;
          let match;
          let lastIndex = 0;
          let hasNewDeltas = false;
          while ((match = deltaRegex.exec(buffer)) !== null) {
            const raw = match[1] ?? "";
            try {
              const text = JSON.parse(`"${raw}"`);
              accumulatedText += text;
              hasNewDeltas = true;
            } catch {}
            lastIndex = deltaRegex.lastIndex;
          }

          if (hasNewDeltas) {
            const sources = Array.from(sourcesMap.values());
            const extractionLive = extractProposedFollowUps(accumulatedText);
            const liveAnswerText = extractionLive.cleanedText || accumulatedText;
            const liveFollowUps = extractionLive.followUps;
            if (extractionLive.followUps.length > 0) {
              console.debug("stream: extracted follow-ups live", extractionLive.followUps);
            }
            setMessages((prev) => {
              const next = [...prev];
              let foundStreaming = false;
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i];
                if (m.role === "assistant" && (m as any).streaming) {
                  next[i] = {
                    role: "assistant" as const,
                    content: liveAnswerText || "",
                    answerText: liveAnswerText || undefined,
                    sources: sources.length ? sources : undefined,
                    relatedQuestions: (liveFollowUps && liveFollowUps.length > 0)
                      ? liveFollowUps
                      : relatedQuestions,
                    raw: (m as any).raw,
                    streaming: true,
                  };
                  foundStreaming = true;
                  break;
                }
              }
              if (!foundStreaming && accumulatedText.length > 0) {
                const newMessage = {
                  role: "assistant" as const,
                  content: liveAnswerText,
                  answerText: liveAnswerText,
                  sources: sources.length ? sources : undefined,
                  relatedQuestions: (liveFollowUps && liveFollowUps.length > 0)
                    ? liveFollowUps
                    : relatedQuestions,
                  streaming: true,
                };
                next.push(newMessage);
              }
              return next;
            });
          }
          if (lastIndex > 0) {
            buffer = buffer.slice(lastIndex);
            deltaRegex.lastIndex = 0;
          } else if (buffer.length > 10000) {
            buffer = buffer.slice(-10000);
          }
        }

        buffer += decoder.decode();
        try {
          const chunks = fullStream.split(',\r\n{');
          for (let chunk of chunks) {
            if (!chunk.startsWith('{')) chunk = '{' + chunk;
            try {
              const obj = JSON.parse(chunk);
              const refs = obj?.references || obj?.answer?.references;
              if (Array.isArray(refs)) {
                for (const ref of refs) {
                  const uri: string | undefined = ref?.chunkInfo?.documentMetadata?.uri;
                  const title: string | undefined = ref?.chunkInfo?.documentMetadata?.title;
                  const key = uri || title || JSON.stringify(ref);
                  if (key && uri && !sourcesMap.has(key)) {
                    sourcesMap.set(key, { title, uri });
                  }
                }
              }
              const rqs = obj?.relatedQuestions || obj?.answer?.relatedQuestions;
              if (Array.isArray(rqs) && rqs.length) {
                relatedQuestions = rqs;
              }
            } catch (e) {
              const cleaned = chunk.replace(/^,\s*/, '');
              try {
                const obj = JSON.parse(cleaned);
                const refs = obj?.references || obj?.answer?.references;
                const rqs = obj?.relatedQuestions || obj?.answer?.relatedQuestions;
                if (Array.isArray(refs)) {
                  for (const ref of refs) {
                    const uri: string | undefined = ref?.chunkInfo?.documentMetadata?.uri;
                    const title: string | undefined = ref?.chunkInfo?.documentMetadata?.title;
                    const key = uri || title || JSON.stringify(ref);
                    if (key && uri && !sourcesMap.has(key)) {
                      sourcesMap.set(key, { title, uri });
                    }
                  }
                }
                if (Array.isArray(rqs) && rqs.length) {
                  relatedQuestions = rqs;
                }
              } catch {}
            }
          }
        } catch {}

        setIsStreaming(false);
        // Restore bottom follow after streaming completes unless user intervened
        if (!manualLockRef.current) {
          followModeRef.current = "bottom";
        }
        const finalSources = Array.from(sourcesMap.values());
        const extraction = extractProposedFollowUps(accumulatedText);
        const finalAnswerText = extraction.cleanedText;
        const parsedFollowUps = extraction.followUps;
        console.debug("stream: final extraction", { followUps: parsedFollowUps, finalAnswerLen: (finalAnswerText || "").length, streamedRelated: relatedQuestions });
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const m = next[i];
            if (m.role === "assistant" && (m as any).streaming) {
              next[i] = {
                ...(m as any),
                streaming: false,
                sources: finalSources.length > 0 ? finalSources : undefined,
                // Prefer parsed follow-ups; fallback to streamed relatedQuestions
                relatedQuestions: (parsedFollowUps && parsedFollowUps.length > 0)
                  ? parsedFollowUps
                  : (relatedQuestions || undefined),
                // Also strip the follow-ups section from displayed content
                content: finalAnswerText || (m as any).content,
                answerText: finalAnswerText || (m as any).answerText,
              } as any;
              return next;
            }
          }
          if (accumulatedText.length === 0) {
            next.push({ role: "assistant", content: "(No streamed content received)" } as any);
          }
          return next;
        });
      } else {
        const textBody = await res.text().catch(() => "");
        setMessages((prev) => [...prev, { role: "assistant", content: `Streaming failed (${res.status}).` }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleAsk(question: string) {
    if (isLoading) return;
    const q = (question || "").trim();
    if (!q) return;
    setInput(q);
    void sendMessage(q);
  }

  return (
    <div className="font-sans flex flex-col h-full w-full p-2 sm:p-4 relative embedded-chatbot" style={{background: 'transparent'}}>
      <main className="flex flex-col gap-3 sm:gap-4 items-center sm:items-start w-full max-w-4xl mx-auto flex-1 min-h-0 relative z-10">
        <div className="w-full flex flex-col gap-4 flex-1 min-h-0">
          <div className="w-full flex-1 rounded-lg chat-container min-h-0">
            <div ref={chatWrapperRef} style={{ height: '100%', width: '100%', position: 'relative' }}>
              <PerfectScrollbar 
                ref={scrollbarRef}
                key="chat-scrollbar"
                options={{
                  suppressScrollX: true,
                  wheelSpeed: 1,
                  wheelPropagation: true,
                  minScrollbarLength: 20,
                }}
                containerRef={(ref: HTMLElement | null) => { scrollContainerRef.current = ref; }}
                style={{ 
                  height: '100%', 
                  width: '100%',
                  padding: '1rem',
                  boxSizing: 'border-box'
                }}
              >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 fade-in">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Ask a question about Incorta docs to get started.
                </p>
                <p className="text-xs text-muted-foreground/70 text-center mt-2">
                  I can help you find information, explain concepts, and answer questions about Incorta.
                </p>
                {recommendedQuestions.length > 0 && (
                  <div className="mt-5 w-full max-w-xl">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 text-center">Recommended questions</div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {recommendedQuestions.map((q, idx) => (
                        <button
                          key={`${idx}-${q}`}
                          type="button"
                          className="text-xs underline hover:no-underline px-2 py-1 rounded-md related-question-btn text-left cursor-pointer"
                          onClick={() => handleAsk(q)}
                          aria-label={`Use recommended question: ${q}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => {
                  const isAssistant = m.role === "assistant";
                  const isStreaming = isAssistant && (m as any).streaming;
                  const messageText = isAssistant ? ((m as any).answerText ?? m.content) : m.content;
                  const isJustSentUser = !isAssistant && (m as any).id && (m as any).id === lastSentUserIdRef.current;
                  const key = (m as any).id ?? `${m.role}-${i}`;
                  
                  return (
                    <li key={key} className={`${isAssistant ? "flex justify-start" : "flex justify-end"} fade-in`}>
                      <div
                        className={
                          isAssistant
                            ? "max-w-[85%] rounded-2xl px-4 py-2 text-sm message-bubble-assistant"
                            : "max-w-[85%] rounded-2xl px-4 py-2 text-sm message-bubble-user"
                        }
                        ref={isJustSentUser ? lastSentUserElementRef : undefined}
                      >
                        {isAssistant ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none fade-in">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                p: (props: any) => <p className="mb-4 leading-7" {...props} />,
                                ul: (props: any) => <ul className="list-disc ml-6 my-3 space-y-1" {...props} />,
                                ol: (props: any) => <ol className="list-decimal ml-6 my-3 space-y-1" {...props} />,
                                li: (props: any) => <li className="leading-7" {...props} />,
                                h1: (props: any) => <h1 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                                h2: (props: any) => <h2 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                                h3: (props: any) => <h3 className="text-base font-semibold mt-4 mb-2" {...props} />,
                                a: (props: any) => <a className="underline hover:no-underline" target="_blank" rel="noreferrer" {...props} />,
                                code: (props: any) => <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded" {...props} />,
                              }}
                            >
                              {messageText}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{messageText}</span>
                        )}

                        {isAssistant && "sources" in m && m.sources && m.sources.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sources</div>
                            <div className="flex flex-wrap gap-2">
                              {m.sources.map((s, idx) => (
                                <a
                                  key={`${s.uri}-${idx}`}
                                  className="text-xs underline hover:no-underline px-2 py-1 rounded-md source-link"
                                  href={s.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {s.title || s.uri}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {isAssistant && "relatedQuestions" in m && m.relatedQuestions && m.relatedQuestions.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Suggested questions</div>
                            <div className="flex flex-wrap gap-2">
                              {m.relatedQuestions.map((q, idx) => (
                                <button
                                  key={`${idx}-${q}`}
                                  type="button"
                                  className="text-xs underline hover:no-underline px-2 py-1 rounded-md related-question-btn text-left cursor-pointer"
                                  onClick={() => handleAsk(q)}
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                <div ref={messagesEndRef} />
              </ul>
            )}
            {isStreaming && (
              <div className="mt-2 ml-1 flex items-center gap-2 text-xs text-muted-foreground typing-indicator slide-up">
                <span className="inline-flex gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="inline-block size-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                  <span className="inline-block size-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                </span>
                <span className="text-muted-foreground/80">Generating response...</span>
              </div>
            )}
            </PerfectScrollbar>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 slide-up flex-shrink-0">
            <Input
              placeholder="Type your question and press Enter"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="button" onClick={() => sendMessage()} disabled={isLoading || !input.trim()} className="flex-shrink-0">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span className="hidden sm:inline">Sending</span>
                </span>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
}


