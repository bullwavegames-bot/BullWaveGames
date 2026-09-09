import { SAMPLE_ACTIVITY } from "../data/activity";

export function ActivityTicker({ paused }: { paused: boolean }) {
  const loop = [...SAMPLE_ACTIVITY, ...SAMPLE_ACTIVITY];
  return (
    <div className={`activity-ticker ${paused ? "is-paused" : ""}`} aria-label="Sample studio activity">
      <span className="activity-kicker">Live in the studio</span>
      <div className="activity-track-wrap">
        <ul className="activity-track">
          {loop.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <strong>{item.name}</strong> {item.text}
            </li>
          ))}
        </ul>
      </div>
      <span className="activity-note">Sample activity — not live player data</span>
    </div>
  );
}
