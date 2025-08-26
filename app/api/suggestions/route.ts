import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 60 * 60; // 1 hour ISR at edge

// Lightweight suggestions to avoid cold start on chat endpoints
const DEFAULT_SUGGESTIONS = [
  "What is Incorta?",
  "How do I connect data sources?",
  "How does Direct Data Mapping work?",
  "How do I build a dashboard?",
];

export async function GET() {
  return NextResponse.json(
    { suggestions: DEFAULT_SUGGESTIONS },
    {
      headers: {
        // Cache on Vercel Edge for 1 hour; allow stale while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    }
  );
}


