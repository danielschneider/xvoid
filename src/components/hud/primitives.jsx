export function ActionButton({ icon: Icon, label, hint, onClick, disabled = false, active = false, kind = '', title }) {
  return (
    <button
      className={`action-button ${active ? 'is-active' : ''} ${kind}`}
      onClick={onClick}
      disabled={disabled}
      title={title || `${label}${hint ? ` · ${hint}` : ''}`}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}

export function HealthBar({ value, total, tone = 'mint' }) {
  return (
    <div className={`health-bar ${tone}`} aria-label={`${value} von ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < value ? 'filled' : ''} />
      ))}
    </div>
  );
}
