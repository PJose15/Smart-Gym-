export default function DashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#1a1a2e' }}>
        Dashboard
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Overview of gym operations, usage statistics, and key metrics.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 20,
        }}
      >
        {[
          { title: 'Total Machines', value: '--' },
          { title: 'Active Programs', value: '--' },
          { title: 'Members', value: '--' },
          { title: 'Sessions Today', value: '--' },
        ].map((card) => (
          <div
            key={card.title}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 8,
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {card.title}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, color: '#1a1a2e' }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
