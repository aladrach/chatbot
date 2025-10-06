import { NextRequest } from "next/server";
import { trackChatInteraction } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const queryText = (body?.query as string) || "";
    const sessionId = body?.sessionId || request.headers.get('x-session-id') || `session-${Date.now()}`;
    
    if (!queryText) {
      return new Response(JSON.stringify({ error: "Missing 'query' in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = "https://vertex-ai-backend-659680475186.us-central1.run.app/api/search";
    // Always use non-streaming mode to enable analytics tracking
    const payload = { query: queryText, stream: false };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("response", response);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      
      // Track error
      trackAnalyticsAsync({
        sessionId,
        question: queryText,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        hasError: true,
        userAgent: request.headers.get('user-agent') || undefined,
        referrer: request.headers.get('referer') || undefined,
      });
      
      return new Response(JSON.stringify({ error: "Upstream request failed", status: response.status, details: text, response: response }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Always consume the response as JSON to track analytics properly
    // Even if streaming was requested, we'll return JSON to enable tracking
    const json = await response.json().catch(() => null);
    if (!json) {
      // Track error
      trackAnalyticsAsync({
        sessionId,
        question: queryText,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        hasError: true,
        userAgent: request.headers.get('user-agent') || undefined,
        referrer: request.headers.get('referer') || undefined,
      });
      
      return new Response(JSON.stringify({ error: "Invalid upstream JSON", response: response }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract analytics data from response
    const answerNode = json?.answer ?? json;
    const answerText: string | undefined = answerNode?.answerText;
    const relatedQuestions: string[] | undefined = answerNode?.relatedQuestions ?? json?.relatedQuestions;
    const sourcesInput: any[] | undefined = answerNode?.references ?? json?.references;
    const answerSkippedReasons: string[] | undefined = answerNode?.answerSkippedReasons;
    
    // Parse sources from references
    const sources: Array<{ title?: string; uri: string }> = [];
    if (Array.isArray(sourcesInput)) {
      const sourcesMap = new Map<string, { title?: string; uri: string }>();
      for (const ref of sourcesInput) {
        const uri: string | undefined = ref?.chunkInfo?.documentMetadata?.uri;
        const title: string | undefined = ref?.chunkInfo?.documentMetadata?.title;
        if (uri) {
          const key = uri;
          if (!sourcesMap.has(key)) {
            sourcesMap.set(key, { title, uri });
          }
        }
      }
      sources.push(...Array.from(sourcesMap.values()));
    }
    
    // Check if this is an unanswered question (out of domain or no results)
    const isUnanswered = Array.isArray(answerSkippedReasons) && answerSkippedReasons.length > 0;
    const skipReason = isUnanswered ? answerSkippedReasons[0] : undefined;
    
    // Track interaction
    trackAnalyticsAsync({
      sessionId,
      question: queryText,
      answer: answerText,
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      hasError: false,
      isUnanswered,
      skipReason,
      sourcesCount: sources.length,
      relatedQuestionsCount: Array.isArray(relatedQuestions) ? relatedQuestions.length : 0,
      sources,
      relatedQuestions,
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined,
    });

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-transform",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Helper function to track analytics asynchronously without blocking the response
function trackAnalyticsAsync(data: any) {
  // Call trackChatInteraction directly instead of making an HTTP request
  // This ensures reliable tracking in serverless environments like Vercel
  trackChatInteraction(data).catch(err => 
    console.error('Analytics tracking failed:', err)
  );
}


