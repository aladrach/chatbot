"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import PerfectScrollbar from "react-perfect-scrollbar";
import "react-perfect-scrollbar/dist/css/styles.css";

// Typing animation component
function TypingText({ text, isActive, speed = 5 }: { text: string; isActive: boolean; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isActive || !text) {
      setDisplayedText(text);
      return;
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [text, currentIndex, isActive, speed]);

  // Reset when target text changes significantly (new message)
  useEffect(() => {
    if (isActive && text.length < displayedText.length) {
      setCurrentIndex(0);
      setDisplayedText("");
    }
  }, [text, isActive, displayedText.length]);

  const displayText = isActive ? displayedText : text;

  return (
    <>
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
        {displayText}
      </ReactMarkdown>
      {isActive && (
        <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
      )}
    </>
  );
}

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

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract delta text from arbitrary streaming JSON shapes (AnswerTextDelta, answerText, text, etc)
  function extractDeltaText(input: any): string {
    let result = "";
    const stack: any[] = [input];
    const keyRegex = /answertextdelta|answertext|textdelta|text/i;
    while (stack.length) {
      const node = stack.pop();
      if (node == null) continue;
      if (typeof node === "string") continue;
      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      } else if (typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string" && keyRegex.test(k)) {
            result += v;
          } else if (v && (typeof v === "object" || Array.isArray(v))) {
            stack.push(v as any);
          }
        }
      }
    }
    return result;
  }

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
    return {
      content: answerText || "",
      answerText: answerText || undefined,
      relatedQuestions: relatedQuestions && Array.isArray(relatedQuestions) ? relatedQuestions : undefined,
      sources: sources.length ? sources : undefined,
      raw: payload,
    };
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    try {
      // Try streaming endpoint first
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (res.ok && res.body) {
        // Show a global generating indicator; insert the assistant bubble only after first token
        setIsStreaming(true);
        console.log("[stream] status:", res.status, "content-type:", res.headers.get("content-type"));
        let accumulatedText = "";
        let relatedQuestions: string[] | undefined;
        const sourcesMap = new Map<string, { title?: string; uri: string }>();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // rolling text buffer
        let fullStream = ""; // accumulate for final parsing of references
        // Match both answerTextDelta and answerText; capture quoted string content
        const deltaRegex = /\"answerText(?:Delta)?\"\s*:\s*\"((?:\\.|[^"\\])*)\"/g;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          console.log("[stream] chunk:", chunk);
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
              console.log("[stream] delta:", text);
            } catch {}
            lastIndex = deltaRegex.lastIndex;
          }

          // Only update UI if we found new deltas
          if (hasNewDeltas) {
            const sources = Array.from(sourcesMap.values());
            console.log("[stream] updating UI, accumulatedText length:", accumulatedText.length);
            setMessages((prev) => {
              const next = [...prev];
              
              // Check if we already have a streaming assistant message
              let foundStreaming = false;
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i];
                if (m.role === "assistant" && (m as any).streaming) {
                  next[i] = {
                    role: "assistant" as const,
                    content: accumulatedText || "",
                    answerText: accumulatedText || undefined,
                    sources: sources.length ? sources : undefined,
                    relatedQuestions,
                    raw: (m as any).raw,
                    streaming: true,
                  };
                  console.log("[stream] updated assistant message at index", i);
                  foundStreaming = true;
                  break;
                }
              }
              
              // If no streaming message exists and we have content, create one
              if (!foundStreaming && accumulatedText.length > 0) {
                const newMessage = {
                  role: "assistant" as const,
                  content: accumulatedText,
                  answerText: accumulatedText,
                  sources: sources.length ? sources : undefined,
                  relatedQuestions,
                  streaming: true,
                };
                next.push(newMessage);
                console.log("[stream] inserted new assistant message:", newMessage);
              }
              
              return next;
            });
          }
          // Retain only the tail we haven't processed to prevent buffer explosion
          if (lastIndex > 0) {
            buffer = buffer.slice(lastIndex);
            deltaRegex.lastIndex = 0;
          } else if (buffer.length > 10000) {
            // keep last 10KB just in case of very long streams
            buffer = buffer.slice(-10000);
          }
        }

        // Flush decoder internal buffer in case upstream didn't end with newline
        buffer += decoder.decode();
        // Extract references and related questions from full stream at the end
        try {
          // Look for the final complete response with state: "SUCCEEDED"
          const chunks = fullStream.split(',\r\n{');
          for (let chunk of chunks) {
            if (!chunk.startsWith('{')) chunk = '{' + chunk;
            try {
              const obj = JSON.parse(chunk);
              
              // Extract references from various possible locations
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
              
              // Extract related questions
              const rqs = obj?.relatedQuestions || obj?.answer?.relatedQuestions;
              if (Array.isArray(rqs) && rqs.length) {
                relatedQuestions = rqs;
              }
              
              console.log("[stream] parsed chunk for refs/questions:", { 
                hasRefs: !!refs, 
                refCount: refs?.length || 0, 
                hasQuestions: !!rqs, 
                questionCount: rqs?.length || 0,
                state: obj?.answer?.state 
              });
            } catch (e) {
              // Try parsing without leading comma
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

        // Finalize assistant message with sources and related questions
        setIsStreaming(false);
        const finalSources = Array.from(sourcesMap.values());
        console.log("[stream] finalizing with sources:", finalSources, "relatedQuestions:", relatedQuestions);
        
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const m = next[i];
            if (m.role === "assistant" && (m as any).streaming) {
              next[i] = {
                ...(m as any),
                streaming: false,
                sources: finalSources.length > 0 ? finalSources : undefined,
                relatedQuestions: relatedQuestions || undefined,
              } as any;
              console.log("[stream] finalized assistant message with sources and questions");
              return next;
            }
          }
          if (accumulatedText.length === 0) {
            console.warn("[stream] completed with no accumulated text");
            next.push({ role: "assistant", content: "(No streamed content received)" } as any);
          }
          return next;
        });
      } else {
        const textBody = await res.text().catch(() => "");
        console.error("[stream] non-ok or missing body:", res.status, textBody);
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

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary)_0%,_transparent_50%)] opacity-5 pointer-events-none" />
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full max-w-2xl relative z-10">
        <div className="w-full flex flex-col gap-4">
          <div className="w-full min-h-[240px] max-h-[800px] rounded-lg chat-container">
            <PerfectScrollbar 
              options={{
                wheelPropagation: false,
                suppressScrollX: true,
              }}
              style={{ 
                maxHeight: '800px', 
                minHeight: '240px',
                padding: '1rem'
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
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => {
                  const isAssistant = m.role === "assistant";
                  const isStreaming = isAssistant && (m as any).streaming;
                  const messageText = isAssistant ? ((m as any).answerText ?? m.content) : m.content;
                  
                  return (
                    <li key={i} className={`${isAssistant ? "flex justify-start" : "flex justify-end"} fade-in`}>
                      <div
                        className={
                          isAssistant
                            ? "max-w-[85%] rounded-2xl px-4 py-2 text-sm message-bubble-assistant"
                            : "max-w-[85%] rounded-2xl px-4 py-2 text-sm message-bubble-user"
                        }
                      >
                        {isAssistant ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <TypingText text={messageText} isActive={isStreaming} speed={20} />
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{messageText}</span>
                        )}

                        {/* streaming indicator moved outside bubble */}

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
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Related questions</div>
                            <div className="flex flex-wrap gap-2">
                              {m.relatedQuestions.map((q, idx) => (
                                <button
                                  key={`${idx}-${q}`}
                                  type="button"
                                  className="text-xs underline hover:no-underline px-2 py-1 rounded-md related-question-btn text-left"
                                  onClick={() => setInput(q)}
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
            {/* Out-of-bubble generating indicator */}
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
          <div className="flex w-full items-center gap-2 slide-up">
            <Input
              placeholder="Type your question and press Enter"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button type="button" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Sending
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
