import { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"]; // reduce egress latency towards Vertex AI backend
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const queryText = (body?.query as string) || "";
    if (!queryText) {
      return new Response(JSON.stringify({ error: "Missing 'query' in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const key = queryText.trim().toLowerCase();
    const cached = getCached<string>("chat-stream", key);
    if (cached) {
      // Serve cached as a single NDJSON message for simplicity
      const ndjson = cached.endsWith("\n") ? cached : cached + "\n";
      return new Response(ndjson, {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Cache": "HIT",
        },
      });
    }

    // New Vertex AI backend endpoint
    const url = "https://vertex-ai-backend-659680475186.us-central1.run.app/api/search";

    const payload = {
      query: queryText,
    };

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Prefer NDJSON style streaming; upstream will send chunked JSON responses
        Accept: "application/x-ndjson, application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream request failed", status: upstream.status, details: text }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Tee the stream: forward to client while accumulating for cache
    const { readable, writable } = new TransformStream();
    const reader = upstream.body.getReader();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let collected = "";

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const chunkText = new TextDecoder().decode(value);
            collected += chunkText;
            await writer.write(value);
          }
        }
      } finally {
        try { writer.close(); } catch {}
        // Persist a condensed cache: keep only the last full JSON object if present, otherwise store the NDJSON as-is
        try {
          // Best-effort: store entire NDJSON; UI regex handles deltas
          setCached("chat-stream", key, collected, 600);
        } catch {}
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Cache": "MISS",
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


