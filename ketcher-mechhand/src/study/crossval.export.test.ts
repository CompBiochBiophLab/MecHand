/**
 * Leave-one-participant-out evaluation of the shared model with the study data
 * (estudi/04-entrenament-model.md, §3.5). Skipped unless MECHAND_CV_DIR is set:
 *
 *   MECHAND_CV_DIR=<folder with mechand-estudi-*.json> MECHAND_CV_OUT=cv.json \
 *     npx vitest run src/study/crossval.export.test.ts
 *
 * For every recognition that the participant accepted (followed by "insert"), the
 * ink is recognized again with three models: the built-in one ("base"), the
 * built-in one plus the Teach samples of all OTHER participants ("shared"), and
 * the built-in one plus the participant's own samples ("own", which is what ran
 * during the session and serves as a sanity check). Each reading is compared with
 * the accepted one (compare.ts). Only sessions whose participants agreed to share
 * their Teach samples contribute samples.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareScenes } from '../recognition/compare';
import { buildModel } from '../recognition/model';
import { recognizeSketch } from '../recognition/sketch';
import type { Scene } from '../scene/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const DIR = env.MECHAND_CV_DIR;

interface Ev { t: number; type: string; task?: string; data?: any }
interface Session { schema: string; code: string; events: Ev[]; teachSamples?: { samples: any[]; elements: any[] } }

describe.skipIf(!DIR)('leave-one-participant-out evaluation of the shared model', () => {
  it('re-recognizes the accepted drawings', { timeout: 3_600_000 }, () => {
    const sessions: Session[] = readdirSync(DIR!).filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(DIR!, f), 'utf8')))
      .filter((s) => s.schema === 'mechand-study-session/2');
    const rows: Record<string, unknown>[] = [];
    for (const p of sessions) {
      const others = sessions.filter((q) => q !== p && q.teachSamples);
      const models = {
        base: buildModel(),
        shared: buildModel({
          userSamples: others.flatMap((q) => q.teachSamples!.samples),
          userElements: others.flatMap((q) => q.teachSamples!.elements),
        }),
        own: p.teachSamples ? buildModel({ userSamples: p.teachSamples.samples, userElements: p.teachSamples.elements }) : null,
      };
      p.events.forEach((e, i) => {
        if (e.type !== 'recognize') return;
        const next = p.events.slice(i + 1).find((x) => x.task === e.task && ['insert', 'keep-drawing', 'discard', 'recognize'].includes(x.type));
        if (next?.type !== 'insert') return;
        const accepted = e.data.result.scene as Scene;
        const strokes = (e.data.ink as { points: number[][] }[]).map((s) => ({ points: s.points.map(([x, y]) => ({ x, y })) }));
        for (const [name, m] of Object.entries(models)) {
          if (!m) continue;
          const t0 = performance.now();
          const r = recognizeSketch(strokes, m.recognizer, { heads: m.heads, style: m.style });
          rows.push({ code: p.code, task: e.task, t: e.t, model: name, ms: Math.round(performance.now() - t0), ...compareScenes(accepted, r.scene) });
        }
      });
    }
    writeFileSync(env.MECHAND_CV_OUT ?? 'crossval.json', JSON.stringify({ sessions: sessions.length, rows }, null, 1));
    expect(sessions.length).toBeGreaterThan(0);
  });
});
