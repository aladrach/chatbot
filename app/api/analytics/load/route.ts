import { NextRequest, NextResponse } from 'next/server';
import { trackBotLoad } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    await trackBotLoad({
      sessionId: body.sessionId,
      timestamp: new Date(body.timestamp || Date.now()),
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined,
      pageUrl: body.pageUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bot load tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track bot load' },
      { status: 500 }
    );
  }
}

