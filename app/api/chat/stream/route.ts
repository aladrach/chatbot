import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const queryText = (body?.query as string) || "";
    const streamMode = (body?.stream as boolean) !== false; // Default to streaming
    
    if (!queryText) {
      return new Response(JSON.stringify({ error: "Missing 'query' in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = "https://vertex-ai-backend-659680475186.us-central1.run.app/api/search";
    const payload = { query: queryText, stream: streamMode };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: streamMode ? "text/event-stream" : "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("response", response, "streaming:", streamMode);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream request failed", status: response.status, details: text, response: response }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If streaming is supported by backend, pipe the stream through
    if (streamMode && response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
      return new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable nginx buffering
        },
      });
    }

    // Fallback to non-streaming response
    const json = await response.json().catch(() => null);
    if (!json) {
      return new Response(JSON.stringify({ error: "Invalid upstream JSON", response: response }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

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


