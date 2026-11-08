/** Minimal SVG rendering of a Scene (used to preview what was recognized). */

import type { Scene } from '../scene/types';

export function ScenePreview({ scene, width = 300, height = 190 }: { scene: Scene; width?: number; height?: number }) {
  const pts = [
    ...scene.atoms,
    ...scene.pluses,
    ...scene.arrows.flatMap((a) => [a.start, a.end]),
  ];
  if (pts.length === 0) {
    return <div style={{ width, height, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 13 }}>Nothing recognized</div>;
  }
  const minX = Math.min(...pts.map((p) => p.x)) - 0.6, maxX = Math.max(...pts.map((p) => p.x)) + 0.6;
  const minY = Math.min(...pts.map((p) => p.y)) - 0.8, maxY = Math.max(...pts.map((p) => p.y)) + 0.8;
  const s = Math.min(width / (maxX - minX), height / (maxY - minY), 60);
  const ox = (width - (maxX - minX) * s) / 2, oy = (height - (maxY - minY) * s) / 2;
  const X = (x: number) => ox + (x - minX) * s;
  const Y = (y: number) => oy + (maxY - y) * s; // y up → screen
  const labelled = (i: number) => scene.atoms[i].symbol !== 'C' || scene.atoms[i].charge !== 0;

  return (
    <svg width={width} height={height} role="img" aria-label="Recognized structure">
      <defs>
        <marker id="mh-full" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9" fill="none" stroke="#dc2626" strokeWidth="1.6" />
        </marker>
        <marker id="mh-half" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5" fill="none" stroke="#dc2626" strokeWidth="1.6" />
        </marker>
      </defs>
      {scene.bonds.map((b, i) => {
        const a = scene.atoms[b.begin], c = scene.atoms[b.end];
        let x1 = X(a.x), y1 = Y(a.y), x2 = X(c.x), y2 = Y(c.y);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const trim = 0.28 * s;
        if (labelled(b.begin)) { x1 += ux * trim; y1 += uy * trim; }
        if (labelled(b.end)) { x2 -= ux * trim; y2 -= uy * trim; }
        const off = b.order === 1 ? [0] : b.order === 3 ? [-0.12, 0, 0.12] : [-0.07, 0.07];
        return off.map((o, k) => (
          <line key={`${i}-${k}`} x1={x1 - uy * o * s} y1={y1 + ux * o * s} x2={x2 - uy * o * s} y2={y2 + ux * o * s}
            stroke="#111827" strokeWidth={1.6} strokeDasharray={b.order === 4 && k === 1 ? '3 2' : undefined} />
        ));
      })}
      {scene.atoms.map((a, i) =>
        labelled(i) ? (
          <text key={i} x={X(a.x)} y={Y(a.y)} textAnchor="middle" dominantBaseline="central" fontSize={0.42 * s} fontFamily="system-ui, sans-serif">
            {a.symbol === 'C' && a.charge !== 0 ? '' : a.symbol}
            {a.charge !== 0 && (
              <tspan dy={-0.18 * s} fontSize={0.3 * s}>{Math.abs(a.charge) > 1 ? Math.abs(a.charge) : ''}{a.charge > 0 ? '+' : '−'}</tspan>
            )}
          </text>
        ) : null,
      )}
      {scene.atoms.map((a, i) => (a.radical === 2 ? <circle key={`r${i}`} cx={X(a.x)} cy={Y(a.y) - 0.3 * s} r={2} fill="#111827" /> : null))}
      {scene.pluses.map((p, i) => (
        <text key={`p${i}`} x={X(p.x)} y={Y(p.y)} textAnchor="middle" dominantBaseline="central" fontSize={0.5 * s}>+</text>
      ))}
      {scene.arrows.map((a, i) => {
        const sx = X(a.start.x), sy = Y(a.start.y), ex = X(a.end.x), ey = Y(a.end.y);
        if (a.height === undefined || a.kind === 'reaction' || a.kind === 'equilibrium') {
          return <line key={`a${i}`} x1={sx} y1={sy} x2={ex} y2={ey} stroke="#dc2626" strokeWidth={1.6} markerEnd="url(#mh-full)" />;
        }
        // Left normal in y-up units → screen: (dy_up, dx_up) → (−(ey−sy), …); compute in units.
        const dx = a.end.x - a.start.x, dy = a.end.y - a.start.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const h = a.height * (4 / 3);
        const c1 = { x: X(a.start.x + nx * h), y: Y(a.start.y + ny * h) };
        const c2 = { x: X(a.end.x + nx * h), y: Y(a.end.y + ny * h) };
        return (
          <path key={`a${i}`} d={`M${sx},${sy} C${c1.x},${c1.y} ${c2.x},${c2.y} ${ex},${ey}`} fill="none" stroke="#dc2626"
            strokeWidth={1.6} markerEnd={a.kind === 'single-electron' ? 'url(#mh-half)' : 'url(#mh-full)'} />
        );
      })}
    </svg>
  );
}
