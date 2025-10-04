"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import PerfectScrollbar from "react-perfect-scrollbar";
import "react-perfect-scrollbar/dist/css/styles.css";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// removed typing animation

type AssistantExtras = {
  answerText?: string;
  sources?: { title?: string; uri: string }[];
  relatedQuestions?: string[];
  raw?: unknown;
  streaming?: boolean;
};

type ChatMessage =
  | { role: "user"; content: string; timestamp?: number }
  | ({ role: "assistant"; content: string; timestamp?: number } & AssistantExtras);

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollbarRef = useRef<any>(null);
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [featuredPages, setFeaturedPages] = useState<{ name: string; url: string }[]>([]);
  const [ctaItems, setCtaItems] = useState<{ name: string; url: string }[]>([]);
  const lastSentUserIdRef = useRef<number | null>(null);
  const lastSentUserElementRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToUserRef = useRef(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const followModeRef = useRef<"top" | "manual">("top");
  const listenersAttachedRef = useRef(false);
  const manualLockRef = useRef(false);
  const chatWrapperRef = useRef<HTMLDivElement | null>(null);
  const [faqsExpanded, setFaqsExpanded] = useState(false);
  
  // New state for enhancements
  const [isListening, setIsListening] = useState(false);
  const [collapsedSources, setCollapsedSources] = useState<Set<number>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  
  // Session tracking for analytics
  const sessionIdRef = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const hasTrackedLoadRef = useRef(false);

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
    // When we have a pending scroll to the latest user message, scroll it to the top
    if (pendingScrollToUserRef.current && lastSentUserElementRef.current) {
      const container = resolveScrollContainer();
      const target = lastSentUserElementRef.current as HTMLElement;
      if (container && target) {
        try {
          // Update scrollbar first
          try { scrollbarRef.current?.updateScroll?.(); } catch {}
          
          requestAnimationFrame(() => {
            const padTop = parseFloat(getComputedStyle(container).paddingTop || "0") || 0;
            const topRaw = computeOffsetTop(container, target);
            const top = Math.max(0, topRaw - padTop);
            
            // Scroll immediately, then smooth
            container.scrollTop = top;
            setTimeout(() => {
              container.scrollTo({ top, behavior: "smooth" });
              try { scrollbarRef.current?.updateScroll?.(); } catch {}
            }, 20);
          });
        } catch (e) {
          console.error("Scroll error:", e);
        }
      }
      pendingScrollToUserRef.current = false;
      return;
    }

    // Continue scrolling to keep the user message at top during response generation
    if (followModeRef.current === "top" && !manualLockRef.current && lastSentUserElementRef.current) {
      const container = resolveScrollContainer();
      const target = lastSentUserElementRef.current as HTMLElement;
      if (container && target) {
        try {
          const padTop = parseFloat(getComputedStyle(container).paddingTop || "0") || 0;
          const topRaw = computeOffsetTop(container, target);
          const top = Math.max(0, topRaw - padTop);
          container.scrollTop = top;
          try { scrollbarRef.current?.updateScroll?.(); } catch {}
        } catch (e) {
          console.error("Scroll error:", e);
        }
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

  // Utility functions for new features
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const copyToClipboard = useCallback(async (text: string, messageId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const clearConversation = useCallback(() => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      followModeRef.current = "top";
    }
  }, []);

  const copyConversation = useCallback(async () => {
    const text = messages.map(m => {
      const role = m.role === 'user' ? 'You' : 'Assistant';
      const time = formatTimestamp(m.timestamp);
      return `${role} ${time ? `(${time})` : ''}:\n${m.content}\n`;
    }).join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      alert('Conversation copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy conversation:', err);
    }
  }, [messages]);

  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  }, [isListening]);

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

  // Fetch featured pages (Webflow collection) once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/featured-pages", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!json) return;
        const items = Array.isArray(json?.items) ? json.items : [];
        if (!cancelled) setFeaturedPages(items);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch CTA items
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cta", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!json) return;
        const items = Array.isArray(json?.items) ? json.items : [];
        if (!cancelled) setCtaItems(items);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cycle through suggestions in empty state
  useEffect(() => {
    if (messages.length === 0 && recommendedQuestions.length > 1) {
      const interval = setInterval(() => {
        setCurrentSuggestionIndex((prev) => (prev + 1) % recommendedQuestions.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [messages.length, recommendedQuestions.length]);

  // Track bot load once on mount
  useEffect(() => {
    if (!hasTrackedLoadRef.current) {
      hasTrackedLoadRef.current = true;
      
      // Track bot load for interaction rate calculation
      fetch('/api/analytics/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          timestamp: Date.now(),
          pageUrl: window.location.href,
        }),
      }).catch(err => console.error('Failed to track bot load:', err));
    }
  }, []);

  function extractProposedFollowUps(input: string): { cleanedText: string; followUps: string[] } {
    if (!input) {
      console.debug("extractProposedFollowUps: empty input");
      return { cleanedText: input, followUps: [] };
    }

    // 1) Try to extract from HTML structure if present (support multiple heading variants)
    const htmlSectionRegex = /(<(?:p|h[1-6])[^>]*>\s*(?:<strong>|<b>)?\s*(?:here\s+are\s+(?:some|the)\s+)?(?:(?:proposed|suggested|recommended)\s+)?(?:next\s+)?(?:follow(?:[-\s\u2011]?up)?\s+)?questions\s*:?(?:<\/strong>|<\/b>)?\s*<\/(?:p|h[1-6])>\s*<ul[^>]*>)([\s\S]*?)(<\/ul>)/i;
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
    const headingRegexes: RegExp[] = [
      /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:here\s+are\s+(?:some|the)\s+)?(?:(?:proposed|suggested|recommended)\s+)?(?:next\s+)?follow(?:[-\s\u2011]?up)?\s+questions\s*:?(?:\s*\*\*)?\s*$/i,
      /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:here\s+are\s+(?:some|the)\s+)?(?:suggested|recommended|related|next)\s+questions\s*:?(?:\s*\*\*)?\s*$/i,
      /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*here\s+are\s+(?:some|the)\s+follow(?:[-\s\u2011]?up)?\s+questions\s*:?(?:\s*\*\*)?\s*$/i,
    ];
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (headingRegexes.some((re) => re.test(line))) {
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

    const bulletRegex = /^\s*(?:[\-\*\u2022\u2013\u2014]|\d+\.)\s+(.*\S)\s*$/;
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
    setFaqsExpanded(false); // collapse FAQs after submitting
    const id = Date.now();
    lastSentUserIdRef.current = id;
    pendingScrollToUserRef.current = true;
    manualLockRef.current = false;
    followModeRef.current = "top";
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: Date.now(), id } as any]);
    setInput("");
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text,
          sessionId: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        const textBody = await res.text().catch(() => "");
        setMessages((prev) => [...prev, { role: "assistant", content: `Request failed (${res.status})` }]);
        return;
      }

      const json = await res.json().catch(() => null);
      if (!json) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Invalid response from server." }]);
        return;
      }

      const parsed = parseApiPayload(json);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: parsed.content,
          answerText: parsed.answerText,
          sources: parsed.sources,
          relatedQuestions: parsed.relatedQuestions,
          raw: parsed.raw,
          timestamp: Date.now(),
        },
      ]);
      // Keep top scroll behavior unless user intervened
      if (!manualLockRef.current) {
        followModeRef.current = "top";
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
    <div className="font-sans flex flex-col h-full w-full p-4 sm:p-4 relative embedded-chatbot" style={{background: 'rgba(16, 14, 37, .5)', border: '4px solid #42439A', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: '8px'}}>
      {/* Animated background */}
      <div className="animated-background"></div>
      
      <main className="flex flex-col gap-2 sm:gap-3 items-center sm:items-start w-full flex-1 min-h-0 relative z-10">
        <div className="w-full flex flex-col gap-2 flex-1 min-h-0">
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
                {/* Floating animated icon */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary/30 to-accent/30 border-2 border-secondary/50 flex items-center justify-center mb-6 animate-float shadow-lg">
                  <svg className="w-10 h-10 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                
                {/* Animated greeting */}
                <h2 className="text-xl font-semibold text-foreground mb-2 animate-slide-down">
                  Welcome to Incorta Assistant
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-1 animate-slide-down delay-100">
                  Ask a question about Incorta docs to get started.
                </p>
                <p className="text-xs text-muted-foreground/70 text-center animate-slide-down delay-200">
                  I can help you find information, explain concepts, and answer questions about Incorta.
                </p>
                
                {/* Cycling featured question */}
                {recommendedQuestions.length > 0 && (
                  <div className="mt-6 w-full max-w-xl animate-slide-down delay-300">
                    <div className="text-sm font-bold uppercase tracking-wider text-white mb-3 text-center">
                      Try asking:
                    </div>
                    <div className="relative h-16 overflow-hidden rounded-lg bg-gradient-to-r from-secondary/30 to-accent/25 border border-secondary/60 p-4 shadow-lg">
                      {recommendedQuestions.map((q, idx) => (
                        <button
                          key={`${idx}-${q}`}
                          type="button"
                          className={`absolute inset-0 p-4 text-sm text-center transition-all duration-500 cursor-pointer hover:bg-secondary/20 ${
                            idx === currentSuggestionIndex 
                              ? 'opacity-100 translate-y-0' 
                              : idx === (currentSuggestionIndex - 1 + recommendedQuestions.length) % recommendedQuestions.length
                              ? 'opacity-0 -translate-y-full'
                              : 'opacity-0 translate-y-full'
                          }`}
                          onClick={() => handleAsk(q)}
                          aria-label={`Use recommended question: ${q}`}
                        >
                          <span className="text-white font-semibold drop-shadow-sm">{q}</span>
                        </button>
                      ))}
                    </div>
                    
                    {/* All suggestions grid */}
                    <div className="mt-4">
                      <div className="text-sm font-bold uppercase tracking-wider text-white mb-3 text-center">
                        Or choose from:
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {recommendedQuestions.map((q, idx) => (
                          <button
                            key={`grid-${idx}-${q}`}
                            type="button"
                            className="text-xs px-3 py-2 rounded-full bg-secondary/30 hover:bg-secondary/40 border border-secondary/60 hover:border-secondary/80 transition-all hover:scale-[1.02] cursor-pointer text-white font-semibold shadow-md"
                            onClick={() => handleAsk(q)}
                            aria-label={`Use recommended question: ${q}`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
              {recommendedQuestions.length > 0 && (
                <div className="sticky top-0 z-20 mb-3 rounded-lg border border-border/50 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/90 hover:text-foreground transition-colors"
                    onClick={() => setFaqsExpanded((v) => !v)}
                    aria-expanded={faqsExpanded}
                    aria-controls="faqs-collapse"
                  >
                    <span>FAQs</span>
                    <span className={`inline-block transform transition-transform ${faqsExpanded ? "rotate-180" : "rotate-0"}`} aria-hidden>
                      ▼
                    </span>
                  </button>
                  {faqsExpanded && (
                    <div id="faqs-collapse" className="px-3 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {recommendedQuestions.map((q, idx) => (
                          <button
                            key={`${idx}-${q}`}
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 hover:border-secondary/60 transition-all hover:scale-[1.02] cursor-pointer text-foreground font-medium"
                            onClick={() => handleAsk(q)}
                            aria-label={`Use FAQ: ${q}`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <ul className="flex flex-col">
                {messages.map((m, i) => {
                  const isAssistant = m.role === "assistant";
                  const isStreaming = isAssistant && (m as any).streaming;
                  const messageText = isAssistant ? ((m as any).answerText ?? m.content) : m.content;
                  const isJustSentUser = !isAssistant && (m as any).id && (m as any).id === lastSentUserIdRef.current;
                  const key = (m as any).id ?? `${m.role}-${i}`;
                  
                  // Message grouping: reduce spacing if same sender as previous
                  const prevMessage = i > 0 ? messages[i - 1] : null;
                  const isGrouped = prevMessage && prevMessage.role === m.role;
                  const gapClass = isGrouped ? "mt-1" : "mt-4";
                  
                  // Responsive width based on content length
                  const contentLength = messageText.length;
                  const widthClass = contentLength < 50 ? "max-w-[65%]" : contentLength < 150 ? "max-w-[75%]" : "max-w-[85%]";
                  
                  return (
                    <li key={key} className={`${isAssistant ? "flex justify-start" : "flex justify-end"} ${gapClass} message-item`}>
                      <div className={`flex ${isAssistant ? "flex-row" : "flex-row-reverse"} gap-2 items-end ${widthClass}`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          isAssistant 
                            ? "bg-gradient-to-br from-secondary/30 to-accent/30 border border-secondary/50" 
                            : "bg-gradient-to-br from-accent/30 to-secondary/30 border border-accent/50"
                        } ${isGrouped ? "opacity-0" : "opacity-100"}`}>
                          {isAssistant ? (
                            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div
                            className={`group relative rounded-2xl px-4 py-3 text-sm ${
                              isAssistant
                                ? "message-bubble-assistant"
                                : "message-bubble-user"
                            }`}
                            ref={isJustSentUser ? lastSentUserElementRef : undefined}
                          >
                            {/* Copy button (appears on hover for assistant messages) */}
                            {isAssistant && (
                              <button
                                onClick={() => copyToClipboard(messageText, key as any)}
                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all bg-secondary text-white rounded-full p-1.5 shadow-lg hover:scale-[1.05] transform"
                                title="Copy message"
                                aria-label="Copy message to clipboard"
                              >
                                {copiedMessageId === key ? (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            )}
                            
                            {/* Message content */}
                            {isAssistant ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
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
                                    a: (props: any) => <a className="text-secondary hover:underline" target="_blank" rel="noreferrer" {...props} />,
                                    code: ({node, inline, className, children, ...props}: any) => {
                                      const match = /language-(\w+)/.exec(className || '');
                                      return !inline && match ? (
                                        <SyntaxHighlighter
                                          style={vscDarkPlus}
                                          language={match[1]}
                                          PreTag="div"
                                          className="rounded-lg my-3"
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                      ) : (
                                        <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-sm" {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                    table: (props: any) => (
                                      <div className="overflow-x-auto my-4">
                                        <table className="min-w-full divide-y divide-border" {...props} />
                                      </div>
                                    ),
                                    th: (props: any) => <th className="px-3 py-2 bg-muted text-left text-xs font-semibold" {...props} />,
                                    td: (props: any) => <td className="px-3 py-2 text-sm" {...props} />,
                                    blockquote: (props: any) => (
                                      <blockquote className="border-l-4 border-secondary pl-4 italic my-4 text-muted-foreground" {...props} />
                                    ),
                                  }}
                                >
                                  {messageText}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <span className="whitespace-pre-wrap break-words">{messageText}</span>
                            )}
                            
                            {/* Timestamp */}
                            {!isGrouped && m.timestamp && (
                              <div className={`text-xs text-muted-foreground/80 mt-2 ${isAssistant ? "text-left" : "text-right"}`}>
                                {formatTimestamp(m.timestamp)}
                              </div>
                            )}

                            {/* Collapsible Sources */}
                            {isAssistant && "sources" in m && m.sources && m.sources.length > 0 && (
                              <div className="mt-4 border-t border-border/50 pt-3">
                                <button
                                  onClick={() => {
                                    const newCollapsed = new Set(collapsedSources);
                                    if (newCollapsed.has(i)) {
                                      newCollapsed.delete(i);
                                    } else {
                                      newCollapsed.add(i);
                                    }
                                    setCollapsedSources(newCollapsed);
                                  }}
                                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white hover:text-white/80 transition-colors mb-2"
                                >
                                  <span>Sources ({m.sources.length})</span>
                                  <svg 
                                    className={`w-3 h-3 flex-shrink-0 transition-transform ${collapsedSources.has(i) ? "" : "rotate-180"}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {!collapsedSources.has(i) && (
                                  <div className="flex flex-col gap-2 animate-slide-down">
                                    {m.sources.map((s, idx) => (
                                      <a
                                        key={`${s.uri}-${idx}`}
                                        className="text-xs px-2 py-1.5 rounded-md bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 hover:border-secondary/60 transition-all text-white hover:text-white inline-flex items-start gap-1.5 font-medium min-w-0"
                                        href={s.uri}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={s.title || s.uri}
                                      >
                                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        <span className="line-clamp-2 break-words">{s.title || s.uri}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Related Questions */}
                            {isAssistant && "relatedQuestions" in m && m.relatedQuestions && m.relatedQuestions.length > 0 && (
                              <div className="mt-4 border-t border-border/50 pt-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/90 mb-2 text-left">Suggested questions</div>
                                <div className="flex flex-wrap gap-2 justify-start">
                                  {m.relatedQuestions.map((q, idx) => (
                                    <button
                                      key={`${idx}-${q}`}
                                      type="button"
                                      className="text-xs px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 hover:border-secondary/60 transition-all hover:scale-[1.02] cursor-pointer text-foreground font-medium text-left"
                                      onClick={() => handleAsk(q)}
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
                <div ref={messagesEndRef} />
              </ul>
              </>
            )}
            {isStreaming && (
              <div className="mt-4 ml-10 flex items-center gap-3 p-3 rounded-lg bg-secondary/10 border border-secondary/20 slide-up max-w-xs">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-secondary/40 to-accent/40">
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:0ms]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:120ms]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">AI is thinking</span>
                  <span className="text-xs text-muted-foreground/80">Analyzing your question...</span>
                </div>
              </div>
            )}
            </PerfectScrollbar>
            </div>
          </div>
          
          {featuredPages.length > 0 && (
            <div className="w-full slide-up flex-shrink-0">
              <div className="flex flex-wrap gap-1.5 px-0.5">
                {featuredPages.map((item, idx) => (
                  <a
                    key={`${idx}-${item.url}`}
                    href={item.url}
                    target="_parent"
                    rel="noreferrer noopener"
                    className="text-xs px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                    style={{background: 'rgba(0, 160, 152, 0.2)', border: '1px solid rgba(0, 160, 152, 0.4)', color: 'rgb(0, 160, 152)'}}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          {ctaItems.length > 0 && (
            <div className="w-full slide-up flex-shrink-0">
              {ctaItems.map((item, idx) => (
                <a
                  key={`${idx}-${item.url}`}
                  href={item.url}
                  target="_parent"
                  rel="noreferrer noopener"
                  className="block w-full text-center px-4 py-2 rounded-md hover:opacity-90 transition-all font-semibold text-sm"
                  style={{background: 'linear-gradient(135deg, rgb(72, 84, 254) 0%, rgb(72, 84, 254) 100%)', color: 'white', border: 'none'}}
                >
                  {item.name}
                </a>
              ))}
            </div>
          )}
          <div className="flex w-full items-center gap-2 slide-up flex-shrink-0 p-1.5 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border-2 border-secondary/40 shadow-xl input-area backdrop-blur-sm">
            <Input
              placeholder="Type your question and press Enter"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:bg-white/15 transition-all"
            />
            <Button 
              type="button" 
              onClick={() => sendMessage()} 
              disabled={isLoading || !input.trim()} 
              className="flex-shrink-0 button-press px-4 py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{background: 'linear-gradient(135deg, rgb(72, 84, 254) 0%, rgb(90, 100, 255) 100%)', border: 'none'}}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span className="hidden sm:inline">Sending</span>
                </span>
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
}


