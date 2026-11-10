/**
 * Template library: a searchable grid of structures (rings, functional groups, biomolecules,
 * reagents) and mechanism templates.
 *
 *   - type to search (accent-insensitive, prefix and typo tolerant; names, synonyms, Catalan
 *     names, abbreviations, formulas, categories);
 *   - arrows move, Enter inserts, Shift+Enter (or Shift+click, or the small corner button) uses the
 *     other mode, Ctrl/Cmd+D toggles a favourite, Esc closes;
 *   - favourites and recently used templates are kept in localStorage (ids only).
 *
 * `TemplateLibrary` shows the panel in a Modal; `TemplateLibraryPanel` is the bare panel for
 * embedding elsewhere (e.g. a side bar).
 */

import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_NAME, FAVOURITES_KEY, type InsertMode, LIBRARY, LIBRARY_CATEGORIES, type LibraryCategory, type LibraryEntry,
  RECENT_KEY, loadIds, saveIds, searchLibrary, toggledFavourite, withRecent,
} from '../templates/library';
import {
  type Converter, type TextStructure, entryFromHit, lookupOnline, lookupWorthy, queryKind, structureFromNotation,
} from '../templates/textToStructure';
import { Modal } from './Modal';
import { MoleculeThumb, thumbData } from './MoleculeThumb';

/** Online look-ups already made in this page (query → result), so they are not repeated. */
const ONLINE_CACHE = new Map<string, TextStructure | null>();

export type LibraryFilter = 'all' | 'recent' | 'favourites' | LibraryCategory;

export interface TemplateLibraryProps {
  /**
   * Called when the user picks a template. `mode` is 'add' (add to the canvas) or 'replace'
   * (replace the canvas); pass both straight to `insertTemplate(ketcher, entry, mode)`.
   */
  onInsert: (entry: LibraryEntry, mode: InsertMode) => void | Promise<void>;
  /** Close request (Esc, ×, backdrop, and after inserting unless `closeOnInsert` is false). */
  onClose: () => void;
  /** Entries to offer (default: the whole LIBRARY), e.g. without mechanisms in study mode. */
  entries?: LibraryEntry[];
  /** Tab shown first (default 'all'). */
  initialFilter?: LibraryFilter;
  /** Close after inserting (default true). */
  closeOnInsert?: boolean;
  /** Reads SMILES/InChI typed in the search box (offline, Ketcher's engine). */
  convert?: Converter;
  /** Offer to look names and CAS numbers up on PubChem/OPSIN (never in study mode). */
  online?: boolean;
}

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'favourites', label: '★ Favourites' },
  ...LIBRARY_CATEGORIES.map((c) => ({ id: c.id as LibraryFilter, label: c.label })),
];

const otherMode = (m: InsertMode): InsertMode => (m === 'add' ? 'replace' : 'add');
const modeVerb = (m: InsertMode) => (m === 'add' ? 'Add to canvas' : 'Replace canvas');
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const THUMB_W = 100, THUMB_H = 70;

type Row = { kind: 'header'; label: string } | { kind: 'item'; entry: LibraryEntry; index: number };

/** Formula with subscripts and a superscript charge (C2H3O2- -> C₂H₃O₂⁻). */
export function Formula({ text }: { text: string }) {
  const m = /^(.*?)([+-]\d*)?$/.exec(text) ?? [text, text, undefined];
  const body = m[1] ?? text;
  const charge = m[2];
  return (
    <span>
      {body.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : <span key={i}>{part}</span>))}
      {charge && <sup>{charge.slice(1)}{charge[0] === '+' ? '+' : '−'}</sup>}
    </span>
  );
}

const S = {
  root: { display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui, sans-serif', color: '#111827', minWidth: 0 } as CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '9px 12px 9px 34px', borderRadius: 9,
    border: '1px solid #cbd5e1', outline: 'none', background: '#fff',
  } as CSSProperties,
  chips: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' } as CSSProperties,
  chip: (on: boolean): CSSProperties => ({
    flex: '0 0 auto', border: `1px solid ${on ? '#2563eb' : '#d1d5db'}`, background: on ? '#dbeafe' : '#fff',
    color: on ? '#1d4ed8' : '#374151', borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', minHeight: 32,
  }),
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 8, alignContent: 'start',
    height: 'min(56vh, 540px)', overflowY: 'auto', padding: 2, overscrollBehavior: 'contain',
  } as CSSProperties,
  header: {
    gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4,
    padding: '6px 2px 0',
  } as CSSProperties,
  tile: (active: boolean, wide: boolean): CSSProperties => ({
    position: 'relative', gridColumn: wide ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center',
    border: `1.5px solid ${active ? '#2563eb' : '#e5e7eb'}`, background: active ? '#eff6ff' : '#fff', borderRadius: 10,
    padding: '6px 4px 6px', cursor: 'pointer', userSelect: 'none', minWidth: 0,
  }),
  label: {
    fontSize: 11.5, lineHeight: '14px', textAlign: 'center', width: '100%', overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 28, wordBreak: 'break-word',
  } as CSSProperties,
  corner: (side: 'left' | 'right', visible: boolean, on = false): CSSProperties => ({
    position: 'absolute', top: 3, [side]: 3, width: 26, height: 26, border: 'none', borderRadius: 6, padding: 0,
    background: visible ? 'rgba(255,255,255,0.9)' : 'transparent', cursor: 'pointer', fontSize: 15, lineHeight: '26px',
    color: on ? '#d97706' : '#6b7280', opacity: on || visible ? 1 : 0.35,
  }),
  footer: {
    display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 12.5,
    color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 8, minHeight: 38,
  } as CSSProperties,
  hint: { color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' } as CSSProperties,
  kbd: { border: '1px solid #d1d5db', borderBottomWidth: 2, borderRadius: 4, padding: '0 4px', fontSize: 11, background: '#f9fafb' } as CSSProperties,
  empty: { gridColumn: '1 / -1', color: '#6b7280', fontSize: 13, padding: '24px 8px', textAlign: 'center' } as CSSProperties,
  lookup: { fontSize: 12.5, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' } as CSSProperties,
  lookupBtn: {
    border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, padding: '4px 10px', fontSize: 12.5, cursor: 'pointer',
  } as CSSProperties,
};

/** The library panel without a modal frame. */
export function TemplateLibraryPanel({
  onInsert, onClose, entries = LIBRARY, initialFilter = 'all', closeOnInsert = true, testId, convert, online = false,
}: TemplateLibraryProps & { testId?: string }) {
  const [query, setQuery] = useState('');
  /** The search text read as SMILES or InChI (offline). */
  const [notation, setNotation] = useState<TextStructure | null>(null);
  /** Online look-up of the current text: status and result. */
  const [lookup, setLookup] = useState<{ query: string; status: 'loading' | 'done'; hit: TextStructure | null } | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(initialFilter);
  const [favourites, setFavourites] = useState<string[]>(() => loadIds(FAVOURITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => loadIds(RECENT_KEY));
  const [active, setActive] = useState(0);
  /** Left/Right move between tiles (rather than the caret) once the user has arrowed into the grid. */
  const [inGrid, setInGrid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollToActive = useRef(false);
  const lastPointer = useRef({ x: -1, y: -1 });
  const touch = useMemo(() => typeof matchMedia === 'function' && matchMedia('(hover: none)').matches, []);

  useEffect(() => inputRef.current?.focus(), []);

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const base = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'recent') return recent.map((id) => byId.get(id)).filter((e): e is LibraryEntry => Boolean(e));
    if (filter === 'favourites') return favourites.map((id) => byId.get(id)).filter((e): e is LibraryEntry => Boolean(e));
    return entries.filter((e) => e.category === filter);
  }, [filter, entries, recent, favourites, byId]);
  // SMILES / InChI: read offline as the user types (debounced).
  useEffect(() => {
    setNotation(null);
    const q = query.trim();
    if (!convert || !q || (queryKind(q) !== 'smiles' && queryKind(q) !== 'inchi')) return;
    let live = true;
    const id = setTimeout(() => {
      structureFromNotation(convert, q).then((r) => live && setNotation(r));
    }, 180);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query, convert]);

  const q = query.trim();
  const cached = ONLINE_CACHE.get(q);
  const onlineHit = lookup?.query === q ? lookup.hit : cached ?? null;
  const lookedUp = (lookup?.query === q && lookup.status === 'done') || cached !== undefined;
  const runLookup = useCallback(async () => {
    if (!convert || !q) return;
    setLookup({ query: q, status: 'loading', hit: null });
    const hit = await lookupOnline(q);
    const result = hit ? await entryFromHit(convert, hit, q) : null;
    ONLINE_CACHE.set(q, result);
    setLookup({ query: q, status: 'done', hit: result });
  }, [convert, q]);

  const items = useMemo(() => {
    const found = searchLibrary(query, base);
    const extra = [notation?.entry, onlineHit?.entry].filter((e): e is LibraryEntry => Boolean(e));
    return q ? [...extra, ...found] : found;
  }, [query, base, notation, onlineHit, q]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const grouped = !query.trim() && filter !== 'recent' && filter !== 'favourites';
    let last = '';
    items.forEach((entry, index) => {
      if (grouped) {
        const label = filter === 'all' ? CATEGORY_NAME[entry.category] : entry.group;
        if (label !== last) out.push({ kind: 'header', label });
        last = label;
      }
      out.push({ kind: 'item', entry, index });
    });
    return out;
  }, [items, query, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length, recent: 0, favourites: 0 };
    for (const e of entries) c[e.category] = (c[e.category] ?? 0) + 1;
    c.recent = recent.filter((id) => byId.has(id)).length;
    c.favourites = favourites.filter((id) => byId.has(id)).length;
    return c;
  }, [entries, recent, favourites, byId]);

  // A new query or tab starts again from the first result.
  useEffect(() => {
    setActive(0);
    setInGrid(false);
    gridRef.current?.scrollTo?.({ top: 0 });
  }, [query, filter]);

  useEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    tileRefs.current[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  // The list can shrink under the highlight (e.g. un-starring in the Favourites tab).
  useEffect(() => {
    if (active > 0 && active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [active, items.length]);

  const current = items[Math.min(active, items.length - 1)];

  const insert = useCallback((entry: LibraryEntry, mode: InsertMode) => {
    const r = withRecent(recent, entry.id);
    setRecent(r);
    saveIds(RECENT_KEY, r);
    const report = (err: unknown) => console.error('[MecHand] could not insert template', entry.id, err);
    try {
      const p = onInsert(entry, mode);
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(report);
    } catch (err) {
      report(err);
    }
    if (closeOnInsert) onClose();
  }, [recent, onInsert, onClose, closeOnInsert]);

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((f) => {
      const next = toggledFavourite(f, id);
      saveIds(FAVOURITES_KEY, next);
      return next;
    });
  }, []);

  const move = (to: number) => {
    if (!items.length) return;
    scrollToActive.current = true;
    setActive(Math.max(0, Math.min(items.length - 1, to)));
  };

  /** Next tile up/down: nearest row in that direction, then the closest horizontally. */
  const moveVertical = (dir: 1 | -1): boolean => {
    const cur = tileRefs.current[active]?.getBoundingClientRect();
    if (!cur) return false;
    const cx = cur.left + cur.width / 2;
    let best = -1, bestGap = Infinity, bestDx = Infinity;
    tileRefs.current.forEach((el, i) => {
      if (!el || i >= items.length) return;
      const r = el.getBoundingClientRect();
      const gap = dir > 0 ? r.top - cur.bottom : cur.top - r.bottom;
      if (gap < -2) return;
      const dx = Math.abs(r.left + r.width / 2 - cx);
      if (gap < bestGap - 4 || (Math.abs(gap - bestGap) <= 4 && dx < bestDx)) {
        best = i;
        bestGap = gap;
        bestDx = dx;
      }
    });
    if (best < 0) return false;
    move(best);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keep keystrokes away from Ketcher's own shortcuts while the library is open.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.target !== inputRef.current) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'D')) {
      e.preventDefault();
      if (current) toggleFavourite(current.id);
    } else if (k === 'Enter' && e.altKey) {
      e.preventDefault();
      if (online && lookupWorthy(query) && !lookedUp) runLookup();
    } else if (k === 'Enter') {
      e.preventDefault();
      if (current) insert(current, e.shiftKey ? otherMode(current.defaultMode) : current.defaultMode);
    } else if (k === 'ArrowDown') {
      e.preventDefault();
      setInGrid(true);
      moveVertical(1);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      if (!moveVertical(-1)) setInGrid(false);
    } else if ((k === 'ArrowRight' || k === 'ArrowLeft') && (inGrid || !query)) {
      e.preventDefault();
      setInGrid(true);
      move(active + (k === 'ArrowRight' ? 1 : -1));
    } else if ((k === 'Home' || k === 'End') && inGrid) {
      e.preventDefault();
      move(k === 'Home' ? 0 : items.length - 1);
    } else if (k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      for (let i = 0; i < 3; i++) moveVertical(k === 'PageDown' ? 1 : -1);
    }
  };

  const onTilePointerMove = (index: number) => (e: PointerEvent) => {
    // Ignore the synthetic moves browsers send when the grid scrolls under a still pointer.
    if (e.clientX === lastPointer.current.x && e.clientY === lastPointer.current.y) return;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (index !== active) setActive(index);
  };

  const selectFilter = (f: LibraryFilter) => {
    setFilter(f);
    inputRef.current?.focus();
  };

  const listId = 'mechand-library-list';
  const optionId = (e: LibraryEntry) => `mechand-library-opt-${e.id}`;
  const mod = isMac ? '⌘' : 'Ctrl';

  let emptyText = `No templates match “${query.trim()}”.${online ? '' : ' SMILES and InChI are read directly.'}`;
  if (!query.trim() && filter === 'favourites') emptyText = `No favourites yet. Click ☆ on a template (or press ${mod}+D) to keep it here.`;
  else if (!query.trim() && filter === 'recent') emptyText = 'Templates you insert will appear here.';

  tileRefs.current.length = items.length;

  return (
    <div style={S.root} onKeyDown={onKeyDown} data-testid={testId}>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 11, top: 9, color: '#9ca3af', fontSize: 16 }}>⌕</span>
        <input
          ref={inputRef}
          data-testid="mechand-library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, or type a SMILES, InChI, CAS number or name: benzene, Trp, CCO, 64-17-5…"
          aria-label="Search templates, or type a SMILES, InChI, CAS number or name"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(current) : undefined}
          autoComplete="off"
          spellCheck={false}
          style={S.search}
        />
      </div>
      <div style={S.chips} role="tablist" aria-label="Template categories">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} style={S.chip(filter === f.id)}
            onClick={() => selectFilter(f.id)} data-filter={f.id}>
            {f.label}
            <span style={{ marginLeft: 6, fontSize: 11, color: filter === f.id ? '#1d4ed8' : '#9ca3af' }}>{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>
      {online && convert && lookupWorthy(query) && !notation && !onlineHit && (
        <div style={S.lookup} data-testid="mechand-lookup">
          {lookup?.query === q && lookup.status === 'loading' ? (
            <span>Looking up “{q}”…</span>
          ) : lookedUp ? (
            <span data-testid="mechand-lookup-none">No structure found online for “{q}”.</span>
          ) : (
            <>
              <button type="button" style={S.lookupBtn} onClick={runLookup} data-testid="mechand-lookup-btn">
                Look up “{q}” online
              </button>
              <span style={{ color: '#6b7280' }}>
                {' '}PubChem (NIH) and OPSIN (EMBL-EBI) receive the text you typed, nothing else. <kbd style={S.kbd}>Alt+↵</kbd>
              </span>
            </>
          )}
        </div>
      )}
      <div ref={gridRef} id={listId} role="listbox" aria-label="Templates" style={S.grid}>
        {rows.map((row) => {
          if (row.kind === 'header') return <div key={`h-${row.label}`} style={S.header} role="presentation">{row.label}</div>;
          const { entry, index } = row;
          const isActive = index === active;
          const fav = favourites.includes(entry.id);
          const wide = entry.category === 'mechanism';
          const alt = otherMode(entry.defaultMode);
          return (
            <div
              key={entry.id}
              ref={(el) => { tileRefs.current[index] = el; }}
              id={optionId(entry)}
              role="option"
              aria-selected={isActive}
              data-testid="mechand-library-item"
              data-id={entry.id}
              title={`${entry.name}\nClick: ${modeVerb(entry.defaultMode).toLowerCase()} · Shift+click: ${modeVerb(alt).toLowerCase()}`}
              style={S.tile(isActive, wide)}
              onPointerMove={onTilePointerMove(index)}
              onClick={(e) => insert(entry, e.shiftKey ? alt : entry.defaultMode)}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label={`${modeVerb(alt)}: ${entry.name}`}
                title={modeVerb(alt)}
                data-testid="mechand-library-alt"
                style={S.corner('left', isActive || touch)}
                onClick={(e) => { e.stopPropagation(); insert(entry, alt); }}
              >{alt === 'replace' ? '⟲' : '＋'}</button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={fav ? `Remove ${entry.name} from favourites` : `Add ${entry.name} to favourites`}
                aria-pressed={fav}
                title={fav ? 'Remove from favourites' : 'Add to favourites'}
                data-testid="mechand-library-star"
                style={S.corner('right', isActive || touch, fav)}
                onClick={(e) => { e.stopPropagation(); toggleFavourite(entry.id); }}
              >{fav ? '★' : '☆'}</button>
              <MoleculeThumb data={thumbData(entry)} width={wide ? 2 * THUMB_W + 20 : THUMB_W} height={THUMB_H} maxScale={wide ? 16 : 22} />
              <div style={S.label}>{entry.name}</div>
            </div>
          );
        })}
        {items.length === 0 && <div style={S.empty}>{emptyText}</div>}
      </div>
      <div style={S.footer} aria-live="polite">
        <div style={{ minWidth: 0, flex: '1 1 260px' }} data-testid="mechand-library-details">
          {current ? (
            <>
              <b>{current.name}</b>
              {current.displayFormula && <> · <Formula text={current.displayFormula} /></>}
              <span style={{ color: '#6b7280' }}> · {current.group}</span>
              {current.cas?.length ? <span style={{ color: '#6b7280' }}> · CAS {current.cas[0]}</span> : null}
              <div style={{ color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current.description ?? current.keywords.slice(0, 6).join(' · ')}
              </div>
            </>
          ) : <span style={{ color: '#6b7280' }}>{items.length} templates</span>}
        </div>
        <div style={S.hint}>
          <kbd style={S.kbd}>↵</kbd> {current ? modeVerb(current.defaultMode).toLowerCase() : 'insert'}
          {' · '}<kbd style={S.kbd}>⇧↵</kbd> {current ? modeVerb(otherMode(current.defaultMode)).toLowerCase() : 'other mode'}
          {' · '}<kbd style={S.kbd}>{mod}+D</kbd> ★{' · '}<kbd style={S.kbd}>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}

/** Viewport width, kept up to date (the dialog shrinks to fit tablets and phones). */
function useViewportWidth(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/** The library in a modal dialog (data-testid="mechand-library"). */
export function TemplateLibrary(props: TemplateLibraryProps) {
  // Modal adds 2 x 22 px of padding outside `width`; keep 8 px of backdrop on each side.
  const width = Math.max(260, Math.min(880, useViewportWidth() - 60));
  return (
    <Modal title="Template library" onClose={props.onClose} testId="mechand-library" width={width}>
      <TemplateLibraryPanel {...props} />
    </Modal>
  );
}
