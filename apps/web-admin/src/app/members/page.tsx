export default function MembersPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#1a1a2e' }}>
        Members
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        View and manage gym members, track membership status, and review activity history.
      </p>
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <p style={{ color: '#999', fontSize: 15 }}>
          Member list will be displayed here. Connect to Supabase to load data.
        </p>
      </div>
    </div>
  );
}
