/** Grille de radar décorative du bloc « Prochaine sortie ». */
export function Radar({ blips = 0 }: { blips?: number }) {
  const points = [
    [0.68, 0.3], [0.36, 0.62], [0.74, 0.7], [0.28, 0.34], [0.55, 0.82],
  ].slice(0, Math.min(blips, 5));
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="sweep" cx="0" cy="0" r="1">
          <stop offset="0" stopColor="var(--gold)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[90, 66, 42, 18].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--gold)" strokeOpacity={r === 90 ? 0.4 : 0.16} />
      ))}
      <path d="M100 10v180M10 100h180" stroke="var(--gold)" strokeOpacity=".14" />
      <g className="radar-sweep">
        <path d="M100 100 L100 10 A90 90 0 0 1 163.6 36.4 Z" fill="url(#sweep)" />
      </g>
      {points.map(([x, y], i) => (
        <circle key={i} cx={x * 200} cy={y * 200} r={i === 0 ? 5 : 3.5} fill="var(--orange)" fillOpacity={i === 0 ? 1 : 0.7} />
      ))}
    </svg>
  );
}
