/**
 * Teach mode: record your own handwriting samples. They are stored in this
 * browser, used immediately by the recognizer, and can be exported to be
 * contributed to the shared model (src/recognition/model/contrib/).
 */

import { useEffect, useRef, useState } from 'react';
import type { SymbolSample } from '../recognition/dollarP';
import type { Pt } from '../recognition/geometry';
import { MODEL_SYMBOLS } from '../recognition/model';
import { StylusManager } from '../ink/StylusManager';
import { Modal, btn } from './Modal';

const LABEL: Record<string, string> = { '-': '− (minus)', '+': '+ (plus)', I: 'I / l', r: 'r', i: 'i', t: 't', a: 'a' };

export function TeachPanel({ samples, onChange, onClose, classify }: {
  samples: SymbolSample[];
  onChange: (s: SymbolSample[]) => void;
  onClose: () => void;
  classify: (strokes: Pt[][]) => string;
}) {
  const [symbol, setSymbol] = useState('O');
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const sm = new StylusManager(svg, {
      onEnd: (_id, pts) => setStrokes((s) => [...s, pts.map(({ x, y }) => ({ x, y }))]),
    });
    sm.attach();
    return () => sm.detach();
  }, []);

  const save = () => {
    if (strokes.length === 0) return;
    onChange([...samples, { symbol, strokes }]);
    setStrokes([]);
  };
  const counts = MODEL_SYMBOLS.map((s) => [s, samples.filter((x) => x.symbol === s).length] as const);
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ samples }, null, 1)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'mechand-samples.json' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { samples?: SymbolSample[] };
      if (Array.isArray(parsed.samples)) onChange([...samples, ...parsed.samples]);
    } catch {
      alert('Not a MecHand samples file.');
    }
  };

  return (
    <Modal title="Teach MecHand your handwriting" onClose={onClose} width={640} testId="mechand-teach">
      <p style={{ fontSize: 13, margin: '0 0 8px' }}>
        Pick a symbol, write it in the box, and save. A few samples per symbol make a difference.
        Samples stay in this browser; export them to share with the project.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ fontSize: 14, marginBottom: 6 }}>
            {MODEL_SYMBOLS.map((s) => <option key={s} value={s}>{LABEL[s] ?? s}</option>)}
          </select>
          <svg ref={svgRef} width={220} height={220}
            style={{ display: 'block', border: '1px dashed #9ca3af', borderRadius: 8, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}>
            {strokes.map((s, i) => (
              <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#111827" strokeWidth={3} strokeLinecap="round" />
            ))}
          </svg>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={btn('#f3f4f6', '#374151')} onClick={() => setStrokes([])}>Clear</button>
            <button style={btn('#16a34a', '#fff')} onClick={save} disabled={!strokes.length}>Save sample</button>
          </div>
          {strokes.length > 0 && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Currently read as: <b>{classify(strokes)}</b></div>}
        </div>
        <div style={{ flex: 1, fontSize: 13 }}>
          <b>Your samples</b>
          <table style={{ fontSize: 12, marginTop: 4 }}>
            <tbody>
              {counts.map(([s, c]) => (
                <tr key={s}><td style={{ paddingRight: 10 }}>{LABEL[s] ?? s}</td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button style={btn('#f3f4f6', '#374151')} onClick={exportJson} disabled={!samples.length}>Export samples</button>
            <label style={{ ...btn('#f3f4f6', '#374151'), display: 'inline-block' }}>
              Import…
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </label>
            <button style={btn('#fef2f2', '#b91c1c')} onClick={() => confirm('Delete all your samples?') && onChange([])} disabled={!samples.length}>
              Delete all
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
