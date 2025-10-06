import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Basic auth check
function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  const validUsername = process.env.ANALYTICS_USERNAME || 'admin';
  const validPassword = process.env.ANALYTICS_PASSWORD || 'admin';

  return username === validUsername && password === validPassword;
}

export async function GET(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const questionText = searchParams.get('question');

    if (!questionText) {
      return NextResponse.json({ error: 'Missing question parameter' }, { status: 400 });
    }

    // Fetch all instances of this question with answers
    const result = await query(
      `SELECT 
        id,
        session_id,
        question,
        answer,
        timestamp,
        response_time,
        has_error,
        is_unanswered,
        skip_reason,
        sources_count,
        related_questions_count
      FROM chat_analytics
      WHERE question = $1
      ORDER BY timestamp DESC
      LIMIT 20`,
      [questionText]
    );

    return NextResponse.json({
      question: questionText,
      instances: result.rows,
      totalCount: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching question details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question details' },
      { status: 500 }
    );
  }
}

