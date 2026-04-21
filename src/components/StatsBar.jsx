export default function StatsBar({ stats }) {
  const cards = [
    { label: 'Total Leads',     value: stats.total,     color: 'var(--text-primary)' },
    { label: 'New Today',       value: stats.newToday,  color: 'var(--blue-400)' },
    { label: 'Exact Leads',     value: stats.exact,     color: 'var(--green-400)' },
    { label: 'Suggested Leads', value: stats.suggested, color: 'var(--orange-400)' },
  ];

  return (
    <div className="stat-grid">
      {cards.map(card => (
        <div key={card.label} className="stat-card">
          <div className="stat-label">{card.label}</div>
          <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
