/**
 * Contextual tips: a small note in a corner, shown once per browser when something suggests the
 * user could use help (a finger ignored by palm rejection, taps from a trackpad, the first freehand
 * drawing…). Never shown in the user-study mode. Texts: helpCenter.tips.* in the locale files.
 */

import { useT } from '../i18n/i18n';

export type TipId = 'welcome' | 'firstFreehand' | 'ignored' | 'trackpad';

const KEY = 'mechand.tips.v1';

export function tipShown(id: TipId): boolean {
  try {
    return (JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as string[]).includes(id);
  } catch {
    return true;
  }
}

export function markTip(id: TipId): void {
  try {
    const seen = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as string[];
    if (!seen.includes(id)) globalThis.localStorage?.setItem(KEY, JSON.stringify([...seen, id]));
  } catch {
    /* not remembered */
  }
}

export function TipToast({ id, onAction, onHelp, onClose }: {
  id: TipId;
  /** The tip's own action (take the tour, change the input mode…), if it has one. */
  onAction?: () => void;
  onHelp: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const action = { welcome: 'welcomeAction', ignored: 'ignoredAction', trackpad: 'trackpadAction', firstFreehand: null }[id];
  return (
    <div role="status" data-testid="mechand-tip" data-tip={id} style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 8500, maxWidth: 360, background: '#1e293b', color: '#f8fafc', borderRadius: 12,
      padding: '10px 12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontSize: 13, lineHeight: 1.45,
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ flex: 1 }}>{t(`helpCenter.tips.${id}`)}</span>
        <button type="button" onClick={onClose} aria-label={t('helpCenter.tips.dismiss')} data-testid="mechand-tip-close"
          style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {action && onAction && (
          <button type="button" onClick={onAction} data-testid="mechand-tip-action"
            style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 12.5, cursor: 'pointer' }}>
            {t(`helpCenter.tips.${action}`)}
          </button>
        )}
        <button type="button" onClick={onHelp}
          style={{ border: '1px solid #475569', background: 'transparent', color: '#e2e8f0', borderRadius: 7, padding: '4px 10px', fontSize: 12.5, cursor: 'pointer' }}>
          {t('helpCenter.tips.openHelp')}
        </button>
      </div>
    </div>
  );
}
