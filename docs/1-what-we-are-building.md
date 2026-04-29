# What We Are Building

## The Problem

Happier Leads identifies people who visit your website — it shows their name, company, and engagement scores. But the data is locked inside their platform. You can't easily build automated outreach on top of it, and you don't own the data.

## The Solution

A custom pipeline that captures every new website visitor lead and puts it into a system you control:

1. **Capture** — When Happier Leads identifies a visitor, it fires a webhook to our system
2. **Deduplicate** — We check if we've seen this person before; if yes, skip. If no, save.
3. **Store** — New leads go into our own database (Neon PostgreSQL)
4. **Display** — A custom dashboard lets you view all leads with scores and filters
5. **Push** — A button sends selected leads directly to a HeyReach campaign for LinkedIn outreach
6. **Campaign analytics** — Both HeyReach and SmartLead campaigns are tracked on dedicated pages with live stats

## Live Production URL

**`https://websitevisitors.growleads.io`** (custom domain, deployed on Vercel)

Vercel alias also works: `https://happier-leads-automation.vercel.app`

## Dashboard Pages

- **Overview** (`/`) — Live stat cards (Total, New Today, Exact, Suggested), analytics chart with date-range filter and period comparison, pipeline status
- **Leads** (`/leads`) — Full leads table with search, type tabs, date filters, click-to-expand detail rows, Export CSV, Push to HeyReach per-lead
- **SmartLead Campaigns** (`/campaigns`) — Live email campaign analytics pulled from SmartLead API (DB-persisted campaign IDs)
- **HeyReach Campaigns** (`/heyreach/campaigns`) — Live LinkedIn campaign stats pulled from HeyReach API (DB-persisted campaign IDs)
- **Login** (`/login`) — Password gate

## What This Is NOT

- Not a replacement for Happier Leads' identification engine — we still use them to identify visitors
- Not an email sender — we capture leads, SmartLead handles email outreach, HeyReach handles LinkedIn
- Not a CRM — it's a pipeline between Happier Leads, SmartLead, and HeyReach
