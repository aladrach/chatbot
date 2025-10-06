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

    // Fetch all instances of this question with answers, sources, and related questions
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
        related_questions_count,
        sources,
        related_questions
      FROM chat_analytics
      WHERE question = $1
      ORDER BY timestamp DESC
      LIMIT 50`,
      [questionText]
    );

    // Group responses by answer to combine duplicates
    const groupedResponses = new Map<string, any>();
    
    for (const row of result.rows) {
      // Create a key based on answer, error state, and unanswered state
      const key = `${row.answer || 'null'}_${row.has_error}_${row.is_unanswered}_${row.skip_reason || ''}`;
      
      if (groupedResponses.has(key)) {
        const existing = groupedResponses.get(key);
        existing.count++;
        existing.timestamps.push(row.timestamp);
        existing.session_ids.push(row.session_id);
        existing.response_times.push(row.response_time);
      } else {
        groupedResponses.set(key, {
          answer: row.answer,
          has_error: row.has_error,
          is_unanswered: row.is_unanswered,
          skip_reason: row.skip_reason,
          sources_count: row.sources_count,
          related_questions_count: row.related_questions_count,
          sources: row.sources,
          related_questions: row.related_questions,
          count: 1,
          timestamps: [row.timestamp],
          session_ids: [row.session_id],
          response_times: [row.response_time],
          first_seen: row.timestamp,
          last_seen: row.timestamp,
        });
      }
    }

    // Convert to array and calculate stats
    const instances = Array.from(groupedResponses.values()).map(item => {
      const validResponseTimes = item.response_times.filter((rt: number) => rt != null);
      return {
        ...item,
        first_seen: item.timestamps[item.timestamps.length - 1],
        last_seen: item.timestamps[0],
        avg_response_time: validResponseTimes.length > 0
          ? Math.round(validResponseTimes.reduce((a: number, b: number) => a + b, 0) / validResponseTimes.length)
          : null,
      };
    });

    // Sort by count (most frequent first)
    instances.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      question: questionText,
      instances,
      totalCount: result.rows.length,
      uniqueResponses: instances.length,
    });
  } catch (error) {
    console.error('Error fetching question details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question details' },
      { status: 500 }
    );
  }
}

