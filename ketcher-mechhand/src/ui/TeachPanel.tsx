/**
 * Teach mode: record your own handwriting. Letters and signs are added to the $P
 * symbol model; arrows, bonds and electrons are checked against the recognizer
 * and (arrowheads, dot size) adapt it — see recognition/elements.ts. Samples are
 * stored in this browser, used immediately, and can be exported to be contributed
 * to the shared model (src/recognition/model/contrib/).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SymbolSample } from '../recognition/dollarP';
import {
  ELEMENTS, ELEMENT_GROUPS, type ElementGroup, type ElementId, type ElementSample, TEACH_BOND_PX,
  checkElement, cleanElementSamples,
} from '../recognition/elements';
import type { Pt } from '../recognition/geometry';
import { MODEL_SYMBOLS, type SymbolModel, cleanSymbolSamples } from '../recognition/model';
import { recognizeSketch, withoutEnclosingCircle } from '../recognition/sketch';
import { StylusManager } from '../ink/StylusManager';
import { loadPenSettings } from '../ink/pen';
import { Modal, btn } from './Modal';

const LABEL: Record<string, string> = { '-': '− (minus)', '+': '+ (plus)', I: 'I / l', r: 'r', i: 'i', t: 't', a: 'a' };
/** Circled charges are taught as their sign (the recognizer ignores the circle). */
const CIRCLED: Record<string, string> = { '⊕': '+', '⊖': '-' };
const LETTER_OPTIONS = [...MODEL_SYMBOLS, ...Object.keys(CIRCLED)];

type Tab = 'letters' | ElementGroup;

const LEARNS: Record<string, string> = {
  arrowheads: 'Heads drawn with a separate stroke are added to the arrowhead model, so your style of head is recognized from now on.',
  dots: 'The size of your dots sets how large a dot may be (lone pairs, radicals).',
  check: 'Bonds are recognized by geometry: this checks that your style is read correctly; shared samples help improve the rules.',
};

export function TeachPanel({ samples, elements, model, onChange, onElements, onClose }: {
  samples: SymbolSample[];
  elements: ElementSample[];
  model: SymbolModel;
  onChange: (s: SymbolSample[]) => void;
  onElements: (e: ElementSample[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('letters');
  const [symbol, setSymbol] = useState('O');
  const [element, setElement] = useState<ElementId>('arrow-pair');
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  /** The stroke being drawn (shown live, also for click – move – click trackpad strokes). */
  const [live, setLive] = useState<Pt[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isLetters = tab === 'letters';
  const info = ELEMENTS.find((e) => e.id === element)!;
  const size = isLetters ? { w: 220, h: 220 } : { w: 380, h: 260 };

  useEffect(() => {
    const svg = svgRef.current!;
    const sm = new StylusManager(svg, {
      onStart: (_id, p) => setLive([{ x: p.x, y: p.y }]),
      onMove: (_id, pts) => setLive(pts.map(({ x, y }) => ({ x, y }))),
      onCancel: () => setLive(null),
      onEnd: (_id, pts, info) => {
        setLive(null);
        // The pen's eraser end removes the last stroke instead of drawing.
        if (info.eraser) setStrokes((s) => s.slice(0, -1));
        else setStrokes((s) => [...s, pts.map(({ x, y }) => ({ x, y }))]);
      },
    }, { mode: loadPenSettings().input });
    sm.attach();
    return () => sm.detach();
  }, [tab]);

  const choose = (t: Tab) => {
    setTab(t);
    setStrokes([]);
    if (t !== 'letters' && info.group !== t) setElement(ELEMENTS.find((e) => e.group === t)!.id);
  };

  // What MecHand reads right now (with the samples saved so far).
  const reading = useMemo(() => {
    if (strokes.length === 0) return null;
    if (isLetters) {
      const best = model.recognizer.classify(withoutEnclosingCircle(strokes), 1)[0];
      const want = CIRCLED[symbol] ?? symbol;
      return { ok: best?.symbol === want, read: best ? (LABEL[best.symbol] ?? best.symbol) : '?' };
    }
    const r = recognizeSketch(strokes.map((points) => ({ points })), model.recognizer, {
      bondPx: TEACH_BOND_PX, heads: model.heads, style: model.style,
    });
    return checkElement(element, r);
  }, [strokes, isLetters, symbol, element, model]);

  const save = () => {
    if (strokes.length === 0) return;
    if (isLetters) onChange([...samples, { symbol: CIRCLED[symbol] ?? symbol, strokes: withoutEnclosingCircle(strokes) }]);
    else onElements([...elements, { element, bondPx: TEACH_BOND_PX, strokes }]);
    setStrokes([]);
  };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ samples, elements }, null, 1)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'mechand-samples.json' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { samples?: unknown; elements?: unknown };
      const s = cleanSymbolSamples(parsed.samples), e = cleanElementSamples(parsed.elements);
      if (!s.length && !e.length) throw new Error('empty');
      if (s.length) onChange([...samples, ...s]);
      if (e.length) onElements([...elements, ...e]);
    } catch {
      alert('Not a MecHand samples file.');
    }
  };

  const letterCounts = LETTER_OPTIONS.filter((s) => !CIRCLED[s]).map((s) => [LABEL[s] ?? s, samples.filter((x) => x.symbol === s).length] as const);
  const elementCounts = ELEMENTS.filter((e) => e.group === tab).map((e) => [e.label, elements.filter((x) => x.element === e.id).length] as const);
  const tabStyle = (t: Tab) => ({
    ...btn(tab === t ? '#1d4ed8' : '#f3f4f6', tab === t ? '#fff' : '#374151'), padding: '5px 12px',
  });

  return (
    <Modal title="Teach MecHand your handwriting" onClose={onClose} width={isLetters ? 640 : 780} testId="mechand-teach">
      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button role="tab" aria-selected={isLetters} style={tabStyle('letters')} onClick={() => choose('letters')}>Letters &amp; signs</button>
        {ELEMENT_GROUPS.map((g) => (
          <button key={g.id} role="tab" aria-selected={tab === g.id} style={tabStyle(g.id)} onClick={() => choose(g.id)}>{g.label}</button>
        ))}
      </div>
      <p style={{ fontSize: 13, margin: '0 0 8px' }}>
        {isLetters
          ? 'Pick a symbol, write it in the box, and save. A few samples per symbol make a difference.'
          : info.prompt}{' '}
        Samples stay in this browser; export them to share with the project.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          {isLetters ? (
            <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setStrokes([]); }} style={{ fontSize: 14, marginBottom: 6 }}>
              {LETTER_OPTIONS.map((s) => <option key={s} value={s}>{CIRCLED[s] ? `${s} (circled charge)` : (LABEL[s] ?? s)}</option>)}
            </select>
          ) : (
            <select value={element} onChange={(e) => { setElement(e.target.value as ElementId); setStrokes([]); }} style={{ fontSize: 14, marginBottom: 6 }}>
              {ELEMENTS.filter((e) => e.group === tab).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          )}
          <svg ref={svgRef} width={size.w} height={size.h} data-testid="mechand-teach-box"
            style={{ display: 'block', border: '1px dashed #9ca3af', borderRadius: 8, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}>
            {!isLetters && info.guide === 'bond' && (
              <g pointerEvents="none">
                <line x1={16} y1={size.h - 18} x2={16 + TEACH_BOND_PX} y2={size.h - 18} stroke="#d1d5db" strokeWidth={4} strokeLinecap="round" />
                <text x={22 + TEACH_BOND_PX} y={size.h - 14} fontSize={11} fill="#9ca3af">= 1 bond</text>
              </g>
            )}
            {!isLetters && info.guide === 'letter' && (
              <text x={size.w / 2 - 12} y={size.h / 2 + 10} fontSize={Math.round(0.5 * TEACH_BOND_PX)} fill="#d1d5db" pointerEvents="none"
                style={{ userSelect: 'none' }}>O</text>
            )}
            {[...strokes, ...(live ? [live] : [])].map((s, i) => (
              <polyline key={i} points={(s.length > 1 ? s : [s[0], { x: s[0].x + 0.5, y: s[0].y }]).map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="#111827" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={btn('#f3f4f6', '#374151')} onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>Undo stroke</button>
            <button style={btn('#f3f4f6', '#374151')} onClick={() => setStrokes([])}>Clear</button>
            <button style={btn('#16a34a', '#fff')} onClick={save} disabled={!strokes.length}>Save sample</button>
          </div>
          {reading && (
            <div style={{ fontSize: 12, color: reading.ok ? '#15803d' : '#b45309', marginTop: 4, maxWidth: size.w }} data-testid="mechand-teach-reading">
              Currently read as: <b>{reading.read}</b> {reading.ok ? '✓' : '— saving this sample helps MecHand learn it'}
            </div>
          )}
        </div>
        <div style={{ flex: 1, fontSize: 13 }}>
          {!isLetters && <p style={{ fontSize: 12, color: '#4b5563', marginTop: 0 }}>{LEARNS[info.learns]}</p>}
          <b>Your samples</b>
          <table style={{ fontSize: 12, marginTop: 4 }}>
            <tbody>
              {(isLetters ? letterCounts : elementCounts).map(([s, c]) => (
                <tr key={s}><td style={{ paddingRight: 10 }}>{s}</td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button style={btn('#f3f4f6', '#374151')} onClick={exportJson} disabled={!samples.length && !elements.length}>Export samples</button>
            <label style={{ ...btn('#f3f4f6', '#374151'), display: 'inline-block' }}>
              Import…
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </label>
            <button style={btn('#fef2f2', '#b91c1c')}
              onClick={() => { if (confirm('Delete all your samples (letters, arrows, bonds and electrons)?')) { onChange([]); onElements([]); } }}
              disabled={!samples.length && !elements.length}>
              Delete all
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
