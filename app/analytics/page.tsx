'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  summary: {
    totalInteractions: number;
    totalBotLoads: number;
    uniqueInteractingSessions: number;
    interactionRate: number;
    avgResponseTime: number;
    errorRate: number;
    topQuestions: Array<{ question: string; count: number }>;
    unansweredQuestions: Array<{ question: string; count: number; timestamp: string }>;
    dailyEngagement: Array<{ date: string; interactions: number; unique_sessions: number }>;
    avgSourcesPerResponse: number;
  };
  topics: Array<{ topic: string; count: number }>;
}

interface QuestionDetail {
  answer: string | null;
  has_error: boolean;
  is_unanswered: boolean;
  skip_reason: string | null;
  sources_count: number;
  related_questions_count: number;
  sources: Array<{ title?: string; uri: string }>;
  related_questions: string[];
  count: number;
  timestamps: string[];
  session_ids: string[];
  response_times: number[];
  first_seen: string;
  last_seen: string;
  avg_response_time: number | null;
}

// Cookie helpers
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie?.split(';') || [];
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [credentials, setCredentials] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetail[] | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const fetchData = async (user?: string, pass?: string, savedCreds?: string) => {
    try {
      setLoading(true);
      setError(null);

      const creds = savedCreds || (user && pass 
        ? btoa(`${user}:${pass}`)
        : credentials || btoa(`${username}:${password}`));

      const url = new URL('/api/analytics/data', window.location.origin);
      
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        url.searchParams.set('startDate', startDate.toISOString());
        url.searchParams.set('endDate', endDate.toISOString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${creds}`,
        },
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setCredentials(null);
        deleteCookie('analytics_auth');
        setError('Invalid credentials');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
      setAuthenticated(true);
      setCredentials(creds);
      
      // Save credentials to cookie for persistence
      setCookie('analytics_auth', creds, 7);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAuthenticated(false);
      setCredentials(null);
      deleteCookie('analytics_auth');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(username, password);
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setCredentials(null);
    setData(null);
    deleteCookie('analytics_auth');
  };

  const fetchQuestionDetails = async (question: string) => {
    try {
      setLoadingQuestion(true);
      setSelectedQuestion(question);
      setQuestionDetails(null);

      const creds = credentials || btoa(`${username}:${password}`);
      const url = new URL('/api/analytics/question', window.location.origin);
      url.searchParams.set('question', question);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${creds}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question details');
      }

      const result = await response.json();
      setQuestionDetails(result.instances);
    } catch (err) {
      console.error('Error fetching question details:', err);
      setQuestionDetails([]);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const closeModal = () => {
    setSelectedQuestion(null);
    setQuestionDetails(null);
  };

  // Check for saved credentials on mount
  useEffect(() => {
    const savedCreds = getCookie('analytics_auth');
    if (savedCreds) {
      fetchData(undefined, undefined, savedCreds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authenticated && credentials) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
            <p className="text-white/70">Sign in to view chatbot analytics</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white/90 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter username"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter password"
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Chatbot Analytics</h1>
          
          <div className="flex gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            
            <Button
              onClick={() => fetchData()}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              Refresh
            </Button>
            
            <Button
              onClick={handleLogout}
              className="bg-red-500/20 hover:bg-red-500/30 text-white border border-red-500/50"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Bot Loads</div>
            <div className="text-3xl font-bold text-white">{data?.summary.totalBotLoads.toLocaleString()}</div>
            <div className="text-white/50 text-xs mt-1">Total page impressions</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Interaction Rate</div>
            <div className="text-3xl font-bold text-white">{data?.summary.interactionRate.toFixed(1)}%</div>
            <div className="text-white/50 text-xs mt-1">{data?.summary.uniqueInteractingSessions} / {data?.summary.totalBotLoads} engaged</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Total Questions</div>
            <div className="text-3xl font-bold text-white">{data?.summary.totalInteractions.toLocaleString()}</div>
            <div className="text-white/50 text-xs mt-1">All interactions</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Avg Response Time</div>
            <div className="text-3xl font-bold text-white">{data?.summary.avgResponseTime.toFixed(0)}ms</div>
            <div className="text-white/50 text-xs mt-1">Performance metric</div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Error Rate</div>
            <div className="text-3xl font-bold text-white">{data?.summary.errorRate.toFixed(1)}%</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Avg Sources/Response</div>
            <div className="text-3xl font-bold text-white">{data?.summary.avgSourcesPerResponse.toFixed(1)}</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-white/70 text-sm font-medium mb-2">Unique Users</div>
            <div className="text-3xl font-bold text-white">{data?.summary.uniqueInteractingSessions.toLocaleString()}</div>
            <div className="text-white/50 text-xs mt-1">Who asked questions</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Questions */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Top Questions</h2>
            <div className="space-y-3">
              {data?.summary.topQuestions.length === 0 ? (
                <div className="text-white/60 text-center py-8">No questions yet</div>
              ) : (
                data?.summary.topQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => fetchQuestionDetails(q.question)}
                    className="w-full bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all cursor-pointer text-left"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-white/90 text-sm flex-1 hover:text-white">{q.question}</div>
                      <div className="text-purple-400 font-semibold ml-2">{q.count}</div>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                        style={{
                          width: `${(q.count / (data?.summary.topQuestions[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Topic Distribution */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Topic Distribution</h2>
            <div className="space-y-3">
              {data?.topics.length === 0 ? (
                <div className="text-white/60 text-center py-8">No data yet</div>
              ) : (
                data?.topics.map((topic, idx) => (
                  <div key={idx} className="bg-white/5 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-white/90 font-medium">{topic.topic}</div>
                      <div className="text-purple-400 font-semibold">{topic.count}</div>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                        style={{
                          width: `${(topic.count / (data?.topics[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Unanswered Questions Section */}
        {data?.summary.unansweredQuestions && data.summary.unansweredQuestions.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Out of Domain Questions
            </h2>
            <p className="text-white/60 text-sm mb-4">Questions that couldn&apos;t be answered (out of domain or no relevant results)</p>
            <div className="space-y-3">
              {data.summary.unansweredQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => fetchQuestionDetails(q.question)}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 rounded-lg p-3 transition-all cursor-pointer text-left"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-white/90 text-sm flex-1 hover:text-white">{q.question}</div>
                    <div className="text-yellow-400 font-semibold ml-2">{q.count}x</div>
                  </div>
                  <div className="text-white/50 text-xs mt-1">
                    Last asked: {new Date(q.timestamp).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Daily Engagement */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Daily Engagement</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left text-white/70 font-medium py-3 px-4">Date</th>
                  <th className="text-right text-white/70 font-medium py-3 px-4">Interactions</th>
                  <th className="text-right text-white/70 font-medium py-3 px-4">Unique Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data?.summary.dailyEngagement.map((day, idx) => (
                  <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                    <td className="text-white py-3 px-4">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="text-white text-right py-3 px-4">{day.interactions}</td>
                    <td className="text-white text-right py-3 px-4">{day.unique_sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Question Details Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-6 flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">Question Details</h3>
                <p className="text-white/90 text-base">{selectedQuestion}</p>
              </div>
              <button
                onClick={closeModal}
                className="ml-4 text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {loadingQuestion ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-white text-lg">Loading details...</div>
                </div>
              ) : questionDetails && questionDetails.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-white/70 text-sm font-medium mb-2">Unique Responses</div>
                    <div className="text-3xl font-bold text-white">{questionDetails.length}</div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white">All Response Variants ({questionDetails.length})</h4>
                    {questionDetails.map((detail, idx) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-3">
                        {/* Response Header */}
                        <div className="flex flex-wrap gap-3 items-center text-xs">
                          <span className="text-white font-semibold">
                            Given {detail.count}x
                          </span>
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            detail.has_error 
                              ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                              : detail.is_unanswered
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                              : 'bg-green-500/20 text-green-300 border border-green-500/50'
                          }`}>
                            {detail.has_error ? 'Error' : detail.is_unanswered ? 'Unanswered' : 'Answered'}
                          </span>
                          {detail.avg_response_time && (
                            <span className="text-white/60">
                              Avg: {detail.avg_response_time}ms
                            </span>
                          )}
                        </div>

                        {/* Timestamps */}
                        <div className="flex flex-wrap gap-2 text-xs text-white/50">
                          <span>First: {new Date(detail.first_seen).toLocaleString()}</span>
                          <span>•</span>
                          <span>Last: {new Date(detail.last_seen).toLocaleString()}</span>
                        </div>

                        {/* Answer or Skip Reason */}
                        {detail.is_unanswered && detail.skip_reason ? (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                            <div className="text-yellow-300 text-xs font-semibold uppercase mb-1">Skip Reason</div>
                            <div className="text-white/80 text-sm">{detail.skip_reason}</div>
                          </div>
                        ) : detail.answer ? (
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-white/70 text-xs font-semibold uppercase mb-2">Answer</div>
                            <div className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                              {detail.answer}
                            </div>
                          </div>
                        ) : (
                          <div className="text-white/50 text-sm italic">No answer recorded</div>
                        )}

                        {/* Sources */}
                        {detail.sources && detail.sources.length > 0 && (
                          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                            <div className="text-purple-300 text-xs font-semibold uppercase mb-2">
                              Sources ({detail.sources.length})
                            </div>
                            <div className="space-y-1.5">
                              {detail.sources.map((source, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={source.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-2 text-xs text-purple-200 hover:text-purple-100 hover:bg-purple-500/10 p-1.5 rounded transition-colors"
                                >
                                  <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span className="flex-1 break-words">{source.title || source.uri}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Questions */}
                        {detail.related_questions && detail.related_questions.length > 0 && (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                            <div className="text-blue-300 text-xs font-semibold uppercase mb-2">
                              Related Questions ({detail.related_questions.length})
                            </div>
                            <div className="space-y-1.5">
                              {detail.related_questions.map((rq, rqIdx) => (
                                <div key={rqIdx} className="text-xs text-blue-200 pl-3 border-l-2 border-blue-500/50">
                                  {rq}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Session IDs (collapsed, show count) */}
                        <details className="text-xs text-white/40">
                          <summary className="cursor-pointer hover:text-white/60">
                            {detail.count} session{detail.count > 1 ? 's' : ''} (click to expand)
                          </summary>
                          <div className="mt-2 space-y-1 pl-3">
                            {detail.session_ids.map((sid, sidIdx) => (
                              <div key={sidIdx}>
                                {sid} - {new Date(detail.timestamps[sidIdx]).toLocaleString()}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-white/60">No details found for this question</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4 flex justify-end">
              <Button
                onClick={closeModal}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

