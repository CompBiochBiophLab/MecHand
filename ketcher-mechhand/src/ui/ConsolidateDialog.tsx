/**
 * ConsolidateDialog: the "Is this what you meant?" step.
 * Shows the recognized scene, the confidence, the electron-flow check and lets
 * the user confirm (insert into Ketcher), keep editing the ink, or discard it.
 */

import type { MechanismIssue } from '../recognition/mechanismCheck';
import type { SketchResult } from '../recognition/sketch';
import { ScenePreview } from './ScenePreview';
import { Modal, btn } from './Modal';

export interface ConsolidateDialogProps {
  result: SketchResult;
  issues: MechanismIssue[];
  engineNote?: string;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

export function ConsolidateDialog({ result, issues, engineNote, onConfirm, onEdit, onDiscard }: ConsolidateDialogProps) {
  const pct = Math.round(result.confidence * 100);
  const colour = pct >= 80 ? '#16a34a' : pct >= 55 ? '#d97706' : '#dc2626';
  const { atoms, bonds, arrows } = result.scene;
  return (
    <Modal title="Is this what you meant?" onClose={onEdit} testId="mechand-consolidate">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ background: colour, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
          {pct}% confidence
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {atoms.length} atoms · {bonds.length} bonds · {arrows.length} arrows
        </span>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', placeItems: 'center', background: '#fff' }}>
        <ScenePreview scene={result.scene} width={420} height={220} />
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0' }}>
        Ink colours: <b style={{ color: '#2563eb' }}>bonds</b>, <b style={{ color: '#059669' }}>labels</b>,{' '}
        <b style={{ color: '#dc2626' }}>arrows</b>, <b style={{ color: '#9ca3af' }}>not understood</b>.
        {engineNote ? ` ${engineNote}` : ''}
      </p>
      {issues.length > 0 && (
        <ul data-testid="mechand-issues" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px 8px 28px', fontSize: 13, margin: '0 0 10px' }}>
          {issues.map((i, k) => <li key={k}>{i.message}</li>)}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={btn('#f3f4f6', '#374151')} onClick={onDiscard}>✗ Discard ink</button>
        <button style={btn('#eff6ff', '#1d4ed8')} onClick={onEdit}>✎ Keep drawing</button>
        <button style={btn('#16a34a', '#fff')} onClick={onConfirm} data-testid="mechand-confirm" autoFocus>✓ Insert into Ketcher</button>
      </div>
    </Modal>
  );
}
