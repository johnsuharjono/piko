import type { Transition } from "../simulation/machine";
export function Trace({
  time,
  transitions,
  pin = 13,
}: {
  pin?: number;
  time: number;
  transitions: Transition[];
}) {
  const duration = 4000;
  const start = Math.max(0, time - duration);
  const end = start + duration;
  const x = (t: number) => 60 + ((t - start) / duration) * 840;
  const y = (high: boolean) => (high ? 28 : 84);
  let state = false;
  for (const event of transitions) {
    if (event.time <= start) state = event.high;
    else break;
  }
  let path = `M60 ${y(state)}`;
  for (const event of transitions) {
    if (event.time <= start || event.time > end) continue;
    path += ` H${x(event.time)} V${y(event.high)}`;
  }
  path += ` H${x(Math.max(start, Math.min(time, end)))}`;
  return (
    <svg
      viewBox="0 0 930 124"
      className="trace-svg"
      role="img"
      aria-label={`${pin < 14 ? `D${pin}` : `A${pin - 14}`} digital state over the last four seconds. Simulation time ${(time / 1000).toFixed(2)} seconds.`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path
            d={`M${60 + i * 210} 15V94`}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
          <text x={60 + i * 210} y="116" textAnchor="middle">
            {((start + i * 1000) / 1000).toFixed(1)} s
          </text>
        </g>
      ))}
      <path d="M60 28H900 M60 84H900" stroke="var(--border)" />
      <text x="0" y="32">
        HIGH
      </text>
      <text x="0" y="88">
        LOW
      </text>
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {time > 0 && (
        <>
          <path d={`M${x(time)} 15V94`} stroke="var(--muted)" strokeWidth="1" />
          <circle cx={x(time)} cy="15" r="3" fill="var(--muted)" />
        </>
      )}
    </svg>
  );
}
