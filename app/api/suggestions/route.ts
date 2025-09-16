import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 300; // 1 hour ISR at edge

// Lightweight suggestions endpoint backed by Webflow CMS

const WEBFLOW_COLLECTION_ID = "68c97c6e6c4dbf222162ecec";
const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

async function fetchWebflowFaqNames(): Promise<{
  names: string[];
  debug: Record<string, unknown>;
}> {
  const token = process.env.WEBFLOW_API_TOKEN;
  const url = `${WEBFLOW_API_BASE}/collections/${WEBFLOW_COLLECTION_ID}/items?page=1&limit=100`;
  const baseDebug: Record<string, unknown> = {
    hadToken: Boolean(token),
    url,
  };

  if (!token) {
    return { names: [], debug: { ...baseDebug, error: "Missing WEBFLOW_API_TOKEN" } };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      // Cache at the edge according to route settings
      cache: "force-cache",
      next: { revalidate },
    });

    const status = res.status;
    const ok = res.ok;
    const rawText = await res.clone().text().catch(() => null);

    if (!ok) {
      const debug = { ...baseDebug, status, ok, rawText };
      console.error("[webflow-suggestions] Non-OK response", debug);
      return { names: [], debug };
    }

    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : await res.json();
    } catch (e) {
      const debug = { ...baseDebug, status, ok, rawText, parseError: String(e) };
      console.error("[webflow-suggestions] JSON parse error", debug);
      return { names: [], debug };
    }

    const arraySource = Array.isArray(data?.items)
      ? "items"
      : Array.isArray(data?.collectionItems)
      ? "collectionItems"
      : Array.isArray(data?.data)
      ? "data"
      : "none";

    const items =
      arraySource === "items"
        ? data.items
        : arraySource === "collectionItems"
        ? data.collectionItems
        : arraySource === "data"
        ? data.data
        : [];

    const names: string[] = (items as any[])
      .map((it) => (it?.fieldData?.name ?? it?.name ?? it?.fields?.name ?? "").toString().trim())
      .filter((n) => n && n.length > 0);

    // De-duplicate while preserving order
    const seen = new Set<string>();
    const unique = names.filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    const debug: Record<string, unknown> = {
      ...baseDebug,
      status,
      ok,
      arraySource,
      keys: data && typeof data === "object" ? Object.keys(data) : null,
      rawItemsCount: Array.isArray(items) ? items.length : 0,
      firstItemSample: Array.isArray(items) && items.length > 0
        ? {
            id: items[0]?.id ?? items[0]?._id,
            name: items[0]?.fieldData?.name ?? items[0]?.name ?? items[0]?.fields?.name,
            isDraft: items[0]?.isDraft,
            hasFieldData: Boolean(items[0]?.fieldData),
          }
        : null,
    };

    return { names: unique, debug };
  } catch (error) {
    const debug = { ...baseDebug, error: String(error) };
    console.error("[webflow-suggestions] Fetch error", debug);
    return { names: [], debug };
  }
}

export async function GET() {
  const { names, debug } = await fetchWebflowFaqNames();
  const suggestions = names;

  return NextResponse.json(
    { suggestions, debug },
    {
      headers: {
        // Cache on Vercel Edge for 1 hour; allow stale while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    }
  );
}


