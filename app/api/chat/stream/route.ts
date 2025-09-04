import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    // Direct non-streaming proxy to Cloud Run backend
    const url = "https://vertex-ai-backend-659680475186.us-central1.run.app/api/search";
    const payload = { query: queryText };
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
      return new Response(JSON.stringify({ error: "Upstream request failed", status: response.status, details: text }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await response.json().catch(() => null);
    if (!json) {
      return new Response(JSON.stringify({ error: "Invalid upstream JSON" }), {
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


