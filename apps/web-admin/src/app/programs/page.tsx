export default function ProgramsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 8, color: '#1a1a2e' }}>
        Programs
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Create and manage workout programs, assign exercises, and set training schedules.
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
          Program list will be displayed here. Connect to Supabase to load data.
        </p>
      </div>
    </div>
  );
}
