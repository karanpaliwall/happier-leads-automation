import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
export default sql;

export async function withRetry(fn, retries = 2, baseDelayMs = 600) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
}
