/**
 * GraphToTree.ts
 * Converts a molecular graph (atoms + bonds) to a spanning tree suitable
 * for chemfig's nested syntax, then serialises to chemfig code.
 *
 * chemfig uses an angle-based notation where each bond is described by
 * the angle it makes relative to the positive x-axis (0 = right,
 * counterclockwise positive, in degrees). Ring closures are expressed with
 * \chemfig{...-[@{n}]...-[@{n},...]...}.
 *
 * Algorithm:
 *  1. Build adjacency list from atoms/bonds.
 *  2. DFS from the atom with the most connections (or leftmost if tie).
 *  3. Compute angle for each tree edge from actual 2-D coordinates.
 *  4. Record back-edges (ring closures) for later annotation.
 *  5. Serialise depth-first with proper parenthesisation.
 */

import { AtomResult, BondResult } from '../../recognition/MolScribeClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode {
  idx: number;
  symbol: string;
  x: number;
  y: number;
}

interface GraphEdge {
  a: number;
  b: number;
  type: BondResult['type'];
}

// ── Angle helpers ─────────────────────────────────────────────────────────────

function angleDeg(from: GraphNode, to: GraphNode): number {
  const rad = Math.atan2(-(to.y - from.y), to.x - from.x); // SVG y is flipped
  return Math.round((rad * 180) / Math.PI);
}

function bondPrefix(type: BondResult['type']): string {
  switch (type) {
    case 'double':   return '=';
    case 'triple':   return '~';
    case 'aromatic': return ':';
    case 'wedge':    return '>>';
    case 'dash':     return '<:';
    default:         return '-';
  }
}

// ── DFS tree builder ──────────────────────────────────────────────────────────

interface TreeNode {
  nodeIdx: number;
  edgeType: BondResult['type'] | null; // null for root
  angle: number | null;                // null for root
  children: TreeNode[];
  ringClosureId?: number;              // set if this is a ring-closure target
}

function buildTree(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { root: TreeNode; closures: Array<{ from: number; to: number; id: number; edgeType: BondResult['type'] }> } {
  const adj = new Map<number, Array<{ nbr: number; type: BondResult['type'] }>>();
  for (const n of nodes) adj.set(n.idx, []);
  for (const e of edges) {
    adj.get(e.a)!.push({ nbr: e.b, type: e.type });
    adj.get(e.b)!.push({ nbr: e.a, type: e.type });
  }

  // Start from atom with highest degree (or lowest idx on tie)
  const startIdx = nodes.reduce((best, n) =>
    (adj.get(n.idx)?.length ?? 0) > (adj.get(best.idx)?.length ?? 0) ? n : best
  , nodes[0]).idx;

  const visited = new Set<number>();
  const closures: Array<{ from: number; to: number; id: number; edgeType: BondResult['type'] }> = [];
  let closureId = 0;

  function dfs(idx: number, edgeType: BondResult['type'] | null, angle: number | null): TreeNode {
    visited.add(idx);
    const node: TreeNode = { nodeIdx: idx, edgeType, angle, children: [] };
    for (const { nbr, type } of adj.get(idx) ?? []) {
      if (visited.has(nbr)) {
        // Ring closure
        closures.push({ from: idx, to: nbr, id: ++closureId, edgeType: type });
      } else {
        const fromNode = nodes.find((n) => n.idx === idx)!;
        const toNode   = nodes.find((n) => n.idx === nbr)!;
        node.children.push(dfs(nbr, type, angleDeg(fromNode, toNode)));
      }
    }
    return node;
  }

  const root = dfs(startIdx, null, null);
  return { root, closures };
}

// ── Serialiser ────────────────────────────────────────────────────────────────

function serialise(
  tree: TreeNode,
  nodes: GraphNode[],
  closureTargets: Set<number>,
  closures: Array<{ from: number; to: number; id: number; edgeType: BondResult['type'] }>
): string {
  const node = nodes.find((n) => n.idx === tree.nodeIdx)!;
  const sym = node.symbol === 'C' ? '' : node.symbol; // implicit carbon

  let prefix = '';
  if (tree.angle !== null && tree.edgeType !== null) {
    prefix = `${bondPrefix(tree.edgeType)}[${tree.angle}]`;
  }

  // Ring closure annotation
  let ringAnnotation = '';
  if (closureTargets.has(tree.nodeIdx)) {
    const cl = closures.find((c) => c.to === tree.nodeIdx);
    if (cl) ringAnnotation = `[@{rc${cl.id}}]`;
  }

  if (tree.children.length === 0) {
    return `${prefix}${sym}${ringAnnotation}`;
  }

  if (tree.children.length === 1) {
    return `${prefix}${sym}${ringAnnotation}${serialise(tree.children[0], nodes, closureTargets, closures)}`;
  }

  // Multiple children: first is inline, rest are branches in ()
  const [first, ...rest] = tree.children;
  const branches = rest
    .map((c) => `(${serialise(c, nodes, closureTargets, closures)})`)
    .join('');
  return `${prefix}${sym}${ringAnnotation}${branches}${serialise(first, nodes, closureTargets, closures)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function toChemfig(atoms: AtomResult[], bonds: BondResult[]): string {
  if (atoms.length === 0) return '\\chemfig{}';

  const nodes: GraphNode[] = atoms.map((a, i) => ({ idx: i, ...a }));
  const edges: GraphEdge[] = bonds.map((b) => ({
    a: b.beginAtom,
    b: b.endAtom,
    type: b.type,
  }));

  const { root, closures } = buildTree(nodes, edges);
  const closureTargets = new Set(closures.map((c) => c.to));

  const inner = serialise(root, nodes, closureTargets, closures);

  // Add ring-closure ties
  let ringLines = '';
  for (const cl of closures) {
    ringLines += `\n\\chemmove{\\draw[${bondPrefix(cl.edgeType)}](rc${cl.id})..controls+(0,0.5)..(rc${cl.id}src);}`;
  }

  return `\\chemfig{${inner}}${ringLines}`;
}
