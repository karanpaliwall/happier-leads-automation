'use client';

const STEPS = [
  {
    num: '1',
    title: 'Start your local tunnel',
    body: 'Open a terminal and run:',
    code: 'ngrok http 3000',
    note: 'This gives you a public URL like https://abc123.ngrok-free.app',
  },
  {
    num: '2',
    title: 'Paste the URL into Happier Leads',
    body: 'Go to admin.happierleads.com → Automations → open your automation → edit the Webhook action → paste:',
    code: 'https://<your-ngrok-url>/api/webhook/happierleads',
    note: null,
  },
  {
    num: '3',
    title: 'Activate the automation',
    body: 'Set the segment to "All Leads" to capture both Exact and Suggested visitors, then click Activate.',
    code: null,
    note: 'The automation must be Active (not Paused) for webhooks to fire.',
  },
  {
    num: '4',
    title: 'Wait for the first visitor',
    body: 'Browse your website from a different network or device. Happier Leads will identify the visitor and fire the webhook here within seconds.',
    code: null,
    note: null,
  },
];

export default function EmptyState() {
  return (
    <div className="empty-onboarding">
      <div className="empty-onboarding-hero">
        <div className="empty-onboarding-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2 className="empty-onboarding-title">No leads yet</h2>
        <p className="empty-onboarding-sub">
          Your pipeline is ready. Complete these steps to start capturing visitors from Happier Leads.
        </p>
      </div>

      <div className="empty-steps">
        {STEPS.map((step) => (
          <div key={step.num} className="empty-step">
            <div className="empty-step-num">{step.num}</div>
            <div className="empty-step-body">
              <div className="empty-step-title">{step.title}</div>
              <div className="empty-step-desc">{step.body}</div>
              {step.code && (
                <div className="empty-step-code">{step.code}</div>
              )}
              {step.note && (
                <div className="empty-step-note">{step.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="empty-onboarding-footer">
        <span className="dot-green" style={{ marginRight: 8 }} />
        Webhook endpoint is live and waiting at
        <code style={{ marginLeft: 6, color: 'var(--blue-400)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          /api/webhook/happierleads
        </code>
      </div>
    </div>
  );
}
