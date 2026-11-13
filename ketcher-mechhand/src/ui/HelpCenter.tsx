/**
 * The help centre (F1 or the Help button): a side panel that does not cover the canvas, opened on
 * the topic of what the user is doing, with tips for the current state ("What you can do now"),
 * searchable topics, the keyboard shortcuts, and the guided tour. All texts are in the locale files
 * (helpCenter.*), so the help is translated with the rest of the interface.
 */

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Rich, useT } from '../i18n/i18n';
import { HelpIcon } from './icons';
import { useLevel } from '../levels/levels';

export const HELP_TOPICS = [
  'start', 'levels', 'drawing', 'penbar', 'recognize', 'library', 'teach', 'export', 'shortcuts', 'privacy', 'translate',
] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number];

/** Chemistry topics for beginners (texts: learn.topic.<id> in src/i18n/locales/learn/). */
export const LEARN_TOPICS = [
  'atoms', 'lonePairs', 'charges', 'octet', 'electronegativity', 'nucleophiles', 'curvedArrows', 'fishhook', 'otherArrows', 'acidsBases', 'mechanisms',
] as const;
export type LearnTopic = (typeof LEARN_TOPICS)[number];

/** Learning tip (learn.context.*) for what the user is doing. */
export function learnTip(c: HelpContext): string {
  if (c.dialog === 'consolidate') return 'dialog';
  if (c.dialog === 'library') return 'library';
  return c.freehand ? 'drawing' : 'off';
}

/** Pages of the website that go deeper into each topic. */
const WEB: Record<HelpTopic, string> = {
  start: 'getting-started', levels: 'getting-started', drawing: 'drawing', penbar: 'drawing#the-pen-bar', recognize: 'drawing#is-this-what-you-meant',
  library: 'templates', teach: 'drawing#teach-mechand-your-handwriting', export: 'export', shortcuts: 'drawing#keyboard',
  privacy: 'privacy', translate: 'translating',
};
const SITE = 'https://compbiochbiophlab.github.io/MecHand/guide/';

/** What the app is doing, to choose the topic and the tips. */
export interface HelpContext {
  dialog: string;
  freehand: boolean;
  strokes: number;
  lastInput: { type: string; accepted: boolean } | null;
  study: boolean;
}

export function topicFor(c: HelpContext): HelpTopic {
  if (c.dialog === 'consolidate') return 'recognize';
  if (c.dialog === 'library' || c.dialog === 'teach' || c.dialog === 'export') return c.dialog;
  if (c.freehand) return c.strokes ? 'recognize' : 'drawing';
  return 'start';
}

/** Keys of helpCenter.context.* that apply now (most relevant first). */
export function contextTips(c: HelpContext): { key: string; count?: number }[] {
  const tips: { key: string; count?: number }[] = [];
  if (c.study) tips.push({ key: 'study' });
  if (c.dialog === 'consolidate') tips.push({ key: 'dialog' });
  else if (c.dialog === 'library' || c.dialog === 'teach' || c.dialog === 'export') tips.push({ key: c.dialog });
  else if (!c.freehand) tips.push({ key: 'off' }, { key: 'ketcher' });
  else {
    if (c.lastInput && !c.lastInput.accepted) tips.push({ key: 'ignored' });
    tips.push(c.strokes ? { key: 'strokes', count: c.strokes } : { key: 'empty' });
    if (c.lastInput?.type === 'mouse') tips.push({ key: 'mouse' });
  }
  return tips;
}

const S = {
  // A column beside the editor (the canvas narrows instead of being covered).
  panel: {
    width: 'min(380px, 45vw)', flexShrink: 0, height: '100%', background: '#fff', borderLeft: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', fontSize: 13.5, color: '#111827', minHeight: 0,
  } as CSSProperties,
  head: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' } as CSSProperties,
  body: { overflowY: 'auto', padding: '10px 14px 16px', flex: 1 } as CSSProperties,
  now: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 12px', margin: '4px 0 12px' } as CSSProperties,
  topic: (open: boolean): CSSProperties => ({
    border: `1px solid ${open ? '#93c5fd' : '#e5e7eb'}`, borderRadius: 10, marginBottom: 8, background: open ? '#fafcff' : '#fff',
  }),
  topicHead: {
    width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '9px 12px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: 'inherit', fontFamily: 'inherit',
  } as CSSProperties,
  para: { margin: '0 12px 8px', lineHeight: 1.5 } as CSSProperties,
  search: { width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1' } as CSSProperties,
  btn: {
    border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  } as CSSProperties,
};

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function HelpCenter({ context, onClose, onTour }: { context: HelpContext; onClose: () => void; onTour: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState<HelpTopic>(() => topicFor(context));
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

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

  const body = (topic: HelpTopic) => t(`helpCenter.topic.${topic}.body`).split('\n');
  const topics = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [...HELP_TOPICS];
    return HELP_TOPICS.filter((k) => fold(`${t(`helpCenter.topic.${k}.title`)} ${t(`helpCenter.topic.${k}.body`)}`).includes(q));
  }, [query, t]);
  const tips = contextTips(context);
  const { learn, learnSwitchable, setLearn, features } = useLevel();
  const learnTopics = !context.study && features.learnHelp !== 'off';
  const [openLearn, setOpenLearn] = useState<LearnTopic | null>(null);
  const learnBody = (k: LearnTopic) => t(`learn.topic.${k}.body`).split('\n');
  const shownLearn = useMemo(() => {
    if (!learnTopics) return [];
    const q = fold(query.trim());
    if (!q) return [...LEARN_TOPICS];
    return LEARN_TOPICS.filter((k) => fold(`${t(`learn.topic.${k}.title`)} ${t(`learn.topic.${k}.body`)}`).includes(q));
  }, [query, t, learnTopics]);

  // The chemistry topics: first when the explanations are on (level A), after the help otherwise.
  const learnBlock = learnTopics ? (

          <div data-testid="mechand-learn" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, margin: '4px 0 6px' }}>{t('learn.section')}</h3>
            {learnSwitchable && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} data-testid="mechand-learn-switch" style={{ marginTop: 3 }} />
                <span><b>{t('learn.switch')}</b><br /><span style={{ color: '#6b7280' }}>{t('learn.switchHint')}</span></span>
              </label>
            )}
            {shownLearn.map((k) => {
              const isOpen = openLearn === k || Boolean(query.trim());
              return (
                <section key={k} style={S.topic(isOpen)} data-learn-topic={k} data-open={isOpen}>
                  <button type="button" style={S.topicHead} onClick={() => setOpenLearn(isOpen ? null : k)} aria-expanded={isOpen}>
                    {t(`learn.topic.${k}.title`)}
                    <span aria-hidden style={{ color: '#9ca3af' }}>{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <div>{learnBody(k).map((p, i) => <p key={i} style={S.para}><Rich text={p} /></p>)}</div>}
                </section>
              );
            })}
            {learn && <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>{t('helpCenter.topics')}</h3>}
          </div>
  ) : null;

  return (
    <div ref={panelRef} style={S.panel} role="complementary" aria-label={t('helpCenter.title')} data-testid="mechand-help-center">
      <div style={S.head}>
        <HelpIcon />
        <b style={{ fontSize: 16, flex: 1 }}>{t('helpCenter.title')}</b>
        <button type="button" onClick={onClose} aria-label={t('helpCenter.close')} data-testid="mechand-help-close"
          style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
      </div>
      <div style={S.body}>
        <div style={S.now} data-testid="mechand-help-now">
          <b>{t('helpCenter.now')}</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
            {tips.map((tip) => (
              <li key={tip.key} data-tip={tip.key}>
                <Rich text={t(`helpCenter.context.${tip.key}`, tip.count === undefined ? undefined : { count: tip.count })} />
              </li>
            ))}
            {learn && !context.study && (
              <li data-tip={`learn-${learnTip(context)}`}><Rich text={t(`learn.context.${learnTip(context)}`)} /></li>
            )}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('helpCenter.search')}
            aria-label={t('helpCenter.search')} style={S.search} data-testid="mechand-help-search"
          />
          {!context.study && (
            <button type="button" style={{ ...S.btn, whiteSpace: 'nowrap' }} onClick={onTour} data-testid="mechand-help-tour">
              {t('helpCenter.tour')}
            </button>
          )}
        </div>
        {learn && learnBlock}
        {topics.length === 0 && shownLearn.length === 0 && <p style={{ color: '#6b7280' }}>{t('helpCenter.noResults', { query: query.trim() })}</p>}
        {topics.map((k) => {
          const isOpen = open === k || Boolean(query.trim());
          return (
            <section key={k} style={S.topic(isOpen)} data-topic={k} data-open={isOpen}>
              <button type="button" style={S.topicHead} onClick={() => setOpen(k)} aria-expanded={isOpen}>
                {t(`helpCenter.topic.${k}.title`)}
                <span aria-hidden style={{ color: '#9ca3af' }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div>
                  {body(k).map((p, i) => <p key={i} style={S.para}><Rich text={p} /></p>)}
                  <p style={{ ...S.para, fontSize: 12 }}>
                    <a href={SITE + WEB[k]} target="_blank" rel="noreferrer">{t('helpCenter.website')} ↗</a>
                  </p>
                </div>
              )}
            </section>
          );
        })}
        {!learn && learnBlock && <div style={{ marginTop: 16 }}>{learnBlock}</div>}
      </div>
    </div>
  );
}
