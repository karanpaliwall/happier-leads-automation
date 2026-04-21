# What We Are Building

## The Problem

Happier Leads identifies people who visit your website — it shows their name, company, and engagement scores. But the data is locked inside their platform. You can't easily build automated outreach on top of it, and you don't own the data.

## The Solution

A custom pipeline that captures every new website visitor lead and puts it into a system you control:

1. **Capture** — When Happier Leads identifies a visitor, it fires a webhook to our system
2. **Deduplicate** — We check if we've seen this person before; if yes, skip. If no, save.
3. **Store** — New leads go into our own database (Neon PostgreSQL)
4. **Display** — A custom dashboard lets you view all leads with scores and filters
5. **Push** *(Phase 2)* — A button sends leads to Smart Lead for outreach automation

## End State

A dashboard at `localhost:3000` (later `yourapp.vercel.app`) that shows:
- All new website visitors captured in real-time
- Their name, company, lead type (Exact or Suggested), Fit Score, Engagement Score
- Filters by type and search by name/company
- Stat cards: Total leads, New today, Exact, Suggested
- A "Push to Smart Lead" button per lead (Phase 2)

## What This Is NOT

- Not a replacement for Happier Leads' identification engine — we still use them to identify visitors
- Not an email sender — we capture leads, Smart Lead handles outreach
- Not a CRM — it's a pipeline between Happier Leads and Smart Lead
