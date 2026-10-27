import { ChevronDown, Radio } from 'lucide-react';
import { selectEnemyCounts } from '../../selectors/hud.js';
import { COPY } from '../copy.js';

export function MissionPanel({ state, open, onToggle }) {
  const { eliminated, total } = selectEnemyCounts(state);
  return (
    <aside className={`left-rail ${open ? '' : 'is-collapsed'}`}>
      <button className="mission-toggle" aria-expanded={open} aria-controls="mission-status-body" onClick={onToggle}>
        <span className="mission-label">
          <Radio size={13} />
          <span>{COPY.mission.title}</span>
        </span>
        <ChevronDown size={14} className="stack-chevron" />
      </button>
      <div id="mission-status-body" className="mission-body">
        <p className="mission-objective">{COPY.mission.objective}</p>
        <div className="objective-meter">
          <i style={{ width: `${(eliminated / total) * 100}%` }} />
        </div>
        <div className="objective-count">
          <span>{COPY.mission.eliminated}</span>
          <b>
            {eliminated} / {total}
          </b>
        </div>
      </div>
    </aside>
  );
}
