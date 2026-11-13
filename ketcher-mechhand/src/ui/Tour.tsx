/**
 * Guided tour: highlights the main controls one at a time with a short explanation (texts in
 * helpCenter.tourSteps.* of the locale files). Arrow keys or Enter move on, Esc ends it.
 */

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Rich, useT } from '../i18n/i18n';

export interface TourStep {
  id: string;
  /** data-testid of the element to highlight. */
  target: string;
  /** The step needs freehand mode on (the pen bar only exists then). */
  freehand?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'freehand', target: 'mechand-freehand' },
  { id: 'inkbar', target: 'mechand-inkbar', freehand: true },
  { id: 'recognize', target: 'mechand-recognize' },
  { id: 'undo', target: 'mechand-undo-ink' },
  { id: 'library', target: 'mechand-library-btn' },
  { id: 'image', target: 'mechand-image-btn' },
  { id: 'export', target: 'mechand-export-btn' },
  { id: 'teach', target: 'mechand-teach-btn' },
  { id: 'level', target: 'mechand-level' },
  { id: 'language', target: 'mechand-language' },
  { id: 'help', target: 'mechand-help-btn' },
];

const TOUR_KEY = 'mechand.tour.v1';

export function tourSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(TOUR_KEY) === 'done';
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    globalThis.localStorage?.setItem(TOUR_KEY, 'done');
  } catch {
    /* not remembered */
  }
}

const btn = (primary: boolean): CSSProperties => ({
  border: `1px solid ${primary ? '#2563eb' : '#d1d5db'}`, background: primary ? '#2563eb' : '#fff', color: primary ? '#fff' : '#374151',
  borderRadius: 7, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
});

export function Tour({ onClose, onFreehand }: { onClose: () => void; onFreehand: (on: boolean) => void }) {
  const { t } = useT();
  // Controls the user's level does not show (e.g. Teach, the level menu with ?level=) are skipped.
  const [steps] = useState(() => TOUR_STEPS.filter((s) => s.freehand || document.querySelector(`[data-testid="${s.target}"]`)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  const finish = useCallback(() => {
    markTourSeen();
    onClose();
  }, [onClose]);

  useEffect(() => onFreehand(Boolean(step.freehand)), [step, onFreehand]);

  // Follow the highlighted element (it may appear a frame later, or move when the window resizes).
  useLayoutEffect(() => {
    let raf = 0;
    const update = () => {
      const el = document.querySelector(`[data-testid="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI((x) => (x + 1 < steps.length ? x + 1 : x));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish]);

  const pad = 6;
  const last = i === steps.length - 1;
  const top = rect ? rect.bottom + 12 : 120;
  const left = rect ? Math.max(12, Math.min(window.innerWidth - 332, rect.left + rect.width / 2 - 160)) : 40;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }} data-testid="mechand-tour" data-step={step.id}>
      {/* Clicks outside the bubble end the tour; the highlighted control stays visible. */}
      <div style={{ position: 'absolute', inset: 0 }} onClick={finish} />
      {rect && (
        <div style={{
          position: 'fixed', left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad,
          borderRadius: 10, boxShadow: '0 0 0 9999px rgba(15,23,42,0.45), 0 0 0 3px #60a5fa', pointerEvents: 'none', transition: 'all 0.2s',
        }} />
      )}
      <div role="dialog" aria-live="polite" style={{
        position: 'fixed', top, left, width: 320, background: '#fff', borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontSize: 13.5, lineHeight: 1.5, color: '#111827',
      }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{t('helpCenter.tourSteps.step', { n: i + 1, total: steps.length })}</div>
        <div data-testid="mechand-tour-text"><Rich text={t(`helpCenter.tourSteps.${step.id}`)} /></div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={{ ...btn(false), marginRight: 'auto', border: 'none' }} onClick={finish}>{t('helpCenter.tourSteps.skip')}</button>
          {i > 0 && <button type="button" style={btn(false)} onClick={() => setI(i - 1)}>{t('helpCenter.tourSteps.back')}</button>}
          <button type="button" style={btn(true)} data-testid="mechand-tour-next" autoFocus
            onClick={() => (last ? finish() : setI(i + 1))}>{last ? t('helpCenter.tourSteps.done') : t('helpCenter.tourSteps.next')}</button>
        </div>
      </div>
    </div>
  );
}
