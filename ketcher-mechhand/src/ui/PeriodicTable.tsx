/**
 * The simple periodic table (level A, and anyone whose level enables it): the first five periods
 * in a side panel, coloured by family; clicking an element shows its valence electrons, usual
 * bonds, lone pairs and electronegativity, and can pick it as Ketcher's atom tool.
 */

import { type CSSProperties, useEffect, useState } from 'react';
import { useT } from '../i18n/i18n';
import { FAMILIES, type ElementInfo, type Family, PERIODIC, usualBonds, usualLonePairs, valenceElectrons } from '../learn/periodic';

export const FAMILY_COLOUR: Record<Family, string> = {
  alkali: '#fecaca',
  'alkaline-earth': '#fed7aa',
  transition: '#fde68a',
  'post-transition': '#d9f99d',
  metalloid: '#a7f3d0',
  nonmetal: '#bfdbfe',
  halogen: '#c7d2fe',
  noble: '#f5d0fe',
};

const S = {
  panel: {
    width: 'min(560px, 55vw)', flexShrink: 0, height: '100%', background: '#fff', borderLeft: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', fontSize: 13.5, color: '#111827', minHeight: 0,
  } as CSSProperties,
  head: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' } as CSSProperties,
  body: { overflowY: 'auto', padding: '10px 14px 16px', flex: 1 } as CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gap: 2, margin: '8px 0 12px' } as CSSProperties,
  cell: (family: Family, on: boolean): CSSProperties => ({
    aspectRatio: '1 / 1.1', border: on ? '2px solid #1d4ed8' : '1px solid rgba(0,0,0,0.12)', borderRadius: 4, padding: 0,
    background: FAMILY_COLOUR[family], cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', fontFamily: 'inherit', color: '#111827', minWidth: 0, overflow: 'hidden',
  }),
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', background: '#fafafa' } as CSSProperties,
  btn: {
    border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  } as CSSProperties,
};

export function PeriodicTable({ onClose, onUse }: { onClose: () => void; onUse?: (symbol: string) => void }) {
  const { t, lang } = useT();
  const [sel, setSel] = useState<ElementInfo>(PERIODIC[5]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const v = valenceElectrons(sel);
  const bonds = usualBonds(sel);
  const lp = usualLonePairs(sel);
  const dash = t('learn.periodic.none');
  const row = (label: string, value: string | number | undefined, testId?: string) => (
    <tr>
      <td style={{ color: '#6b7280', paddingRight: 12 }}>{label}</td>
      <td data-testid={testId}><b>{value ?? dash}</b></td>
    </tr>
  );

  return (
    <div style={S.panel} role="complementary" aria-label={t('learn.periodic.title')} data-testid="mechand-periodic">
      <div style={S.head}>
        <b style={{ fontSize: 16, flex: 1 }}>{t('learn.periodic.title')}</b>
        <button type="button" onClick={onClose} aria-label={t('learn.periodic.close')} data-testid="mechand-periodic-close"
          style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
      </div>
      <div style={S.body}>
        <p style={{ margin: '0 0 4px', color: '#4b5563', fontSize: 12.5 }}>{t('learn.periodic.intro')}</p>
        <div style={S.grid} role="grid">
          {PERIODIC.map((e) => (
            <button
              key={e.symbol} type="button" style={{ ...S.cell(e.family, e === sel), gridColumn: e.group, gridRow: e.period }}
              onClick={() => setSel(e)} title={t(`learn.element.${e.symbol}`)} aria-pressed={e === sel}
              data-testid="mechand-periodic-element" data-symbol={e.symbol}
            >
              <span style={{ fontSize: 8.5, lineHeight: 1, color: '#4b5563' }}>{e.z}</span>
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.15 }}>{e.symbol}</span>
            </button>
          ))}
        </div>
        <div style={S.card} data-testid="mechand-periodic-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 700, background: FAMILY_COLOUR[sel.family], borderRadius: 6, padding: '0 8px' }}>{sel.symbol}</span>
            <b style={{ fontSize: 16 }} data-testid="mechand-periodic-name">{t(`learn.element.${sel.symbol}`)}</b>
            <span style={{ color: '#6b7280' }}>
              {t(`learn.family.${sel.family}`)} · {t('learn.periodic.group', { group: sel.group })} · {t('learn.periodic.period', { period: sel.period })}
            </span>
          </div>
          <table style={{ marginTop: 8, fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {row(t('learn.periodic.z'), sel.z)}
              {row(t('learn.periodic.valence'), v, 'mechand-periodic-valence')}
              {row(t('learn.periodic.bonds'), bonds, 'mechand-periodic-bonds')}
              {row(t('learn.periodic.lonePairs'), lp, 'mechand-periodic-lonepairs')}
              {row(t('learn.periodic.en'), sel.en?.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </tbody>
          </table>
          {sel.family === 'transition' && <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>{t('learn.periodic.transitionNote')}</p>}
          {sel.family === 'noble' && <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>{t('learn.periodic.nobleNote')}</p>}
          {onUse && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={S.btn} onClick={() => onUse(sel.symbol)} data-testid="mechand-periodic-use">{t('learn.periodic.use')}</button>
              <span style={{ fontSize: 12, color: '#6b7280', flex: '1 1 200px' }}>{t('learn.periodic.useHint')}</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: '#4b5563' }}>{t('learn.periodic.enNote')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12 }} aria-label={t('learn.periodic.legend')}>
          {FAMILIES.map((f) => (
            <span key={f} style={{ background: FAMILY_COLOUR[f], borderRadius: 999, padding: '2px 8px' }}>{t(`learn.family.${f}`)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
