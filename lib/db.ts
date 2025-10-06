import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Serverless-friendly settings
      max: 1, // Limit connections in serverless environment
      idleTimeoutMillis: 10000, // Close idle connections after 10s
      connectionTimeoutMillis: 10000, // Timeout after 10s
      allowExitOnIdle: true, // Allow process to exit when idle
    };
    
    pool = new Pool(config);
    
    // Handle connection errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
      pool = null; // Reset pool on error
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const currentPool = getPool();
  try {
    return await currentPool.query(text, params);
  } catch (error) {
    // Reset pool on connection errors
    if (error instanceof Error && 
        (error.message.includes('ECONNRESET') || 
         error.message.includes('Connection terminated') ||
         error.message.includes('socket disconnected'))) {
      console.error('Database connection error, resetting pool:', error.message);
      pool = null; // Reset the module-level pool
    }
    throw error;
  }
}

