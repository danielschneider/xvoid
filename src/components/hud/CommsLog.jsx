import { COPY } from '../copy.js';

export function CommsLog({ entries }) {
  return (
    <section className="battle-log">
      <div className="log-heading">
        <span>{COPY.log.title}</span>
        <span className="log-live">{COPY.log.live}</span>
      </div>
      {entries.slice(0, 3).map((entry) => (
        <p key={entry.id} className={`log-entry ${entry.kind}`}>
          <i />
          {entry.text}
        </p>
      ))}
    </section>
  );
}
