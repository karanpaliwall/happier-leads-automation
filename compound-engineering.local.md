---
review_agents:
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:code-simplicity-reviewer
  - compound-engineering:review:pattern-recognition-specialist
---

## Review Context

Next.js 16 App Router project (JavaScript, no TypeScript). Single-developer internal tool.
Stack: Next.js, Neon PostgreSQL (tagged-template SQL, no ORM), pure CSS (no Tailwind).
No test suite. Deployed to Vercel. Auth is a simple session cookie (password gate).
DB client: `src/lib/db.js` exports a single `sql` tagged-template function.
