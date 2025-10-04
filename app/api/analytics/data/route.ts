import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSummary, getTopicDistribution } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) return false;
  
  const [type, credentials] = authHeader.split(' ');
  
  if (type !== 'Basic') return false;
  
  const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');
  
  // Check against environment variables
  const validUsername = process.env.ANALYTICS_USERNAME || 'admin';
  const validPassword = process.env.ANALYTICS_PASSWORD;
  
  if (!validPassword) {
    console.warn('ANALYTICS_PASSWORD not set in environment variables');
    return false;
  }
  
  return username === validUsername && password === validPassword;
}

export async function GET(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Analytics Dashboard"',
      },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const [summary, topics] = await Promise.all([
      getAnalyticsSummary(startDate, endDate),
      getTopicDistribution(),
    ]);

    return NextResponse.json({
      summary,
      topics,
    });
  } catch (error) {
    console.error('Analytics data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

