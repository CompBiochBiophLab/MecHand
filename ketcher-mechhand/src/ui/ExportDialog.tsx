/**
 * Export the Ketcher canvas: LaTeX (TikZ with curved arrows, chemfig) and
 * interchange formats that ChemDraw, Marvin and other editors open.
 */

import { Rich, useT } from '../i18n/i18n';
import type { Ketcher } from 'ketcher-core';
import { useEffect, useState } from 'react';
import { CHEMFIG_PREAMBLE, toChemfig } from '../export/chemfig';
import { TIKZ_PREAMBLE, toTikz } from '../export/tikz';
import { ketToScene } from '../scene/ketToScene';
import { Modal, btn } from './Modal';

type Format = 'tikz' | 'chemfig' | 'cdxml' | 'mol' | 'ket' | 'smiles';

/** Formats (the note of each is export.note.<id> in the locale files). */
const FORMATS: { id: Format; label: string; file: string }[] = [
  { id: 'tikz', label: 'TikZ', file: 'mechanism.tex' },
  { id: 'chemfig', label: 'chemfig', file: 'mechanism-chemfig.tex' },
  { id: 'cdxml', label: 'ChemDraw (CDXML)', file: 'mechanism.cdxml' },
  { id: 'mol', label: 'MOL / RXN', file: 'mechanism.mol' },
  { id: 'ket', label: 'KET', file: 'mechanism.ket' },
  { id: 'smiles', label: 'SMILES', file: 'mechanism.smi' },
];

async function produce(ketcher: Ketcher, f: Format): Promise<string> {
  switch (f) {
    case 'tikz': return `${TIKZ_PREAMBLE}\n\n${toTikz(ketToScene(await ketcher.getKet()))}`;
    case 'chemfig': return `${CHEMFIG_PREAMBLE}\n\n${toChemfig(ketToScene(await ketcher.getKet()))}`;
    case 'cdxml': return ketcher.getCDXml();
    case 'mol': return ketcher.containsReaction() ? ketcher.getRxn() : ketcher.getMolfile();
    case 'ket': return JSON.stringify(JSON.parse(await ketcher.getKet()), null, 2);
    case 'smiles': return ketcher.getSmiles();
  }
}

export function ExportDialog({ ketcher, onClose }: { ketcher: Ketcher; onClose: () => void }) {
  const { t } = useT();
  const [format, setFormat] = useState<Format>('tikz');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const meta = FORMATS.find((f) => f.id === format)!;

  useEffect(() => {
    let alive = true;
    setText('');
    setError('');
    produce(ketcher, format)
      .then((out) => alive && setText(out))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [ketcher, format]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t('export.noClipboard'));
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: meta.file });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title={t('export.title')} onClose={onClose} width={720} testId="mechand-export">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {FORMATS.map((f) => (
          <button key={f.id} onClick={() => setFormat(f.id)}
            style={btn(f.id === format ? '#1d4ed8' : '#f3f4f6', f.id === format ? '#fff' : '#374151')}>
            {f.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}><Rich text={t(`export.note.${format}`)} /></p>
      {error ? (
        <pre style={{ color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 12 }}>{error}</pre>
      ) : (
        <textarea data-testid="mechand-export-text" readOnly value={text || t('export.generating')}
          style={{ width: '100%', height: 320, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, boxSizing: 'border-box' }} />
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button style={btn('#f3f4f6', '#374151')} onClick={download} disabled={!text}>{t('export.download')}</button>
        <button style={btn('#1d4ed8', '#fff')} onClick={copy} disabled={!text}>{copied ? t('export.copied') : t('export.copy')}</button>
      </div>
    </Modal>
  );
}
