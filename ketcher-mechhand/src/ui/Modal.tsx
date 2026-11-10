import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { useT } from '../i18n/i18n';

export function btn(bg: string, color: string): CSSProperties {
  return {
    background: bg, color, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8,
    padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  };
}

export function Modal({ title, children, onClose, testId, width = 520 }: {
  title: string; children: ReactNode; onClose: () => void; testId?: string; width?: number;
}) {
  const { t } = useT();
  useEffect(() => {
    // Capture phase: Ketcher handles Escape itself and stops it before it bubbles to window.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div
      data-testid={testId}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 10000 }}
    >
      <div role="dialog" aria-label={title} style={{
        background: '#fff', borderRadius: 12, padding: '18px 22px', width, maxWidth: '95vw', maxHeight: '90vh',
        overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', color: '#111827',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0, flex: 1 }}>{title}</h2>
          <button aria-label={t('dialog.close')} onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
