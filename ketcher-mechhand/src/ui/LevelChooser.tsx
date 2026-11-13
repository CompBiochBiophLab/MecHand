/**
 * Choosing the user level: a welcome dialog on first use (three cards) and a menu in the bar.
 * What each level includes: src/config/levels.json. Texts: level.* in src/i18n/locales/levels/.
 */

import { Rich, useT } from '../i18n/i18n';
import { LEVEL_IDS, type LevelId, useLevel } from '../levels/levels';
import { Modal } from './Modal';
import { toolButtonStyle } from './MecHandBar';
import { LevelIcon } from './icons';

export function LevelChooser({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { level, setLevel } = useLevel();
  const pick = (l: LevelId) => {
    setLevel(l);
    onClose();
  };
  return (
    <Modal title={t('level.chooserTitle')} onClose={() => pick(level)} testId="mechand-level-chooser" width={720}>
      <p style={{ marginTop: 0, fontSize: 13.5 }}><Rich text={t('level.chooserIntro')} /></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {LEVEL_IDS.map((l) => (
          <button
            key={l} type="button" onClick={() => pick(l)} data-testid="mechand-level-option" data-level={l}
            style={{
              textAlign: 'left', border: `1.5px solid ${l === level ? '#2563eb' : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px',
              background: l === level ? '#eff6ff' : '#fff', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: '#1d4ed8' }}>{l}</span>
            <b style={{ fontSize: 15 }}>{t(`level.${l}.name`)}</b>
            <span style={{ fontSize: 12.5, color: '#4b5563' }}>{t(`level.${l}.who`)}</span>
            <span style={{ fontSize: 12.5 }}>{t(`level.${l}.what`)}</span>
            <span style={{ marginTop: 'auto', color: '#1d4ed8', fontSize: 13, fontWeight: 600 }}>{t('level.choose')} →</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Level menu in the MecHand bar (hidden when the address or the study fixes the level). */
export function LevelMenu({ compact }: { compact: boolean }) {
  const { t } = useT();
  const { level, setLevel, fixed } = useLevel();
  if (fixed) return null;
  return (
    <label style={{ ...toolButtonStyle(), padding: '0 4px 0 8px', gap: 4, cursor: 'pointer' }} title={t('level.menuName')}>
      <LevelIcon />
      <select
        value={level} onChange={(e) => setLevel(e.target.value as LevelId)} aria-label={t('level.menuName')} data-testid="mechand-level"
        style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'inherit', padding: '6px 2px', cursor: 'pointer', maxWidth: compact ? 48 : 170 }}
      >
        {LEVEL_IDS.map((l) => <option key={l} value={l}>{compact ? l : t(`level.${l}.short`)}</option>)}
      </select>
    </label>
  );
}
