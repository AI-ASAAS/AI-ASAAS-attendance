if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
}
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 35,                     // Sized for concurrent workforce load (up to 35 connections)
  min: 2,                      // Maintain at least 2 persistent warm connections
  idleTimeoutMillis: 60000,    // Recycle idle connections after 60s
  connectionTimeoutMillis: 15000 // Allow up to 15s to establish/acquire connection under load
});

// Guard against idle connection drops crashing the process
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Warning]:', err.message);
});

async function query(sql, args, retries = 2) {
  let attempt = 0;
  while (true) {
    try {
      return await pool.query(sql, args);
    } catch (err) {
      const isTransient = err.code === 'ECONNRESET' ||
                          err.code === 'ECONNREFUSED' ||
                          err.code === '57P01' || // PostgreSQL admin shutdown/restart
                          err.code === '57P03' || // PostgreSQL cannot connect now
                          err.message?.includes('Connection terminated') ||
                          err.message?.includes('timeout exceeded') ||
                          err.message?.includes('connection timeout');
      if (isTransient && attempt < retries) {
        attempt++;
        console.warn(`[DB Pool Warning] Re-attempting query (${attempt}/${retries}) due to: ${err.message}`);
        await new Promise(res => setTimeout(res, 350 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function transaction(work, retries = 1) {
  let attempt = 0;
  while (true) {
    let client = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      const isTransient = error.code === 'ECONNRESET' ||
                          error.code === '57P01' ||
                          error.message?.includes('Connection terminated') ||
                          error.message?.includes('timeout exceeded');
      if (isTransient && attempt < retries) {
        attempt++;
        await new Promise(res => setTimeout(res, 400 * attempt));
        continue;
      }
      throw error;
    } finally {
      if (client) client.release();
    }
  }
}

module.exports = {
  query,
  pool,
  transaction
};
