/**
 * ConsolidateDialog: the "Is this what you meant?" step.
 * Shows the recognized scene, the confidence, the electron-flow check and tips
 * for what was not understood, and lets the user confirm (insert into Ketcher),
 * keep editing the ink, or discard it.
 */

import { useT } from '../i18n/i18n';
import type { MechanismIssue } from '../recognition/mechanismCheck';
import type { SketchResult } from '../recognition/sketch';
import { ScenePreview } from './ScenePreview';
import { Modal, btn } from './Modal';
import { CheckIcon, PenIcon, TrashIcon } from './icons';

export interface ConsolidateDialogProps {
  result: SketchResult;
  issues: MechanismIssue[];
  engineNote?: string;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

const withIcon = { display: 'inline-flex', alignItems: 'center', gap: 6 } as const;

/** Tips that fit what the recognizer made of this drawing (keys of consolidate.tip*). */
export function recognitionTips(result: SketchResult): { key: string; count?: number }[] {
  const tips: { key: string; count?: number }[] = [];
  const unread = result.roles.filter((r) => r === 'ignored').length;
  if (unread) tips.push({ key: 'consolidate.tipUnread', count: unread });
  if (result.confidence < 0.6) tips.push({ key: 'consolidate.tipLowConfidence' });
  if (unread || result.confidence < 0.6) tips.push({ key: 'consolidate.tipTeach' });
  return tips;
}

export function ConsolidateDialog({ result, issues, engineNote, onConfirm, onEdit, onDiscard }: ConsolidateDialogProps) {
  const { t } = useT();
  const pct = Math.round(result.confidence * 100);
  const colour = pct >= 80 ? '#16a34a' : pct >= 55 ? '#d97706' : '#dc2626';
  const { atoms, bonds, arrows } = result.scene;
  const tips = recognitionTips(result);
  return (
    <Modal title={t('consolidate.title')} onClose={onEdit} testId="mechand-consolidate">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ background: colour, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
          {t('consolidate.confidence', { pct })}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }} data-testid="mechand-consolidate-counts">
          {t('consolidate.atoms', { count: atoms.length })} · {t('consolidate.bonds', { count: bonds.length })} · {t('consolidate.arrows', { count: arrows.length })}
        </span>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', placeItems: 'center', background: '#fff' }}>
        <ScenePreview scene={result.scene} width={420} height={220} />
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0' }}>
        {t('consolidate.inkColours')} <b style={{ color: '#2563eb' }}>{t('consolidate.bonds')}</b>, <b style={{ color: '#059669' }}>{t('consolidate.labels')}</b>,{' '}
        <b style={{ color: '#dc2626' }}>{t('consolidate.arrows')}</b>, <b style={{ color: '#9ca3af' }}>{t('consolidate.notUnderstood')}</b>.
        {engineNote ? ` ${engineNote}` : ''}
      </p>
      {issues.length > 0 && (
        <ul data-testid="mechand-issues" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px 8px 28px', fontSize: 13, margin: '0 0 10px' }}>
          {issues.map((i, k) => <li key={k}>{t(`check.${i.code}`, i.params as Record<string, string | number>)}</li>)}
        </ul>
      )}
      {tips.length > 0 && (
        <div data-testid="mechand-recognition-tips" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, margin: '0 0 10px' }}>
          <b>{t('consolidate.tipsTitle')}</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {tips.map((tip) => <li key={tip.key}>{t(tip.key, tip.count === undefined ? undefined : { count: tip.count })}</li>)}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button style={{ ...btn('#f3f4f6', '#374151'), ...withIcon }} onClick={onDiscard} data-testid="mechand-discard"><TrashIcon size={16} />{t('consolidate.discard')}</button>
        <button style={{ ...btn('#eff6ff', '#1d4ed8'), ...withIcon }} onClick={onEdit} data-testid="mechand-keep-drawing" title="Esc"><PenIcon size={16} />{t('consolidate.keep')}</button>
        <button style={{ ...btn('#16a34a', '#fff'), ...withIcon }} onClick={onConfirm} data-testid="mechand-confirm" autoFocus title="Enter">
          <CheckIcon size={16} />{t('consolidate.insert')}
        </button>
      </div>
    </Modal>
  );
}
