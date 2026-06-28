function ChatWidget({ isOpen, race, messages, loading, inputValue, onToggle, onClose, onInputChange, onSend }) {
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, fontFamily: "'VT323', monospace" }}>
      {isOpen && (
        <div style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '3px solid var(--green)',
          marginBottom: '0.5rem',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg)',
            borderBottom: '2px solid var(--green)',
            padding: '0.5rem 0.75rem',
          }}>
            <span style={{ color: 'var(--green)', fontSize: '0.95rem' }}>
              {race ? race.raceName.toUpperCase() : 'AI HIGHLIGHTS'}
            </span>
            <span style={{ cursor: 'pointer', color: 'var(--white)' }} onClick={onClose}>X</span>
          </div>

          <div style={{ overflowY: 'auto', padding: '0.75rem', maxHeight: '280px' }}>
            {!race && <p style={{ color: 'var(--muted)' }}>Click "GET AI HIGHLIGHTS" on a race to start.</p>}
            {messages.slice(1).map((m, i) => (
              i === 0 ? (
                <p key={i} style={{ fontStyle: 'italic', color: 'var(--green)' }}>{m.text}</p>
              ) : (
                <p key={i} style={{ color: m.role === 'user' ? 'var(--white)' : 'var(--green)', margin: '6px 0' }}>
                  <strong>{m.role === 'user' ? 'YOU: ' : 'AI: '}</strong>{m.text}
                </p>
              )
            ))}
            {loading && <p style={{ color: 'var(--muted)' }}>Thinking...</p>}
          </div>

          {race && (
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', borderTop: '2px solid var(--green)' }}>
              <input
                type="text"
                value={inputValue}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSend(); }}
                placeholder="Ask a follow-up..."
                style={{ flex: 1, background: 'var(--bg)', color: 'var(--white)', border: '2px solid var(--white)', padding: '4px 8px', fontFamily: "'VT323', monospace" }}
              />
              <button className="pixel-btn" onClick={onSend}>SEND</button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onToggle}
        aria-label="Toggle AI highlights chat"
        style={{
          width: '56px',
          height: '56px',
          border: '3px solid var(--green)',
          background: 'var(--bg)',
          color: 'var(--green)',
          fontSize: '1.2rem',
          cursor: 'pointer',
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        AI
      </button>
    </div>
  );
}

export default ChatWidget;