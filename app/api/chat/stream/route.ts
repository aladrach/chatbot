import { NextRequest } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";

async function getAccessTokenFromServiceAccount(): Promise<string> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY env vars");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token || typeof token !== "string") {
    throw new Error("Failed to obtain access token");
  }
  return token;
}

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

    const accessToken = await getAccessTokenFromServiceAccount();

    // Stream Answer endpoint per Google Discovery Engine App Builder docs
    // https://cloud.google.com/generative-ai-app-builder/docs/stream-answer
    const url = "https://discoveryengine.googleapis.com/v1alpha/projects/659680475186/locations/global/collections/default_collection/engines/incorta-docs-searcher_1753768303750/servingConfigs/default_search:streamAnswer";

    const payload = {
      query: { text: queryText, queryId: "" },
      session: "",
      relatedQuestionsSpec: { enable: true },
      answerGenerationSpec: {
        ignoreAdversarialQuery: true,
        ignoreNonAnswerSeekingQuery: false,
        ignoreLowRelevantContent: true,
        multimodalSpec: {},
        includeCitations: true,
        modelSpec: { modelVersion: "stable" },
      },
    };

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

    // Pass-through NDJSON/JSON streaming body directly
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
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


