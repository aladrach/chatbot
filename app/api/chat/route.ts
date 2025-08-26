import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { getCached, setCached } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"]; // closer to Google US endpoints
export const maxDuration = 60;

type DiscoveryEngineResponse = unknown;

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
      return NextResponse.json({ error: "Missing 'query' in request body" }, { status: 400 });
    }

    // Cache by normalized query
    const key = queryText.trim().toLowerCase();
    const cached = getCached<DiscoveryEngineResponse>("chat-answer", key);
    if (cached) {
      return NextResponse.json(
        { data: cached },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            "X-Cache": "HIT",
          },
        }
      );
    }
    const accessToken = await getAccessTokenFromServiceAccount();
    const url = "https://discoveryengine.googleapis.com/v1alpha/projects/659680475186/locations/global/collections/default_collection/engines/incorta-docs-searcher_1753768303750/servingConfigs/default_search:answer";

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

    const apiResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    

    if (!apiResponse.ok) {
      const text = await apiResponse.text();
      return NextResponse.json(
        { error: "Upstream request failed", status: apiResponse.status, details: text },
        { status: 502 }
      );
    }

    const data = (await apiResponse.json()) as DiscoveryEngineResponse;
    // Store in memory TTL cache
    setCached("chat-answer", key, data, 600);
    return NextResponse.json(
      { data },
      {
        headers: {
          // client should not cache; edge can cache response body in memory map via our server cache only
          "Cache-Control": "no-store, no-transform",
          "X-Cache": "MISS",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


