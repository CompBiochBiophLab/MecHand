/**
 * The pen toolbar (second row, shown in freehand mode): pen or eraser, ink
 * colour, kind of line, width, input mode (palm rejection, trackpad), and which
 * input device the last contact came from.
 */

import { useEffect, useRef } from 'react';
import {
  INPUT_MODES, type InkTool, type InputMode, PEN_COLOURS, PEN_STYLES, PEN_WIDTHS, type PenSettings, previewStroke, renderInk,
} from '../ink/pen';
import { useT } from '../i18n/i18n';
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
const DEVICE_ICON: Record<string, typeof AutoIcon> = { pen: PenIcon, touch: TouchIcon, mouse: MouseIcon };

const group = { display: 'inline-flex', alignItems: 'center', gap: 3 } as const;
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

export function InkBar({ pen, tool, lastInput, openStroke, onPen, onTool, compact }: {
  pen: PenSettings;
  tool: InkTool;
  lastInput: LastInput | null;
  /** A trackpad stroke is waiting for its closing click. */
  openStroke: boolean;
  onPen: (p: PenSettings) => void;
  onTool: (t: InkTool) => void;
  /** Icons without text (narrow space; decided once for both toolbars, so nothing reflows while drawing). */
  compact: boolean;
}) {
  const choose = (patch: Partial<PenSettings>) => {
    onPen({ ...pen, ...patch });
    if (tool !== 'pen' && !('input' in patch)) onTool('pen');
  };
  const { t } = useT();
  const InputIcon = INPUT_ICON[pen.input];
  const device = lastInput
    ? { icon: DEVICE_ICON[lastInput.type] ?? PenIcon, name: DEVICE_ICON[lastInput.type] ? t(`pen.device.${lastInput.type}`) : lastInput.type }
    : null;

  return (
    // Nothing in this bar changes size while drawing (the device chip has a fixed width and the
    // trackpad hint floats over the canvas): a reflow mid-stroke would move the canvas under the pen.
    <div style={{ ...barStyle, background: '#ffffff', padding: '4px 10px', gap: 3, position: 'relative' }} data-testid="mechand-inkbar" role="toolbar" aria-label={t('pen.bar')}>
      <div style={group} role="radiogroup" aria-label={t('pen.tool')}>
        <HelpTip id="tool-pen">
          <ToolButton icon={<PenIcon />} label={t('pen.pen')} name={t('pen.pen')} showLabel={!compact} active={tool === 'pen'} pressed={tool === 'pen'} onClick={() => onTool('pen')} testId="mechand-tool-pen" />
        </HelpTip>
        <HelpTip id="tool-eraser">
          <ToolButton icon={<EraserIcon />} label={t('pen.eraser')} name={t('pen.eraser')} showLabel={!compact} active={tool === 'eraser'} pressed={tool === 'eraser'} onClick={() => onTool('eraser')} testId="mechand-tool-eraser" />
        </HelpTip>
      </div>
      {divider}
      <HelpTip id="pen-colour">
        <div style={group} role="radiogroup" aria-label={t('pen.colours')}>
          {PEN_COLOURS.map((c) => {
            const on = pen.colour === c.value;
            return (
              <button
                key={c.value} type="button" role="radio" aria-checked={on} aria-label={t(`pen.colour.${c.id}`)} data-testid={`mechand-colour-${c.id}`}
                onClick={() => choose({ colour: c.value })}
                style={{
                  width: compact ? 22 : 24, height: compact ? 22 : 24, borderRadius: 12, padding: 0, cursor: 'pointer', background: c.value,
                  border: '2px solid #fff', boxShadow: on ? `0 0 0 2px ${c.value}, 0 0 0 3px #fff` : '0 0 0 1px #d1d5db',
                  margin: compact ? '0 1px' : '0 2px',
                }}
              />
            );
          })}
        </div>
      </HelpTip>
      {divider}
      <HelpTip id="pen-style">
        <div style={group} role="radiogroup" aria-label={t('pen.styles')}>
          {PEN_STYLES.map((s) => {
            const on = pen.style === s.value;
            return (
              <button
                key={s.value} type="button" role="radio" aria-checked={on} aria-label={`${t(`pen.style.${s.value}`)}: ${t(`pen.styleHint.${s.value}`)}`} data-testid={`mechand-style-${s.value}`}
                onClick={() => choose({ style: s.value })} style={{ ...toolButtonStyle(on), padding: compact ? '3px 3px' : '3px 5px' }}
              >
                <PenPreview pen={{ ...pen, style: s.value }} width={compact ? 26 : 36} />
              </button>
            );
          })}
        </div>
      </HelpTip>
      {divider}
      <HelpTip id="pen-width">
        <div style={group} role="radiogroup" aria-label={t('pen.widths')}>
          {PEN_WIDTHS.map((w) => {
            const on = pen.width === w.value;
            const d = Math.max(3, w.value * 1.6);
            return (
              <button
                key={w.value} type="button" role="radio" aria-checked={on} aria-label={t(`pen.width.${w.id}`)} data-testid={`mechand-width-${w.value}`}
                onClick={() => choose({ width: w.value })} style={{ ...toolButtonStyle(on), width: compact ? 28 : 32, minWidth: 28, padding: 0 }}
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
            value={pen.input} aria-label={t('pen.inputMode')} data-testid="mechand-input-mode"
            onChange={(e) => onPen({ ...pen, input: e.target.value as InputMode })}
            style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'inherit', padding: '6px 2px', cursor: 'pointer' }}
          >
            {INPUT_MODES.map((m) => <option key={m.value} value={m.value} title={t(`pen.inputHint.${m.value}`)}>{t(`pen.input.${m.value}`)}</option>)}
          </select>
        </label>
      </HelpTip>
      <HelpTip id="pen-device">
        <span
          key={lastInput?.n ?? 0} data-testid="mechand-input-device" data-type={lastInput?.type ?? ''} data-accepted={lastInput?.accepted ?? ''}
          role="status"
          aria-label={device && lastInput ? t(lastInput.accepted ? 'pen.device.last' : 'pen.device.lastIgnored', { device: device.name }) : t('pen.device.noInput')}
          style={{
            ...group, marginLeft: 6, padding: '0 8px', borderRadius: 13, fontSize: 12, width: compact ? 40 : 150, height: 26, boxSizing: 'border-box',
            justifyContent: compact ? 'center' : undefined,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            background: !lastInput ? '#f9fafb' : lastInput.accepted ? '#ecfdf5' : '#fffbeb',
            color: !lastInput ? '#6b7280' : lastInput.accepted ? '#047857' : '#b45309',
            border: `1px solid ${!lastInput ? '#e5e7eb' : lastInput.accepted ? '#a7f3d0' : '#fde68a'}`,
            animation: lastInput ? 'mechand-flash 0.6s ease-out' : undefined,
          }}
        >
          {device && lastInput
            ? (<><device.icon size={15} />{!compact && (lastInput.accepted ? device.name : t('pen.device.ignored', { device: device.name }))}</>)
            : compact ? '—' : t('pen.device.none')}
        </span>
      </HelpTip>
      {openStroke && (
        <span
          data-testid="mechand-open-stroke"
          style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 6px)', zIndex: 60, pointerEvents: 'none',
            fontSize: 12, color: '#fff', background: '#1d4ed8', padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {t('pen.openStroke')}
        </span>
      )}
      <style>{'@keyframes mechand-flash { from { box-shadow: 0 0 0 3px rgba(16,185,129,0.35); } to { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }'}</style>
    </div>
  );
}
