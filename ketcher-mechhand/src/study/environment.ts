/**
 * Technical context of a study session, kept coarse on purpose (see
 * estudi/05-consentiment-informat.md): browser family and major version,
 * operating system, processor architecture, screen size, touch support and the
 * kinds of pointer used. The raw user-agent string is read to derive these
 * fields but never stored; nothing here is sent anywhere.
 */

export interface StudyEnvironment {
  browser: { name: string; major: number | null };
  os: { name: string; major: number | null };
  /** "arm" or "x86" (with bitness when known); null when the browser does not tell. */
  architecture: string | null;
  /** Where the architecture comes from: client hints, the user-agent string, or inferred from the OS. */
  architectureSource: 'client-hints' | 'user-agent' | 'inferred' | 'unknown';
  mobile: boolean | null;
  /** Screen size in CSS pixels and device pixel ratio (to relate drawing size to the device). */
  screen: { width: number; height: number; pixelRatio: number };
  maxTouchPoints: number;
  /** Pointer kinds seen during the session: "pen", "touch", "mouse". */
  pointerTypes: string[];
}

interface UADataLike {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}

const major = (v: string | undefined | null) => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Browser and OS from a user-agent string (exported for the tests). */
export function parseUserAgent(ua: string, maxTouchPoints = 0): Pick<StudyEnvironment, 'browser' | 'os' | 'architecture' | 'architectureSource' | 'mobile'> {
  const m = (re: RegExp) => ua.match(re)?.[1] ?? null;
  let browser: StudyEnvironment['browser'];
  if (m(/Edg(?:A|iOS)?\/(\d+)/)) browser = { name: 'Edge', major: major(m(/Edg(?:A|iOS)?\/(\d+)/)) };
  else if (m(/OPR\/(\d+)/)) browser = { name: 'Opera', major: major(m(/OPR\/(\d+)/)) };
  else if (m(/SamsungBrowser\/(\d+)/)) browser = { name: 'Samsung Internet', major: major(m(/SamsungBrowser\/(\d+)/)) };
  else if (m(/(?:Firefox|FxiOS)\/(\d+)/)) browser = { name: 'Firefox', major: major(m(/(?:Firefox|FxiOS)\/(\d+)/)) };
  else if (m(/(?:Chrome|CriOS)\/(\d+)/)) browser = { name: 'Chrome', major: major(m(/(?:Chrome|CriOS)\/(\d+)/)) };
  else if (m(/Version\/(\d+)[\d.]* .*Safari/)) browser = { name: 'Safari', major: major(m(/Version\/(\d+)/)) };
  else browser = { name: 'other', major: null };

  let os: StudyEnvironment['os'];
  if (/iPhone/.test(ua)) os = { name: 'iOS', major: major(m(/OS (\d+)_/)) };
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) os = { name: 'iPadOS', major: major(m(/OS (\d+)_/)) };
  else if (/Android/.test(ua)) os = { name: 'Android', major: major(m(/Android (\d+)/)) };
  else if (/CrOS/.test(ua)) os = { name: 'ChromeOS', major: null };
  else if (/Windows/.test(ua)) os = { name: 'Windows', major: null };
  else if (/Macintosh/.test(ua)) os = { name: 'macOS', major: null };
  else if (/Linux/.test(ua)) os = { name: 'Linux', major: null };
  else os = { name: 'other', major: null };

  let architecture: string | null = null;
  let architectureSource: StudyEnvironment['architectureSource'] = 'unknown';
  if (/aarch64|arm64/i.test(ua)) { architecture = 'arm 64'; architectureSource = 'user-agent'; }
  else if (/x86_64|Win64|WOW64|x64|amd64/i.test(ua) && os.name !== 'macOS') { architecture = 'x86 64'; architectureSource = 'user-agent'; }
  else if (['iOS', 'iPadOS', 'Android'].includes(os.name)) { architecture = 'arm'; architectureSource = 'inferred'; }
  // macOS browsers other than Chromium report "Intel" on Apple silicon too: unknown.
  const mobile = /Mobi|iPhone|Android.*Mobile/.test(ua) ? true : os.name === 'other' ? null : false;
  return { browser, os, architecture, architectureSource, mobile };
}

/** Reads the environment; uses User-Agent Client Hints where the browser has them (Chromium). */
export async function detectEnvironment(): Promise<StudyEnvironment> {
  const nav = navigator as Navigator & { userAgentData?: UADataLike };
  const base = parseUserAgent(nav.userAgent, nav.maxTouchPoints ?? 0);
  const uad = nav.userAgentData;
  if (uad?.getHighEntropyValues) {
    try {
      const h = await uad.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'fullVersionList']);
      const list = (h.fullVersionList as { brand: string; version: string }[] | undefined) ?? uad.brands ?? [];
      const real = list.filter((b) => !/Not.?A.?Brand/i.test(b.brand));
      const brand = real.find((b) => b.brand !== 'Chromium') ?? real[0];
      if (brand) base.browser = { name: brand.brand.replace(/^Google /, '').replace(/^Microsoft /, ''), major: major(brand.version) };
      if (uad.platform) base.os = { name: uad.platform === 'macOS' ? 'macOS' : uad.platform, major: base.os.major ?? major(h.platformVersion as string) };
      if (h.architecture) {
        base.architecture = `${h.architecture}${h.bitness ? ` ${h.bitness}` : ''}`;
        base.architectureSource = 'client-hints';
      }
      if (typeof uad.mobile === 'boolean') base.mobile = uad.mobile;
    } catch {
      /* hints refused: keep what the user-agent string says */
    }
  }
  return {
    ...base,
    screen: {
      width: Math.round(screen.width), height: Math.round(screen.height),
      pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    },
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    pointerTypes: [],
  };
}

/** One line for the start screen, so participants see exactly what is recorded. */
