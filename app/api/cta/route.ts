import { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_NAMESPACE = "webflow_cta_pages";
const CACHE_KEY = "collection_68c991cc4375836a27905e00";
const CACHE_TTL_SECONDS = 300; // 5 minutes

type CtaItem = { name: string; url: string };

export async function GET(_req: NextRequest) {
  try {
    const cached = getCached<CtaItem[]>(CACHE_NAMESPACE, CACHE_KEY);
    if (cached) {
      return new Response(JSON.stringify({ items: cached }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const token = process.env.WEBFLOW_TOKEN || process.env.WEBFLOW_API_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing WEBFLOW_TOKEN env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const collectionId = "68c991cc4375836a27905e00";
    const url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "Webflow request failed", status: resp.status, details: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const json = await resp.json().catch(() => null);
    if (!json) {
      return new Response(JSON.stringify({ error: "Invalid Webflow JSON" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawItems: any[] = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
    const items: CtaItem[] = rawItems
      .map((it: any) => {
        const fieldData = it?.fieldData || it;
        const name: string | undefined = fieldData?.name || it?.name;
        const urlField: string | undefined = fieldData?.url || fieldData?.link || it?.url;
        if (!name || !urlField) return null;
        return { name: String(name), url: String(urlField) } as CtaItem;
      })
      .filter(Boolean) as CtaItem[];

    setCached(CACHE_NAMESPACE, CACHE_KEY, items, CACHE_TTL_SECONDS);

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


