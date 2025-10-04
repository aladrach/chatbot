import { NextRequest, NextResponse } from 'next/server';
import { trackChatInteraction } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    await trackChatInteraction({
      sessionId: body.sessionId,
      question: body.question,
      answer: body.answer,
      timestamp: new Date(body.timestamp || Date.now()),
      responseTime: body.responseTime,
      hasError: body.hasError || false,
      isUnanswered: body.isUnanswered || false,
      skipReason: body.skipReason,
      sourcesCount: body.sourcesCount,
      relatedQuestionsCount: body.relatedQuestionsCount,
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}

