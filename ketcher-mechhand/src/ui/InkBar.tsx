/**
 * The pen toolbar (second row, shown in freehand mode): pen or eraser, ink
 * colour, kind of line, width, input mode (palm rejection, trackpad), and which
 * input device the last contact came from.
 */

import { useEffect, useRef } from 'react';
import {
  INPUT_MODES, type InkTool, type InputMode, PEN_COLOURS, PEN_STYLES, PEN_WIDTHS, type PenSettings, previewStroke, renderInk,
} from '../ink/pen';
import { HelpTip } from './HelpSystem';
import { AutoIcon, EraserIcon, MouseIcon, PalmOffIcon, PenIcon, TouchIcon, TrackpadIcon } from './icons';
import { ToolButton, barStyle, toolButtonStyle } from './MecHandBar';

export interface LastInput {
  type: string;
  accepted: boolean;
  /** Increases with every contact, so the chip can flash. */
  n: number;
}

const INPUT_ICON: Record<InputMode, typeof AutoIcon> = { auto: AutoIcon, pen: PalmOffIcon, touch: TouchIcon, trackpad: TrackpadIcon };
const DEVICE: Record<string, { icon: typeof AutoIcon; name: string }> = {
  pen: { icon: PenIcon, name: 'Pen' },
  touch: { icon: TouchIcon, name: 'Finger' },
  mouse: { icon: MouseIcon, name: 'Mouse / trackpad' },
};

const group = { display: 'inline-flex', alignItems: 'center', gap: 3 } as const;
const caption = { fontSize: 11, color: '#6b7280', marginRight: 2 } as const;
const divider = <span style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 5px' }} />;

/** A little SVG showing what a pen draws (uses the real ink renderer). */
function PenPreview({ pen, width = 36, height = 16 }: { pen: PenSettings; width?: number; height?: number }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    if (ref.current) renderInk(ref.current, previewStroke(width, height), { ...pen, width: Math.min(pen.width, 4) });
  }, [pen, width, height]);
  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block' }}>
      <g ref={ref} />
    </svg>
  );
}

export function InkBar({ pen, tool, lastInput, openStroke, onPen, onTool }: {
  pen: PenSettings;
  tool: InkTool;
  lastInput: LastInput | null;
  /** A trackpad stroke is waiting for its closing click. */
  openStroke: boolean;
  onPen: (p: PenSettings) => void;
  onTool: (t: InkTool) => void;
}) {
  const choose = (patch: Partial<PenSettings>) => {
    onPen({ ...pen, ...patch });
    if (tool !== 'pen' && !('input' in patch)) onTool('pen');
  };
  const InputIcon = INPUT_ICON[pen.input];
  const device = lastInput ? DEVICE[lastInput.type] ?? { icon: PenIcon, name: lastInput.type } : null;

  return (
    <div style={{ ...barStyle, background: '#ffffff', padding: '4px 10px', gap: 3 }} data-testid="mechand-inkbar" role="toolbar" aria-label="Pen">
      <div style={group} role="radiogroup" aria-label="Tool">
        <HelpTip id="tool-pen">
          <ToolButton icon={<PenIcon />} label="Pen" name="Pen" active={tool === 'pen'} pressed={tool === 'pen'} onClick={() => onTool('pen')} testId="mechand-tool-pen" />
        </HelpTip>
        <HelpTip id="tool-eraser">
          <ToolButton icon={<EraserIcon />} label="Eraser" name="Eraser" active={tool === 'eraser'} pressed={tool === 'eraser'} onClick={() => onTool('eraser')} testId="mechand-tool-eraser" />
        </HelpTip>
      </div>
      {divider}
      <HelpTip id="pen-colour">
        <div style={group} role="radiogroup" aria-label="Ink colour">
          {PEN_COLOURS.map((c) => {
            const on = pen.colour === c.value;
            return (
              <button
                key={c.value} type="button" role="radio" aria-checked={on} aria-label={c.name} data-testid={`mechand-colour-${c.name.toLowerCase()}`}
                onClick={() => choose({ colour: c.value })}
                style={{
                  width: 24, height: 24, borderRadius: 12, padding: 0, cursor: 'pointer', background: c.value,
                  border: '2px solid #fff', boxShadow: on ? `0 0 0 2px ${c.value}, 0 0 0 3px #fff` : '0 0 0 1px #d1d5db',
                  margin: '0 2px',
                }}
              />
            );
          })}
        </div>
      </HelpTip>
      {divider}
      <HelpTip id="pen-style">
        <div style={group} role="radiogroup" aria-label="Kind of line">
          {PEN_STYLES.map((s) => {
            const on = pen.style === s.value;
            return (
              <button
                key={s.value} type="button" role="radio" aria-checked={on} aria-label={`${s.name}: ${s.hint}`} data-testid={`mechand-style-${s.value}`}
                onClick={() => choose({ style: s.value })} style={{ ...toolButtonStyle(on), padding: '3px 5px' }}
              >
                <PenPreview pen={{ ...pen, style: s.value }} />
              </button>
            );
          })}
        </div>
      </HelpTip>
      {divider}
      <HelpTip id="pen-width">
        <div style={group} role="radiogroup" aria-label="Line width">
          {PEN_WIDTHS.map((w) => {
            const on = pen.width === w.value;
            const d = Math.max(3, w.value * 1.6);
            return (
              <button
                key={w.value} type="button" role="radio" aria-checked={on} aria-label={`${w.name} line`} data-testid={`mechand-width-${w.value}`}
                onClick={() => choose({ width: w.value })} style={{ ...toolButtonStyle(on), width: 32, padding: 0 }}
              >
                <span style={{ width: d, height: d, borderRadius: d / 2, background: pen.colour, opacity: pen.style === 'marker' ? 0.5 : 1 }} />
              </button>
            );
          })}
        </div>
      </HelpTip>
      {divider}
      <HelpTip id="pen-input">
        <label style={{ ...group, ...toolButtonStyle(pen.input !== 'auto'), padding: '0 4px 0 8px', cursor: 'pointer' }}>
          <InputIcon />
          <select
            value={pen.input} aria-label="Input mode" data-testid="mechand-input-mode"
            onChange={(e) => onPen({ ...pen, input: e.target.value as InputMode })}
            style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'inherit', padding: '6px 2px', cursor: 'pointer' }}
          >
            {INPUT_MODES.map((m) => <option key={m.value} value={m.value} title={m.hint}>{m.name}</option>)}
          </select>
        </label>
      </HelpTip>
      {device && lastInput && (
        <HelpTip id="pen-device">
          <span
            key={lastInput.n} data-testid="mechand-input-device" data-type={lastInput.type} data-accepted={lastInput.accepted}
            style={{
              ...group, marginLeft: 6, padding: '3px 8px', borderRadius: 12, fontSize: 12,
              background: lastInput.accepted ? '#ecfdf5' : '#fffbeb', color: lastInput.accepted ? '#047857' : '#b45309',
              border: `1px solid ${lastInput.accepted ? '#a7f3d0' : '#fde68a'}`,
              animation: 'mechand-flash 0.6s ease-out',
            }}
          >
            <device.icon size={15} />
            {device.name}{lastInput.accepted ? '' : ' ignored'}
          </span>
        </HelpTip>
      )}
      {openStroke && (
        <span style={{ fontSize: 12, color: '#1d4ed8', marginLeft: 6 }} data-testid="mechand-open-stroke">
          Click to end the stroke (Esc cancels)
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span style={caption}>Appearance never affects recognition</span>
      <style>{'@keyframes mechand-flash { from { box-shadow: 0 0 0 3px rgba(16,185,129,0.35); } to { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }'}</style>
    </div>
  );
}
