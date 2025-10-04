import { query } from './db';

export interface ChatAnalytics {
  sessionId: string;
  question: string;
  answer?: string;
  timestamp: Date;
  responseTime?: number;
  hasError: boolean;
  isUnanswered?: boolean;
  skipReason?: string;
  sourcesCount?: number;
  relatedQuestionsCount?: number;
  userAgent?: string;
  referrer?: string;
}

export async function trackChatInteraction(data: ChatAnalytics) {
  try {
    await query(
      `INSERT INTO chat_analytics 
       (session_id, question, answer, timestamp, response_time, has_error, is_unanswered, skip_reason, sources_count, related_questions_count, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        data.sessionId,
        data.question,
        data.answer,
        data.timestamp,
        data.responseTime,
        data.hasError,
        data.isUnanswered || false,
        data.skipReason,
        data.sourcesCount || 0,
        data.relatedQuestionsCount || 0,
        data.userAgent,
        data.referrer,
      ]
    );
  } catch (error) {
    console.error('Failed to track analytics:', error);
  }
}

export async function getAnalyticsSummary(startDate?: Date, endDate?: Date) {
  const dateFilter = startDate && endDate
    ? `WHERE timestamp >= $1 AND timestamp <= $2`
    : '';
  const params = startDate && endDate ? [startDate, endDate] : [];

  const [
    totalInteractions,
    avgResponseTime,
    errorRate,
    topQuestions,
    unansweredQuestions,
    dailyEngagement,
    avgSourcesPerResponse,
  ] = await Promise.all([
    // Total interactions
    query(
      `SELECT COUNT(*) as count FROM chat_analytics ${dateFilter}`,
      params
    ),
    // Average response time
    query(
      `SELECT AVG(response_time) as avg_time FROM chat_analytics WHERE response_time IS NOT NULL ${dateFilter.replace('WHERE', 'AND')}`,
      params
    ),
    // Error rate
    query(
      `SELECT 
        COUNT(*) FILTER (WHERE has_error = true) as errors,
        COUNT(*) as total
       FROM chat_analytics ${dateFilter}`,
      params
    ),
    // Top questions
    query(
      `SELECT question, COUNT(*) as count 
       FROM chat_analytics 
       ${dateFilter}
       ${dateFilter ? 'AND' : 'WHERE'} is_unanswered = false
       GROUP BY question 
       ORDER BY count DESC 
       LIMIT 10`,
      params
    ),
    // Unanswered questions (out of domain)
    query(
      `SELECT question, COUNT(*) as count, MAX(timestamp) as timestamp
       FROM chat_analytics 
       ${dateFilter}
       ${dateFilter ? 'AND' : 'WHERE'} is_unanswered = true
       GROUP BY question 
       ORDER BY count DESC, timestamp DESC
       LIMIT 20`,
      params
    ),
    // Daily engagement
    query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as interactions,
        COUNT(DISTINCT session_id) as unique_sessions
       FROM chat_analytics 
       ${dateFilter}
       GROUP BY DATE(timestamp)
       ORDER BY date DESC
       LIMIT 30`,
      params
    ),
    // Average sources per response
    query(
      `SELECT AVG(sources_count) as avg_sources FROM chat_analytics ${dateFilter}`,
      params
    ),
  ]);

  return {
    totalInteractions: parseInt(totalInteractions.rows[0]?.count || '0'),
    avgResponseTime: parseFloat(avgResponseTime.rows[0]?.avg_time || '0'),
    errorRate: errorRate.rows[0]
      ? (errorRate.rows[0].errors / errorRate.rows[0].total) * 100
      : 0,
    topQuestions: topQuestions.rows,
    unansweredQuestions: unansweredQuestions.rows,
    dailyEngagement: dailyEngagement.rows,
    avgSourcesPerResponse: parseFloat(avgSourcesPerResponse.rows[0]?.avg_sources || '0'),
  };
}

export async function getTopicDistribution() {
  // Simple topic extraction based on keywords
  const result = await query(`
    SELECT 
      CASE 
        WHEN question ILIKE '%authentication%' OR question ILIKE '%login%' OR question ILIKE '%auth%' THEN 'Authentication'
        WHEN question ILIKE '%data%' OR question ILIKE '%database%' THEN 'Data & Database'
        WHEN question ILIKE '%api%' OR question ILIKE '%endpoint%' THEN 'API'
        WHEN question ILIKE '%dashboard%' OR question ILIKE '%visualization%' THEN 'Dashboards'
        WHEN question ILIKE '%security%' OR question ILIKE '%permission%' THEN 'Security'
        WHEN question ILIKE '%integration%' OR question ILIKE '%connect%' THEN 'Integration'
        WHEN question ILIKE '%performance%' OR question ILIKE '%optimize%' THEN 'Performance'
        WHEN question ILIKE '%error%' OR question ILIKE '%issue%' OR question ILIKE '%problem%' THEN 'Troubleshooting'
        ELSE 'General'
      END as topic,
      COUNT(*) as count
    FROM chat_analytics
    GROUP BY topic
    ORDER BY count DESC
  `);

  return result.rows;
}

