import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Switch, Share, Alert, Platform, StatusBar, useWindowDimensions,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G, Polygon, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */
const C = {
  bg: '#E8EDEE', surface: '#F7F9F9', ink: '#12262B', sub: '#506168',
  line: '#B4C3C7', primary: '#0F5C6E', stake: '#E0A800',
  warn: '#8A5200', warnBg: '#FBF0D4', ok: '#2F6B3F', okBg: '#DDEBDD',
  info: '#0F5C6E', infoBg: '#D8E8EC',
  zone: { public: '#DCE9ED', service: '#E4EBD8', private: '#EADFD2', passage: '#F7F9F9' },
  wingM: '#CFE0F2', wingF: '#F0D9E0',
};
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

// Alert.alert does nothing on the web, so use the browser's own dialog there.
const notify = (title, msg) => {
  if (Platform.OS === 'web') window.alert(title + '\n' + msg);
  else Alert.alert(title, msg);
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */
const DEFAULT_FORM = {
  name: 'My house',
  width: '15', length: '25', width2: '',
  shape: 'rect', finish: 'standard', size: 'comfortable',
  study: false, laundry: false, ensuite: false, veranda: false, septic: true, rain: false, furnBoq: false,
  front: '3', rear: '2', side: '1.5',
  maxCover: '60',
  storeys: '1', height: '3.0',
  bedrooms: '3', baths: '2',
  segregate: false,
  street: 'S',
  block: '150',
  pitch: '20', overhang: '0.6',
  waste: '5', labour: '35', contingency: '10',
};

// key, label, unit, default. Defaults are placeholders: set your local prices.
const RATE_DEFS = [
  ['excavation', 'Excavation', 'm³', 4],
  ['hardcore', 'Hardcore fill', 'm³', 18],
  ['block', 'Wall block', 'each', 0.75],
  ['cement', 'Cement, 50 kg bag', 'bag', 9],
  ['sand', 'Sand', 'm³', 25],
  ['aggregate', 'Aggregate', 'm³', 40],
  ['steel', 'Reinforcement steel', 'kg', 1.1],
  ['mesh', 'Mesh sheet 2.4 × 4.8 m', 'sheet', 40],
  ['roofSheet', 'Roof sheet, 3 m long (other lengths pro rata)', 'sheet', 8],
  ['timber', 'Roof timber', 'm', 1.8],
  ['tile', 'Floor tile', 'm²', 12],
  ['paint', 'Paint', 'L', 5],
  ['wallTile', 'Wall tile', 'm²', 14],
  ['ceiling', 'Ceiling board', 'm²', 7],
  ['skirting', 'Timber skirting', 'm', 3],
  ['ridge', 'Ridge cap', 'm', 4],
  ['fascia', 'Fascia board', 'm', 3],
  ['doorLeaf', 'Interior door leaf', 'each', 70],
  ['doorMain', 'Main door, solid', 'each', 180],
  ['doorFrame', 'Door frame timber', 'm', 6],
  ['ironmongery', 'Lock, hinges and handle set', 'set', 25],
  ['windowFrame', 'Window frame (aluminium or steel)', 'm²', 45],
  ['glass', 'Glass, 5 mm clear', 'm²', 30],
  ['winHardware', 'Window stays and latches', 'set', 8],
  ['ventGrille', 'Vent grille above door', 'each', 4],
  ['bedDouble', 'Double bed with mattress', 'each', 160],
  ['bedSingle', 'Single bed with mattress', 'each', 90],
  ['bedside', 'Bedside table', 'each', 25],
  ['wardrobe', 'Built-in wardrobe', 'm', 90],
  ['sofa', 'Sofa set', 'each', 380],
  ['coffee', 'Coffee table', 'each', 45],
  ['tvUnit', 'TV unit', 'each', 70],
  ['diningTable', 'Dining table', 'each', 120],
  ['chair', 'Chair', 'each', 15],
  ['kitchenCab', 'Kitchen cabinets and worktop', 'm', 130],
  ['desk', 'Desk', 'each', 70],
  ['shelf', 'Shelving unit', 'each', 40],
  ['gutter', 'Gutter', 'm', 3.5],
  ['downpipe', 'Downpipe', 'm', 3],
  ['tank1000', 'Rainwater tank, 1,000 L', 'each', 120],
  ['wc', 'WC set', 'each', 130],
  ['basin', 'Basin', 'each', 45],
  ['sink', 'Kitchen sink', 'each', 60],
  ['point', 'Electrical point (switch or socket)', 'each', 6],
  ['cable15', 'Cable 1.5 mm², 100 m roll', 'roll', 45],
  ['cable25', 'Cable 2.5 mm², 100 m roll', 'roll', 70],
  ['conduit', 'Conduit 20 mm, 3 m length', 'each', 1.2],
  ['db', 'Distribution board', 'each', 60],
  ['pipe20', 'Water pipe 20 mm, 4 m length', 'each', 3.5],
  ['pipe50', 'Waste pipe 50 mm, 3 m length', 'each', 4],
  ['pipe110', 'Soil pipe 110 mm, 6 m length', 'each', 14],
  ['plumbFit', 'Pipe fittings per wet room', 'each', 30],
];
const defaultRates = () => {
  const o = {};
  RATE_DEFS.forEach(([k, , , d]) => { o[k] = String(d); });
  return o;
};

const DIRS = ['N', 'E', 'S', 'W'];
const BEAR = { N: 0, E: 90, S: 180, W: 270 };
const dirFromBearing = (b) => DIRS[(((Math.round(b / 90)) % 4) + 4) % 4];

const TYPE_BASE = {
  living: 18, dining: 10, lounge: 14, kitchen: 9, store: 4,
  stairs: 6, bath: 4.5, bed: 11, master: 14, study: 9, laundry: 6,
};
const MIN_SIDE = { living: 3, dining: 2.4, lounge: 2.8, kitchen: 2.2, store: 1.5, stairs: 2, bath: 1.8, bed: 2.7, study: 2.4, laundry: 1.8 };
const HABITABLE = ['living', 'dining', 'lounge', 'kitchen', 'bed', 'study'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const n = (v, d = 0) => {
  const x = parseFloat(String(v).replace(',', '.'));
  return isNaN(x) ? d : x;
};
const fmt = (x, d = 0) => {
  const s = Number(x).toFixed(d);
  const [i, dec] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
};
// Split into the fewest bands of at most k rooms, sized evenly so no band is left with one small room.
const chunk = (arr, k) => {
  if (!arr.length) return [];
  const bands = Math.ceil(arr.length / k);
  const per = Math.ceil(arr.length / bands);
  const out = [];
  for (let i = 0; i < arr.length; i += per) out.push(arr.slice(i, i + per));
  return out;
};

/* ------------------------------------------------------------------ */
/*  Room programme                                                     */
/* ------------------------------------------------------------------ */
/* Modular coordination: every wall, room and opening sits on a 0.225 m grid
   (half a 450 × 225 block), so blocks are laid whole or half and never cut. */
const MOD = 0.225;
const WIN_STD = [
  { id: 'W0', w: 0.675, h: 1.125 },
  { id: 'W1', w: 0.9, h: 1.125 },
  { id: 'W2', w: 1.35, h: 1.125 },
  { id: 'W3', w: 1.8, h: 1.125 },
];
const DOOR_W = 0.9;
const MAIN_W = 1.125;
const SHEET_LENS = [2.4, 3.0, 3.6, 4.2, 4.8, 6.0];
const SHEET_COVER = 0.8;
const TILE_SIZES = [0.3, 0.4, 0.45, 0.6];

// Split `total` in proportion to `vals`, in whole multiples of `mod`, summing exactly.
function snapSplit(vals, total, mod) {
  const T = Math.round(total / mod);
  const sum = vals.reduce((a, x) => a + x, 0);
  const raw = vals.map((v) => (v / sum) * T);
  const u = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = T - u.reduce((a, x) => a + x, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem);
  let k = 0;
  while (diff > 0) { u[order[k % order.length].i]++; diff--; k++; }
  while (diff < 0) {
    const j = u.indexOf(Math.max(...u));
    if (u[j] <= 1) break;
    u[j]--; diff++;
  }
  return u.map((x) => x * mod);
}

// Split `total` in proportion to `weights` in whole grid units, but never below each minimum (in metres).
function fitSplit(weights, minsM, total) {
  const T = Math.round(total / MOD);
  const mins = minsM.map((m) => Math.ceil(m / MOD - 1e-6));
  if (mins.reduce((a, x) => a + x, 0) > T) return snapSplit(weights, total, MOD);
  const fixed = weights.map(() => false);
  for (let pass = 0; pass < weights.length; pass++) {
    const free = weights.map((w, i) => i).filter((i) => !fixed[i]);
    const rem = T - mins.reduce((a, m, i) => a + (fixed[i] ? m : 0), 0);
    const sb = free.reduce((a, i) => a + weights[i], 0);
    let changed = false;
    free.forEach((i) => { if ((weights[i] / sb) * rem < mins[i]) { fixed[i] = true; changed = true; } });
    if (!changed) break;
  }
  const units = weights.map((w, i) => (fixed[i] ? mins[i] : 0));
  const free = weights.map((w, i) => i).filter((i) => !fixed[i]);
  const rem = T - units.reduce((a, x) => a + x, 0);
  if (!free.length) {
    const big = weights.reduce((bi, w, i) => (w > weights[bi] ? i : bi), 0);
    units[big] += rem;
  } else {
    const sb = free.reduce((a, i) => a + weights[i], 0);
    const raw = free.map((i) => (weights[i] / sb) * rem);
    const fl = raw.map(Math.floor);
    let diff = rem - fl.reduce((a, x) => a + x, 0);
    const order = raw.map((r, j) => ({ j, rem: r - Math.floor(r) })).sort((x, y) => y.rem - x.rem);
    let k = 0;
    while (diff > 0) { fl[order[k % order.length].j]++; diff--; k++; }
    free.forEach((i, j) => { units[i] = fl[j]; });
  }
  return units.map((u) => u * MOD);
}
const fitWidths = (rooms, W) => fitSplit(rooms.map((r) => r.base), rooms.map((r) => MIN_SIDE[r.type] || 1.2), W);

/* ------------------------------------------------------------------ */
/*  Room programme: living area at the front, bedrooms and bathrooms   */
/*  at the back, a passage between the two so every room has access.   */
/* ------------------------------------------------------------------ */
function program(f, bwHint) {
  const ns = Math.max(1, Math.min(3, Math.round(n(f.storeys, 1))));
  const nb = Math.max(1, Math.round(n(f.bedrooms, 1)));
  let nbath = Math.max(ns, Math.round(n(f.baths, 1)));
  if (f.segregate) nbath = Math.max(nbath, 2);

  const bedsPer = Array(ns).fill(0);
  let left = nb;
  bedsPer[0] = ns === 1 ? nb : Math.min(nb, Math.ceil(nb / ns));
  left -= bedsPer[0];
  for (let i = 1; i < ns; i++) {
    const take = Math.ceil(left / (ns - i));
    bedsPer[i] = take;
    left -= take;
  }
  const bathsPer = Array(ns).fill(1);
  for (let k = 0; k < nbath - ns; k++) bathsPer[k % ns]++;

  const R = (name, short, type, wing = null, base) => ({
    name, short, type, wing, base: base || TYPE_BASE[type],
  });

  let bedIdx = 0;
  let bathIdx = 0;
  const floors = [];
  for (let i = 0; i < ns; i++) {
    const front = [];
    if (i === 0) {
      front.push(R('Living room', 'Living', 'living'));
      if (nb >= 2) front.push(R('Dining', 'Dining', 'dining'));
      front.push(R('Kitchen', 'Kitchen', 'kitchen'));
      front.push(R('Store', 'Store', 'store'));
    } else {
      front.push(R('Family lounge', 'Lounge', 'lounge'));
    }
    if (ns > 1) front.push(R('Stairs', 'Stairs', 'stairs'));

    const beds = [], baths = [];
    for (let b = 0; b < bathsPer[i]; b++) {
      bathIdx++;
      const wing = f.segregate && bathsPer[i] >= 2 ? (b % 2 === 0 ? 'M' : 'F') : null;
      baths.push(R('Bathroom ' + bathIdx, 'Bath', 'bath', wing));
    }
    for (let b = 0; b < bedsPer[i]; b++) {
      const idx = bedIdx++;
      const wing = f.segregate ? (idx % 2 === 0 ? 'M' : 'F') : null;
      const master = !f.segregate && idx === 0;
      beds.push(R(
        master ? 'Master bedroom' : 'Bedroom ' + (idx + 1),
        master ? 'Master' : 'Bed ' + (idx + 1),
        'bed', wing, master ? TYPE_BASE.master : TYPE_BASE.bed,
      ));
    }
    const store = [];
    let rear;
    if (f.segregate) {
      const pick = (arr, w) => arr.filter((r) => r.wing === w);
      rear = [
        ...pick(beds, 'M'), ...pick(baths, 'M'), ...baths.filter((r) => !r.wing), ...store,
        ...pick(baths, 'F'), ...pick(beds, 'F'),
      ];
    } else {
      rear = [...beds, ...baths, ...store];
    }
    floors.push({ label: i === 0 ? 'Ground floor' : 'Floor ' + i, front, rear });
  }
  // Optional rooms, on the ground floor
  const g = floors[0];
  const minW = (arr) => arr.reduce((a, r) => a + Math.ceil((MIN_SIDE[r.type] || 1.2) / MOD - 1e-6), 0) * MOD;
  const Wh = bwHint || 99;
  if (f.laundry) {
    g.front = g.front.filter((r) => r.type !== 'store');
    const at = g.front.findIndex((r) => r.type === 'stairs');
    g.front.splice(at < 0 ? g.front.length : at, 0, R('Laundry and store', 'Laundry', 'laundry'));
  }
  const notes = [];
  if (f.study) {
    const room = R('Study', 'Study', 'study');
    const need = Math.ceil(MIN_SIDE.study / MOD - 1e-6) * MOD;
    if (minW(g.rear) + need <= Wh + 1e-6) g.rear.push(room);
    else if (minW(g.front) + need <= Wh + 1e-6) g.front.splice(Math.max(0, g.front.findIndex((r) => r.type === 'kitchen')), 0, room);
    else if (floors.length > 1) {
      const u = floors[1].front;
      u.splice(Math.max(0, u.findIndex((r) => r.type === 'stairs')), 0, room);
      notes.push(['info', 'The study is on the first floor because the ground floor has no room for it.']);
    } else {
      notes.push(['warn', 'The study was not added: this floor has no room for it without cramping the bedrooms. Add a storey or use a wider plot.']);
    }
  }
  if (f.ensuite && !f.segregate && nbath >= 2) {
    const mi = g.rear.findIndex((r) => r.name === 'Master bedroom');
    const bi = g.rear.findIndex((r) => r.type === 'bath');
    if (mi >= 0 && bi >= 0) {
      const bath = g.rear.splice(bi, 1)[0];
      bath.name = 'En-suite bath'; bath.short = 'Ensuite'; bath.ensuite = true;
      g.rear.splice(mi + 1, 0, bath);
    }
  }
  floors.notes = notes;
  return floors;
}

/* ------------------------------------------------------------------ */
/*  Layout, openings                                                   */
/* ------------------------------------------------------------------ */
// Fewest standard windows (one size per room) that reach the glazing target.
function packBands(rooms, W) {
  if (!rooms.length) return [];
  const T = Math.round(W / MOD);
  const minU = (r) => Math.ceil((MIN_SIDE[r.type] || 1.2) / MOD - 1e-6);
  const fits = (arr) => arr.reduce((a, r) => a + minU(r), 0) <= T;
  const greedy = [];
  let cur = [];
  rooms.forEach((r) => {
    if (cur.length && !fits([...cur, r])) { greedy.push(cur); cur = []; }
    cur.push(r);
  });
  if (cur.length) greedy.push(cur);
  const per = Math.ceil(rooms.length / greedy.length);
  const even = [];
  for (let i = 0; i < rooms.length; i += per) even.push(rooms.slice(i, i + per));
  return even.length === greedy.length && even.every(fits) ? even : greedy;
}

function pickWindows(target) {
  let best = null;
  WIN_STD.forEach((s) => {
    const a = s.w * s.h;
    const count = Math.max(1, Math.ceil(target / a - 0.15));
    const score = count + Math.abs(count * a - target) * 0.5;
    if (!best || score < best.score) best = { s, count, score };
  });
  return best;
}

/* ------------------------------------------------------------------ */
/*  Furniture: placed against walls, clear of door swings and windows  */
/* ------------------------------------------------------------------ */
const OPP = { F: 'B', B: 'F', Lf: 'R', R: 'Lf' };
const NORM = { B: [0, 1], F: [0, -1], Lf: [1, 0], R: [-1, 0] };
const hit = (a, b, m = 0) => a.x < b.x + b.w - m && a.x + a.w > b.x + m && a.y < b.y + b.h - m && a.y + a.h > b.y + m;
const wallSpan = (rm, side) => (side === 'B' || side === 'F' ? rm.w : rm.h);
const wallRect = (rm, side, along, len, depth) => {
  if (side === 'B') return { x: along - len / 2, y: 0, w: len, h: depth };
  if (side === 'F') return { x: along - len / 2, y: rm.h - depth, w: len, h: depth };
  if (side === 'Lf') return { x: 0, y: along - len / 2, w: depth, h: len };
  return { x: rm.w - depth, y: along - len / 2, w: depth, h: len };
};
const edgeZone = (rm, side, a, len, depth) => {
  if (side === 'B') return { x: a, y: 0, w: len, h: depth };
  if (side === 'F') return { x: a, y: rm.h - depth, w: len, h: depth };
  if (side === 'Lf') return { x: 0, y: a, w: depth, h: len };
  return { x: rm.w - depth, y: a, w: depth, h: len };
};

function furnish(rm) {
  const items = [];
  const t = rm.type;
  const doorSides = rm.doors.map((d) => d.side);
  const blocked = rm.doors.map((d) => edgeZone(rm, d.side, d.a - 0.05, d.w + 0.1, d.w + 0.2));
  const windows = rm.windows.map((w) => edgeZone(rm, w.side, w.a, w.w, 0.35));
  const all = ['B', 'F', 'Lf', 'R'];
  const ds = rm.doors.length ? rm.doors[0].side : 'F';
  const prefer = (first) => [...first, ...all.filter((x) => !first.includes(x))];
  const free = (sides) => sides.filter((x) => !doorSides.includes(x));
  const inside = (r) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= rm.w + 1e-6 && r.y + r.h <= rm.h + 1e-6;
  const clear = (r, tall) => inside(r) && !blocked.some((b) => hit(r, b)) && !items.some((i) => hit(r, i, 0.02)) && !(tall && windows.some((w) => hit(r, w)));
  const add = (kind, r, extra) => { const it = { k: kind, ...r, ...(extra || {}) }; items.push(it); return it; };
  const put = (kind, len, depth, sides, tall, fracs) => {
    for (const side of sides) {
      const span = wallSpan(rm, side);
      if (len > span - 0.05) continue;
      for (const fr of fracs || [0.5, 0.25, 0.75, 0.12, 0.88]) {
        const along = Math.min(span - len / 2, Math.max(len / 2, fr * span));
        const r = wallRect(rm, side, along, len, depth);
        if (clear(r, tall)) return add(kind, r, { side });
      }
    }
    return null;
  };
  const awayFromDoor = free(prefer([OPP[ds]]));

  if (t === 'bed') {
    const small = rm.area < 9.5 || Math.min(rm.w, rm.h) < 2.9;
    const bwid = small ? 0.9 : rm.area >= 16 ? 1.8 : 1.5, blen = 2.0;
    const across = (s) => (s === 'B' || s === 'F' ? rm.h : rm.w);
    const heads = awayFromDoor.filter((s) => across(s) >= blen + 0.8);
    const bed = put(small ? 'bed1' : 'bed2', bwid, blen, heads, false);
    if (bed) {
      const horiz = bed.side === 'B' || bed.side === 'F';
      const nt = 0.4;
      [-1, 1].forEach((dir) => {
        const r = horiz
          ? { x: dir < 0 ? bed.x - nt : bed.x + bed.w, y: bed.side === 'B' ? 0 : rm.h - nt, w: nt, h: nt }
          : { x: bed.side === 'Lf' ? 0 : rm.w - nt, y: dir < 0 ? bed.y - nt : bed.y + bed.h, w: nt, h: nt };
        if (clear(r, false)) add('bedtable', r);
      });
      const perp = free(prefer(horiz ? ['Lf', 'R'] : ['B', 'F'])).filter((s) => s !== bed.side);
      if (!put('wardrobe', 1.8, 0.6, perp, true, [0.95, 0.05, 0.5, 0.25, 0.75])) put('wardrobe', 1.2, 0.6, perp, true, [0.95, 0.05, 0.5, 0.25, 0.75]);
    }
  } else if (t === 'living' || t === 'lounge') {
    const sofa = put('sofa', 2.1, 0.9, free(prefer(['R', 'Lf', 'B', 'F'])), false);
    if (sofa) {
      const horiz = sofa.side === 'B' || sofa.side === 'F';
      const nrm = NORM[sofa.side];
      const tw = horiz ? 1.0 : 0.6, th = horiz ? 0.6 : 1.0;
      const sdepth = horiz ? sofa.h : sofa.w, tdepth = horiz ? th : tw;
      const cx = sofa.x + sofa.w / 2 + nrm[0] * (sdepth / 2 + 0.45 + tdepth / 2);
      const cy = sofa.y + sofa.h / 2 + nrm[1] * (sdepth / 2 + 0.45 + tdepth / 2);
      const tb = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
      if (clear(tb, false)) add('table', tb);
      if ((horiz ? rm.h : rm.w) >= 3.6) put('tv', 1.5, 0.4, free([OPP[sofa.side]]), false);
    }
  } else if (t === 'dining') {
    const horiz = rm.w >= rm.h;
    const tw = horiz ? 1.6 : 0.9, th = horiz ? 0.9 : 1.6;
    if (rm.w >= tw + 1.2 && rm.h >= th + 1.2) {
      const tb = add('dtable', { x: (rm.w - tw) / 2, y: (rm.h - th) / 2, w: tw, h: th });
      const cs = 0.4;
      for (let k = 0; k < 3; k++) {
        const o = 0.2 + k * 0.5;
        const pair = horiz
          ? [{ x: tb.x + o, y: tb.y - cs - 0.05 }, { x: tb.x + o, y: tb.y + tb.h + 0.05 }]
          : [{ x: tb.x - cs - 0.05, y: tb.y + o }, { x: tb.x + tb.w + 0.05, y: tb.y + o }];
        pair.forEach((p) => { const r = { ...p, w: cs, h: cs }; if (clear(r, false)) add('chair', r); });
      }
    }
  } else if (t === 'kitchen') {
    const walls = free(all).sort((a, b) => wallSpan(rm, b) - wallSpan(rm, a));
    let counter = null;
    for (const s of walls) {
      const len = Math.min(wallSpan(rm, s) - 1.0, 3.6);
      if (len >= 1.8) { counter = put('counter', len, 0.6, [s], false, [0.95, 0.05, 0.5, 0.25, 0.75]); if (counter) break; }
    }
    if (counter) {
      const horiz = counter.side === 'B' || counter.side === 'F';
      const L2 = horiz ? counter.w : counter.h;
      const at = (fr, a, b) => (horiz
        ? { x: counter.x + fr * L2 - a / 2, y: counter.y + (0.6 - b) / 2, w: a, h: b }
        : { x: counter.x + (0.6 - b) / 2, y: counter.y + fr * L2 - a / 2, w: b, h: a });
      add('sink', at(0.3, 0.8, 0.46));
      add('cooker', at(0.75, 0.6, 0.55));
      put('fridge', 0.7, 0.7, free(prefer([counter.side])), true, [0.95, 0.05, 0.5, 0.25, 0.75]);
    }
  } else if (t === 'bath') {
    const d0 = rm.doors[0];
    const dpt = d0 ? { B: [d0.a + d0.w / 2, 0], F: [d0.a + d0.w / 2, rm.h], Lf: [0, d0.a + d0.w / 2], R: [rm.w, d0.a + d0.w / 2] }[d0.side] : [rm.w / 2, rm.h];
    const sz = Math.min(rm.w, rm.h) < 2.0 ? 0.8 : 0.9;
    const dist = (c) => Math.hypot(c[0] + sz / 2 - dpt[0], c[1] + sz / 2 - dpt[1]);
    const corners = [[0, 0], [rm.w - sz, 0], [0, rm.h - sz], [rm.w - sz, rm.h - sz]].sort((a, b) => dist(b) - dist(a));
    for (const c of corners) {
      const r = { x: c[0], y: c[1], w: sz, h: sz };
      if (clear(r, false)) { add('shower', r); break; }
    }
    put('wc', 0.4, 0.7, awayFromDoor, false);
    put('basin', 0.5, 0.4, awayFromDoor, false);
  } else if (t === 'laundry') {
    put('washer', 0.6, 0.6, awayFromDoor, false);
    put('lsink', 0.8, 0.5, awayFromDoor, false);
  } else if (t === 'study') {
    const desk = put('desk', 1.4, 0.7, awayFromDoor, false);
    if (desk) {
      const nrm = NORM[desk.side];
      const sd = desk.side === 'B' || desk.side === 'F' ? desk.h : desk.w;
      const cx = desk.x + desk.w / 2 + nrm[0] * (sd / 2 + 0.3), cy = desk.y + desk.h / 2 + nrm[1] * (sd / 2 + 0.3);
      const ch = { x: cx - 0.225, y: cy - 0.225, w: 0.45, h: 0.45 };
      if (clear(ch, false)) add('chair', ch);
    }
    put('shelf', 1.2, 0.3, free(all), true, [0.95, 0.05, 0.5, 0.25, 0.75]);
  } else if (t === 'store') {
    put('shelf', Math.min(1.8, Math.max(wallSpan(rm, 'B'), wallSpan(rm, 'Lf')) - 0.3), 0.4, free(all), true, [0.95, 0.05, 0.5, 0.25, 0.75]);
    put('shelf', 1.0, 0.4, free(all), true, [0.95, 0.05, 0.5, 0.25, 0.75]);
  } else if (t === 'stairs') {
    add('steps', { x: 0.15, y: 0.15, w: rm.w - 0.3, h: rm.h - 0.3 });
  }
  return items;
}

// Narrow-room caps: stairs, stores and bathrooms never get wider than this; the rest goes to their neighbours.
const MAXW = { stairs: 2.7, store: 2.7, bath: 3.15, laundry: 3.15 };
function capWidths(rooms, widths) {
  const w = widths.slice();
  let excess = 0;
  rooms.forEach((r, i) => {
    const m = MAXW[r.type];
    if (!m) return;
    const mu = Math.floor(m / MOD + 1e-6) * MOD;
    if (w[i] > mu + 1e-6) { excess += w[i] - mu; w[i] = mu; }
  });
  if (excess < 1e-6) return widths;
  const free = rooms.map((r, i) => i).filter((i) => !MAXW[rooms[i].type]);
  if (!free.length) return widths;
  const units = Math.round(excess / MOD);
  const sb = free.reduce((a, i) => a + rooms[i].base, 0);
  const raw = free.map((i) => (rooms[i].base / sb) * units);
  const fl = raw.map(Math.floor);
  let diff = units - fl.reduce((a, x) => a + x, 0);
  const order = raw.map((x, j) => ({ j, rem: x - Math.floor(x) })).sort((a, b) => b.rem - a.rem);
  let k = 0;
  while (diff > 0) { fl[order[k % order.length].j]++; diff--; k++; }
  free.forEach((i, j) => { w[i] += fl[j] * MOD; });
  return w;
}

function layoutFloor(fl, bw, bl, street, notch, rearDepth, ground) {
  const PASS = 6 * MOD; // 1.35 m passage
  const bands = [];
  packBands(fl.front, bw).forEach((b) => bands.push({ zone: 'public', rooms: b }));
  const priv = packBands(fl.rear, notch ? bw - notch.w : bw);
  if (priv.length) {
    bands.push({ zone: 'passage', rooms: [{ name: 'Passage', short: 'Passage', type: 'passage', base: 0, wing: null }] });
  } else { notch = null; }
  priv.forEach((b) => bands.push({ zone: 'private', rooms: b }));
  const pi = bands.findIndex((b) => b.zone === 'passage');
  bands.forEach((b, bi) => {
    b.w = notch && bi === bands.length - 1 ? bw - notch.w : bw;
  });

  const roomBands = bands.filter((b) => b.zone !== 'passage');
  const passN = bands.length - roomBands.length;
  const avail = bl - passN * PASS;
  const wgt = roomBands.map((b) => b.rooms.reduce((x, r) => x + r.base, 0) / b.w);
  let depths;
  const minD = roomBands.map((b) => Math.max(...b.rooms.map((r) => MIN_SIDE[r.type] || 1.2)));
  if (notch && rearDepth && roomBands.length > 1) {
    depths = fitSplit(wgt.slice(0, -1), minD.slice(0, -1), avail - rearDepth).concat([rearDepth]);
  } else {
    depths = fitSplit(wgt, minD, avail);
  }

  let cursor = bl; // y grows toward the rear; the street side is y = bl
  let di = 0;
  const rooms = [];
  let intLen = 0;
  bands.forEach((b, bi) => {
    const isRear = !!notch && bi === bands.length - 1;
    let depth, widths;
    if (b.zone === 'passage') { depth = PASS; widths = [bw]; }
    else { depth = depths[di++]; widths = capWidths(b.rooms, fitWidths(b.rooms, b.w)); }
    const top = cursor - depth;
    let x = isRear && notch.side === 'Lf' ? notch.w : 0;
    b.rooms.forEach((r, i) => {
      rooms.push({ ...r, zone: b.zone, band: bi, rear: isRear, x, y: top, w: widths[i], h: depth, area: widths[i] * depth });
      x += widths[i];
    });
    intLen += (b.rooms.length - 1) * depth;
    if (bi > 0) intLen += Math.min(b.w, bands[bi - 1].w);
    cursor = top;
  });
  const base = roomBands.reduce((a, b) => a + b.rooms.reduce((x, r) => x + r.base, 0), 0);
  const scale = rooms.filter((r) => r.type !== 'passage').reduce((a, r) => a + r.area, 0) / base;

  // Outside walls, as intervals along each wall
  const eps = 0.02;
  const upB = (BEAR[street] + 180) % 360;
  const faceOf = { F: street, B: dirFromBearing(upB), R: dirFromBearing(upB + 90), Lf: dirFromBearing(upB + 270) };
  const nd = notch ? depths[depths.length - 1] : 0;
  const nx0 = notch ? (notch.side === 'R' ? bw - notch.w : 0) : 0;
  const nx1 = notch ? (notch.side === 'R' ? bw : notch.w) : 0;
  rooms.forEach((r) => {
    const leftEdge = r.rear && notch.side === 'Lf' ? notch.w : 0;
    const rightEdge = r.rear && notch.side === 'R' ? bw - notch.w : bw;
    const walls = [];
    if (r.y + r.h > bl - eps) walls.push({ side: 'F', a: 0, b: r.w });
    if (r.y < eps) walls.push({ side: 'B', a: 0, b: r.w });
    else if (notch && !r.rear && Math.abs(r.y - nd) < eps) {
      const a = Math.max(r.x, nx0) - r.x, b = Math.min(r.x + r.w, nx1) - r.x;
      if (b - a > 0.5) walls.push({ side: 'B', a, b });
    }
    if (r.x < leftEdge + eps) walls.push({ side: 'Lf', a: 0, b: r.h });
    if (r.x + r.w > rightEdge - eps) walls.push({ side: 'R', a: 0, b: r.h });
    r.walls = walls;
    r.faces = walls.map((w) => faceOf[w.side]);
    const has = (s) => walls.some((w) => w.side === s);
    r.cross = (has('Lf') && has('R')) || (has('F') && has('B'));
  });

  // Doors: every room opens to the passage (or to its neighbour toward it). Living has the main door.
  const snapLeft = (len, w) => Math.max(0, Math.round((len - w) / 2 / MOD) * MOD);
  rooms.forEach((r) => {
    r.doors = []; r.windows = [];
    const toward = pi < 0 ? null : r.band < pi ? 'B' : r.band > pi ? 'F' : null;
    if (r.type === 'passage') {
      if (ground) r.doors.push({ side: 'Lf', a: snapLeft(r.h, DOOR_W), w: DOOR_W });
    } else if (r.ensuite) {
      const m = rooms.find((x) => x.type === 'bed' && x.band === r.band && Math.abs(x.x + x.w - r.x) < 0.02);
      if (m) r.doors.push({ side: 'Lf', a: snapLeft(r.h, DOOR_W), w: DOOR_W });
      else if (toward) r.doors.push({ side: toward, a: snapLeft(r.w, DOOR_W), w: DOOR_W });
    } else if (r.type !== 'stairs' && r.type !== 'dining' && toward) {
      r.doors.push({ side: toward, a: snapLeft(r.w, DOOR_W), w: DOOR_W });
    }
    if (r.type === 'living' && ground) r.doors.push({ side: 'F', a: snapLeft(r.w, MAIN_W), w: MAIN_W, main: true });
  });

  // Windows: standard sizes on outside walls; rooms with two opposite outside walls get one on each.
  const opp = { F: 'B', B: 'F', Lf: 'R', R: 'Lf' };
  rooms.forEach((r) => {
    if (r.type === 'passage') {
      r.walls.forEach((w) => {
        if (w.side !== 'Lf' && w.side !== 'R') return;
        if (r.doors.some((d) => d.side === w.side)) return;
        const std = WIN_STD[0];
        const left = Math.round((w.b - w.a - std.w) / 2 / MOD) * MOD;
        if (left >= 0 && left + std.w <= w.b - w.a) r.windows.push({ side: w.side, a: w.a + left, w: std.w, h: std.h, id: std.id });
      });
      return;
    }
    const hab = HABITABLE.includes(r.type);
    const smallWet = r.type === 'bath' || r.type === 'laundry';
    if (!(hab || smallWet) || !r.walls.length) return;
    const pk = pickWindows(smallWet ? 0.6 : Math.max(1, 0.15 * r.area));
    let count = pk.count;
    if (r.cross && hab) count = Math.max(count, 2);
    const ws = r.walls.slice().sort((p, q) => (q.b - q.a) - (p.b - p.a));
    let use = [ws[0]];
    if (r.cross && hab) {
      const o = ws.find((w) => w.side === opp[ws[0].side]);
      if (o) use = [ws[0], o];
    }
    const perWall = use.map(() => 0);
    for (let i = 0; i < count; i++) perWall[i % use.length]++;
    use.forEach((w, wi) => {
      const m = perWall[wi];
      if (!m) return;
      const len = w.b - w.a;
      const doorsOn = r.doors.filter((d) => d.side === w.side);
      const placed = [];
      const sizes = WIN_STD.filter((x) => x.w <= pk.s.w).reverse(); // preferred size first, then smaller ones
      for (let k = 0; k < m; k++) {
        const c = w.a + ((k + 0.5) * len) / m;
        let done = false;
        for (const std of sizes) {
          if (len < std.w + 0.6) continue;
          const left0 = Math.round((c - std.w / 2) / MOD) * MOD;
          for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.25, -2.25, 2.7, -2.7]) {
            const left = left0 + off;
            if (left < w.a + 0.3 || left + std.w > w.b - 0.3) continue;
            const clash = doorsOn.some((d) => left < d.a + d.w + 0.15 && left + std.w > d.a - 0.15)
              || placed.some((q) => left < q.l + q.w + 0.3 && left + std.w > q.l - 0.3);
            if (!clash) {
              placed.push({ l: left, w: std.w });
              r.windows.push({ side: w.side, a: left, w: std.w, h: std.h, id: std.id });
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }
    });
  });

  // A grille above each door onto the passage lets air leave through the window at the passage end.
  const passage = rooms.find((r) => r.type === 'passage');
  const passVent = !!passage && passage.windows.length > 0;
  rooms.forEach((r) => {
    r.doors.forEach((d) => {
      if (!d.main && r.type !== 'passage' && (d.side === 'B' || d.side === 'F') && Math.abs(r.band - pi) === 1) d.vent = true;
    });
    r.viaVent = passVent && r.windows.length > 0 && r.doors.some((d) => d.vent);
    if (r.viaVent) r.cross = true;
  });

  rooms.forEach((r) => { r.furn = furnish(r); });

  return { label: fl.label, rooms, intLen, scale, notchD: notch ? nd : null, wetBands: new Set(rooms.filter((r) => r.type === 'bath').map((r) => r.band)).size };
}

/* ------------------------------------------------------------------ */
/*  Electrical and plumbing runs, measured from the layout             */
/* ------------------------------------------------------------------ */
const roomPoints = (rm) => {
  switch (rm.type) {
    case 'bath': case 'store': case 'stairs': return { lights: 1, sockets: 0 };
    case 'laundry': return { lights: 1, sockets: 2 };
    case 'passage': return { lights: Math.max(1, Math.ceil(rm.w / 3.5)), sockets: 1 };
    case 'kitchen': return { lights: Math.ceil(rm.area / 9), sockets: 4 };
    default: return { lights: Math.ceil(rm.area / 9), sockets: 2 };
  }
};

// Length of a chain that visits every room once, nearest room first (cables run along walls, so Manhattan distance).
function chainLen(rooms, px, py) {
  let cx = px, cy = py, len = 0;
  const left = rooms.slice();
  while (left.length) {
    let bi = 0, bd = 1e9;
    left.forEach((r, i) => {
      const d = Math.abs(r.x + r.w / 2 - cx) + Math.abs(r.y + r.h / 2 - cy);
      if (d < bd) { bd = d; bi = i; }
    });
    const r = left.splice(bi, 1)[0];
    len += bd; cx = r.x + r.w / 2; cy = r.y + r.h / 2;
  }
  return len;
}

function planServices(floors, bw, bl, h) {
  const ground = floors[0].rooms;
  const hub = ground.find((r) => r.type === 'passage') || ground.find((r) => r.type === 'kitchen') || ground[0];
  const dbY = hub.y + hub.h / 2;

  const electrics = (px, py) => {
    let l15 = 0, l25 = 0;
    floors.forEach((fl, fi) => {
      const rooms = fl.rooms.filter((r) => r.type !== 'stairs');
      const run = chainLen(rooms, px, py) + 1.5 + fi * h;
      const lights = rooms.reduce((a, r) => a + roomPoints(r).lights, 0);
      const sockets = rooms.reduce((a, r) => a + roomPoints(r).sockets, 0);
      l15 += run + lights * 2.5;
      l25 += run + sockets * 3.5;
    });
    return { l15, l25, total: l15 + l25 };
  };

  let best = null;
  for (let x = 0.45; x <= bw - 0.45 + 1e-6; x += 0.45) {
    const e = electrics(x, dbY);
    if (!best || e.total < best.e.total) best = { x, e };
  }
  const base = electrics(bw / 2, bl - 0.5);
  const savingPct = Math.max(0, ((base.total - best.e.total) / base.total) * 100);

  let supply = 0, soil = 0, waste = 0;
  floors.forEach((fl, fi) => {
    const wet = fl.rooms.filter((r) => r.type === 'bath' || r.type === 'kitchen' || r.type === 'laundry');
    if (!wet.length) return;
    const fixtures = wet.reduce((a, r) => a + (r.type === 'bath' ? 3 : 1), 0);
    supply += chainLen(wet, bw / 2, bl) + fi * h + fixtures * 1.5 + 1.0;
    wet.forEach((r) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const out = Math.min(cx, bw - cx, cy, bl - cy) + 1.5 + fi * h;
      if (r.type === 'bath') { soil += out; waste += 2.5; } else { waste += out; }
    });
  });

  return {
    db: { x: best.x, y: dbY }, l15: best.e.l15, l25: best.e.l25,
    conduit: (best.e.l15 + best.e.l25) * 0.95, savingPct,
    supply, soil, waste,
  };
}

/* ------------------------------------------------------------------ */
/*  Generate design + checks                                           */
/* ------------------------------------------------------------------ */
function generate(f) {
  const W0 = n(f.width), W2 = n(f.width2), L = n(f.length);
  const W = W2 > 0 ? Math.min(W0, W2) : W0;
  const front = n(f.front), rear0 = n(f.rear), side0 = n(f.side);
  const bwFull = W - 2 * side0, blFull = L - front - rear0;
  if (!(W > 0 && L > 0) || bwFull < 5 || blFull < 5) {
    return { error: 'The buildable area is under 5 m on one side. Reduce the setbacks or enlarge the plot.' };
  }
  // Size the building to the rooms asked for, in whole blocks (0.45 m), not to the whole plot.
  const S = { compact: 1.0, comfortable: 1.2, generous: 1.5 }[f.size || 'comfortable'];
  const prog = program(f, Math.floor(bwFull / 0.45 + 1e-6) * 0.45);
  const maxBase = Math.max(...prog.map((fl) => [...fl.front, ...fl.rear].reduce((a, r) => a + r.base, 0)));
  const area0 = maxBase * S * (f.shape === 'Lr' || f.shape === 'Ll' ? 1.12 : 1);
  const PASSD = 6 * MOD;
  const bwS = Math.floor(bwFull / 0.45 + 1e-6) * 0.45;
  const blS = Math.floor(blFull / 0.45 + 1e-6) * 0.45;
  let bw = bwS;
  let bl = (area0 + PASSD * bw) / bw;
  if (bl < 9 && bw > 7.2) {
    bw = Math.min(bwS, Math.max(7.2, Math.floor((area0 + PASSD * bw) / 9 / 0.45) * 0.45));
    bl = (area0 + PASSD * bw) / bw;
  }
  bl = Math.min(blS, Math.max(6.3, Math.round(bl / 0.45) * 0.45));
  const side = side0 + (bwFull - bw) / 2;
  const rear = rear0 + (blFull - bl);
  const courses = Math.max(12, Math.round(n(f.height, 3) / MOD));
  const hMod = courses * MOD;

  let notch = null;
  let nDepth = 0;
  if (f.shape === 'Lr' || f.shape === 'Ll') {
    const unitsOf = (r) => Math.ceil((MIN_SIDE[r.type] || 1.2) / MOD - 1e-6);
    const rearMin = Math.max(...prog.map((fl) => fl.rear.reduce((a, r) => a + unitsOf(r), 0))) * MOD;
    const availN = Math.floor((bw - rearMin) / 0.45 + 1e-6) * 0.45;
    if (availN < 2.7) {
      return { error: `An L-shape needs the bedroom row to be narrower than the full width. These rooms need ${fmt(rearMin, 1)} m of the ${fmt(bw, 1)} m width, which leaves no room for the notch. Use fewer bedrooms or bathrooms, add a storey, or choose a rectangle.` };
    }
    const nw = Math.min(availN, Math.max(2.7, Math.round((bw * 0.3) / 0.45) * 0.45));
    notch = { w: nw, side: f.shape === 'Lr' ? 'R' : 'Lf' };
    const maxRear = Math.max(...prog.map((fl) => fl.rear.reduce((a, r) => a + r.base, 0)));
    nDepth = Math.min(Math.round((bl * 0.55) / MOD) * MOD, Math.max(16 * MOD, Math.round((maxRear * S) / (bw - nw) / MOD) * MOD));
  }

  const g0 = layoutFloor(prog[0], bw, bl, f.street, notch, nDepth, true);
  if (notch && g0.notchD == null) notch = null;
  const floors = [g0, ...prog.slice(1).map((fl) => layoutFloor(fl, bw, bl, f.street, notch, g0.notchD, false))];
  if (notch) notch = { ...notch, d: g0.notchD };
  const footArea = bw * bl - (notch ? notch.w * notch.d : 0);
  // Veranda: a covered porch in the front setback, in front of the living room
  let veranda = null;
  let verandaMsg = null;
  if (f.veranda) {
    const lv = g0.rooms.find((r) => r.type === 'living');
    const vd = Math.min(10 * MOD, Math.floor((front - 1) / MOD) * MOD);
    if (lv && vd >= 6 * MOD) {
      veranda = { x: lv.x, w: Math.floor(Math.min(bw - lv.x, Math.max(lv.w, 4.5)) / MOD) * MOD, d: vd };
    } else {
      verandaMsg = `No room for a veranda: the front setback is ${fmt(front, 1)} m and a veranda needs at least 2.4 m, leaving 1 m to the boundary.`;
    }
  }
  const services = planServices(floors, bw, bl, hMod);

  const checks = [];
  const add = (level, text) => checks.push({ level, text });
  add('info', `Building is sized to your rooms: ${fmt(bw, 2)} × ${fmt(bl, 2)} m, in whole blocks, with the rest of the plot left as garden. Wall height is ${fmt(hMod, 3)} m (${courses} courses). Walls, rooms and openings sit on a 0.225 m grid, so no block needs cutting.`);
  (prog.notes || []).forEach((t) => add(t[0], t[1]));
  if (veranda) add('info', `Veranda ${fmt(veranda.w, 2)} × ${fmt(veranda.d, 2)} m in front of the living room, leaving ${fmt(front - veranda.d, 1)} m to the street boundary.`);
  if (verandaMsg) add('warn', verandaMsg);
  if (floors.some((fl) => fl.rooms.some((r) => r.viaVent))) add('info', 'Cross-ventilation: rooms with windows on one wall let air out through a grille above their door into the passage, which has a window at its end.');
  if (W2 > 0 && W2 !== W0) add('info', `The plot is ${fmt(W0)} m at the front and ${fmt(W2)} m at the back. The design uses the narrower ${fmt(W)} m width, so some land is unused.`);
  if (notch) add('info', `L-shaped plan: a ${fmt(notch.w, 2)} × ${fmt(notch.d, 2)} m corner is left out at the back ${notch.side === 'R' ? 'right' : 'left'}, giving a sheltered yard. The roof is counted over the full rectangle, so it is slightly high.`);

  const cover = (footArea / (W0 * L)) * 100;
  if (cover > n(f.maxCover, 60)) {
    add('warn', `Building covers ${fmt(cover)}% of the plot, above your ${fmt(n(f.maxCover, 60))}% limit. Increase the setbacks.`);
  }
  const minScale = Math.min(...floors.map((x) => x.scale));
  const maxScale = Math.max(...floors.map((x) => x.scale));
  if (minScale < 0.7) {
    add('warn', `Rooms come out at ${fmt(minScale * 100)}% of normal size. Reduce bedrooms or bathrooms, add a storey, or enlarge the plot.`);
  } else if (maxScale > 1.8) {
    add('info', `Rooms come out at ${fmt(maxScale * 100)}% of normal size. The plot can carry more bedrooms or a courtyard.`);
  }

  let habitable = 0, outside = 0, cross = 0;
  floors.forEach((fl) => {
    fl.rooms.forEach((r) => {
      if (r.type === 'passage') return;
      const short = Math.min(r.w, r.h), long = Math.max(r.w, r.h);
      const min = MIN_SIDE[r.type];
      const where = floors.length > 1 ? ` (${fl.label.toLowerCase()})` : '';
      if (min && short < min - 0.05) {
        add('warn', `${r.name}${where} is ${fmt(r.w, 1)} × ${fmt(r.h, 1)} m. The short side should be at least ${min} m.`);
      } else if (long / short > (r.type === 'bath' || r.type === 'store' ? 4.2 : 3.5)) {
        add('warn', `${r.name}${where} is very long and narrow (${fmt(r.w, 1)} × ${fmt(r.h, 1)} m).`);
      }
      if (HABITABLE.includes(r.type)) {
        habitable++;
        if (r.faces.length) outside++;
        if (r.cross) cross++;
        if (!r.faces.length) add('warn', `${r.name}${where} has no outside wall. Move it to another storey, widen the plot so the bedrooms fit in one row, or add a light well.`);
        else if (!r.windows.length) add('warn', `${r.name}${where} has no space for a window on its outside wall.`);
      }
      if (r.type === 'bed' && r.faces.includes('W')) {
        add('warn', `${r.name}${where} has a west wall, which takes afternoon sun. Use small, shaded openings on that side (tropical site assumed).`);
      }
    });
  });

  floors.forEach((fl) => fl.rooms.forEach((r) => {
    const has = (k) => (r.furn || []).some((it) => it.k === k);
    const where = floors.length > 1 ? ` (${fl.label.toLowerCase()})` : '';
    if (r.type === 'bed' && !has('bed1') && !has('bed2')) add('warn', `${r.name}${where} has no space for a bed with a clear walkway. Make the room bigger or the bed smaller.`);
    if (r.type === 'kitchen' && !has('counter')) add('warn', `The kitchen${where} has no space for a worktop run of at least 1.8 m.`);
    if (r.type === 'bath' && !has('wc')) add('warn', `${r.name}${where} has no space for a toilet clear of the door.`);
    if ((r.type === 'living' || r.type === 'lounge') && !has('sofa')) add('warn', `The ${r.type === 'living' ? 'living room' : 'lounge'}${where} has no space for a sofa clear of the doors.`);
  }));
  const groundBeds = floors[0].rooms.filter((r) => r.type === 'bed');
  if (groundBeds.length) {
    const nearest = Math.min(...groundBeds.map((r) => front + (bl - (r.y + r.h))));
    add(nearest >= 6 ? 'ok' : 'info', `Nearest ground-floor bedroom sits ${fmt(nearest, 1)} m back from the street boundary.`);
  }
  if (f.segregate) {
    add('info', 'Male and female wings sit on opposite sides of each floor, each with its own bathroom where the floor has two or more. Fit a lockable door on the shared passage.');
  }
  if (!checks.some((c) => c.level === 'warn')) add('ok', 'No layout problems found.');

  return {
    form: { ...f }, W, L: L, plotW: W0, front, rear, side, bw, bl, street: f.street,
    hMod, courses, floors, checks, cover, services, notch, footArea, veranda,
    stats: {
      crossPct: habitable ? Math.round((cross / habitable) * 100) : 0,
      outsidePct: habitable ? Math.round((outside / habitable) * 100) : 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Bill of quantities, in the usual categories                        */
/* ------------------------------------------------------------------ */
function bestTileFor(rooms) {
  let best = null;
  TILE_SIZES.forEach((ts) => {
    const cnt = rooms.reduce((a, r) => a + Math.ceil(r.w / ts - 1e-6) * Math.ceil(r.h / ts - 1e-6), 0);
    const area = cnt * ts * ts;
    if (!best || area < best.area - 1e-6 || (Math.abs(area - best.area) < 1e-6 && ts > best.ts)) best = { ts, cnt, area };
  });
  return best;
}

function computeBoQ(snap, rates) {
  const f = snap.form;
  const { bw, bl, floors, footArea } = snap;
  const rt = (k) => n(rates[k]);
  const finish = f.finish || 'standard';
  const K = { basic: 0.75, standard: 1, luxury: 1.7 }[finish];
  const rk = (k) => rt(k) * K; // finish-grade items scale with the grade
  const ns = floors.length;
  const h = snap.hMod;
  const t = n(f.block, 150) / 1000;
  const perM2 = 1 / (0.45 * 0.225);
  const mortarPerM2 = t * (1 - perM2 * 0.44 * 0.215);
  const waste = 1 + n(f.waste, 5) / 100;
  const blockWaste = 1.03; // breakage only: modular walls need no cutting
  const extPer = 2 * (bw + bl);

  const win = { W0: 0, W1: 0, W2: 0, W3: 0 };
  let ventN = 0;
  const tiledRooms = [];
  let innerDoors = 0, mainDoors = 0, doorFrameM = 0, floorArea = 0, points = 0, wc = 0, sinks = 0, laundryN = 0;
  let netWall = 0, wetWall = 0, skirt = 0;
  floors.forEach((fl) => {
    let open = 0;
    fl.rooms.forEach((rm) => {
      floorArea += rm.area;
      if (rm.type !== 'stairs') tiledRooms.push(rm);
      const pp = roomPoints(rm);
      points += pp.lights + pp.sockets;
      rm.doors.forEach((d) => {
        if (d.main) mainDoors++; else innerDoors++;
        if (d.vent) ventN++;
        open += d.w * 2.25; doorFrameM += 2 * 2.1 + d.w;
      });
      rm.windows.forEach((w) => { win[w.id]++; open += w.w * w.h; });
      if (rm.type === 'bath') { wc++; wetWall += 2 * (rm.w + rm.h) * 2.1; }
      if (rm.type === 'kitchen') { sinks++; wetWall += 2 * (rm.w + rm.h) * 0.6; }
      if (rm.type === 'laundry') { laundryN++; wetWall += 2 * (rm.w + rm.h) * 0.6; }
      if (rm.type !== 'stairs' && rm.type !== 'passage') skirt += 2 * (rm.w + rm.h);
    });
    netWall += Math.max(0, (extPer + fl.intLen) * h - open);
  });
  const winArea = WIN_STD.reduce((a, s) => a + win[s.id] * s.w * s.h, 0);
  const winCount = WIN_STD.reduce((a, s2) => a + win[s2.id], 0);

  // Substructure and frame quantities
  const groundLen = extPer + floors[0].intLen;
  const excavation = groundLen * 0.6 * 0.9;
  const footing = groundLen * 0.6 * 0.25;
  const foundArea = groundLen * 0.6;
  const slabG = footArea * 0.1;
  const hardcore = footArea * 0.2;
  const meshSheets = Math.ceil(footArea / 10.1);
  const beamV = floors.reduce((a, fl) => a + (extPer + fl.intLen) * 0.2 * 0.15, 0);
  const colN = Math.max(4, Math.ceil(extPer / 3.5));
  const colV = colN * 0.04 * h * ns;
  const slabU = (ns - 1) * footArea * 0.15;
  const concSub = footing + slabG, concSup = beamV + colV + slabU;
  const bagsM = (area) => ((area * mortarPerM2 * 1.33) / 5) * 28.8;
  const sandM = (area) => (area * mortarPerM2 * 1.33 * 4) / 5;
  const blocksF = Math.ceil(foundArea * perM2 * blockWaste);
  const blocksW = Math.ceil(netWall * perM2 * blockWaste);
  const cementSub = Math.ceil((concSub * 6.3 + bagsM(foundArea)) * waste);
  const sandSub = (concSub * 0.44 + sandM(foundArea)) * waste;
  const aggSub = concSub * 0.88 * waste;
  const steelSub = footing * 40 * waste;
  const cementSup = Math.ceil((concSup * 6.3 + bagsM(netWall)) * waste);
  const sandSup = (concSup * 0.44 + sandM(netWall)) * waste;
  const aggSup = concSup * 0.88 * waste;
  const steelSup = (beamV * 150 + colV * 120 + slabU * 100) * waste;

  // Roof: simple gable over the bounding rectangle, ridge along the long side.
  // Eaves and gables are tuned so sheets are used at full length and width.
  const pitch = (n(f.pitch, 20) * Math.PI) / 180;
  const span = Math.min(bw, bl), long = Math.max(bw, bl);
  const ovh0 = n(f.overhang, 0.6);
  const need = (span / 2 + ovh0) / Math.cos(pitch);
  let combo = null;
  SHEET_LENS.forEach((a) => {
    const cands = [{ eff: a, pieces: [a] }];
    SHEET_LENS.forEach((b) => { if (b >= a) cands.push({ eff: a + b - 0.15, pieces: [a, b] }); });
    cands.forEach((c) => {
      if (c.eff < need - 1e-6) return;
      const better = !combo || c.eff < combo.eff - 1e-6 || (Math.abs(c.eff - combo.eff) < 1e-6 && c.pieces.length < combo.pieces.length);
      if (better) combo = c;
    });
  });
  if (!combo) combo = { eff: need, pieces: [Math.ceil(need * 10) / 10] };
  const slopeLen = combo.eff;
  const ovhEave = slopeLen * Math.cos(pitch) - span / 2;
  const sheetsAcross = Math.ceil((long + 2 * ovh0) / SHEET_COVER - 1e-6);
  const ridgeLen = sheetsAcross * SHEET_COVER;
  const ovhGable = (ridgeLen - long) / 2;
  const sheetQty = {};
  combo.pieces.forEach((len) => { sheetQty[len] = (sheetQty[len] || 0) + 2 * sheetsAcross; });
  const nTruss = Math.ceil(long / 1.2) + 1;
  const timberRaw = nTruss * (2 * slopeLen + span * 1.3) + 2 * (Math.ceil(slopeLen / 0.9) + 1) * ridgeLen;
  const timberM = Math.ceil(timberRaw * waste);
  const fasciaM = Math.ceil(2 * (ridgeLen + span + 2 * ovhEave));

  // Finishes
  const plasterArea = 2 * netWall;
  const plasterV = plasterArea * 0.015;
  const screedV = floorArea * 0.04;
  const cementFin = Math.ceil(((plasterV * 1.4 / 5) * 28.8 + (screedV * 1.33 / 4) * 28.8) * waste);
  const sandFin = (plasterV * 1.4 * 4 / 5 + screedV * 1.33 * 3 / 4) * waste;
  const tileRooms = finish === 'basic' ? tiledRooms.filter((r) => r.type === 'bath' || r.type === 'kitchen') : tiledRooms;
  const tile = bestTileFor(tileRooms);
  const tiledArea = tileRooms.reduce((a, r) => a + r.area, 0);
  const tileWastePct = tiledArea ? (tile.area / tiledArea - 1) * 100 : 0;
  const wallTileArea = finish === 'basic' ? 0 : wetWall;
  const paintArea = Math.max(0, plasterArea - wallTileArea) + (finish === 'basic' ? 0 : floorArea);
  const coats = finish === 'luxury' ? 3 : 2;
  const paintL = Math.ceil((paintArea * coats) / 10);

  const extraNotes = [];
  const lines = [];
  const add = (sec, item, unit, qty, key, note, amt) => {
    lines.push({
      sec, item, unit, qty, rate: key ? rt(key) : 0,
      amount: amt !== undefined ? amt : key ? qty * rt(key) : 0, note,
    });
  };
  const r1 = (x) => Math.round(x * 10) / 10;
  const grade = { basic: 'basic grade, 0.75 × standard price', standard: 'standard grade', luxury: 'luxury grade, 1.7 × standard price' }[finish];

  add('Substructure', 'Excavation, strip footings', 'm³', r1(excavation), 'excavation');
  add('Substructure', 'Hardcore under ground slab', 'm³', r1(hardcore), 'hardcore');
  add('Substructure', 'Foundation blocks to DPC', 'each', blocksF, 'block', `${fmt(foundArea)} m² of walling`);
  add('Substructure', 'Cement', 'bag', cementSub, 'cement', `Footings ${fmt(footing, 1)} m³, ground slab ${fmt(slabG, 1)} m³, foundation mortar`);
  add('Substructure', 'Sand', 'm³', r1(sandSub), 'sand');
  add('Substructure', 'Aggregate', 'm³', r1(aggSub), 'aggregate');
  add('Substructure', 'Reinforcement steel', 'kg', Math.ceil(steelSub), 'steel');
  add('Substructure', 'Slab mesh', 'sheet', meshSheets, 'mesh', `${fmt(footArea)} m² of slab with laps`);

  add('Superstructure', `Wall blocks, ${f.block} mm`, 'each', blocksW, 'block', `${fmt(netWall)} m² of wall after openings. 3% breakage, no cutting loss`);
  add('Superstructure', 'Cement', 'bag', cementSup, 'cement', `Ring beams, ${colN * ns} columns${ns > 1 ? ', upper slabs' : ''}, wall mortar`);
  add('Superstructure', 'Sand', 'm³', r1(sandSup), 'sand');
  add('Superstructure', 'Aggregate', 'm³', r1(aggSup), 'aggregate');
  add('Superstructure', 'Reinforcement steel', 'kg', Math.ceil(steelSup), 'steel');

  Object.keys(sheetQty).forEach((len) => {
    add('Roof', `Roof sheet, ${len} m`, 'sheet', sheetQty[len], 'roofSheet', 'Priced pro rata to a 3 m sheet', sheetQty[len] * rt('roofSheet') * (Number(len) / 3));
  });
  add('Roof', 'Roof timber, trusses and purlins', 'm', timberM, 'timber', `${nTruss} trusses at 1.2 m, purlins at 0.9 m`);
  add('Roof', 'Ridge cap', 'm', Math.ceil(ridgeLen), 'ridge');
  add('Roof', 'Fascia board', 'm', fasciaM, 'fascia');

  const ver = snap.veranda;
  if (ver) {
    const posts = Math.ceil(ver.w / 2.7) + 1;
    const vConc = ver.w * ver.d * 0.1 + posts * 0.04 * 2.7 + ver.w * 0.03;
    const vRoof = (ver.w * (ver.d + 0.3)) / Math.cos(pitch);
    const vTiles = Math.ceil(ver.w * ver.d * 1.1);
    add('Veranda', 'Cement', 'bag', Math.ceil(vConc * 6.3 * waste), 'cement', `Slab, ${posts} posts and a beam, ${fmt(vConc, 1)} m³ of concrete`);
    add('Veranda', 'Sand', 'm³', r1(vConc * 0.44 * waste), 'sand');
    add('Veranda', 'Aggregate', 'm³', r1(vConc * 0.88 * waste), 'aggregate');
    add('Veranda', 'Reinforcement steel', 'kg', Math.ceil(vConc * 80 * waste), 'steel');
    add('Veranda', `Floor tiles, ${tile.ts} × ${tile.ts} m`, 'm²', vTiles, null, grade, vTiles * rk('tile'));
    const vSheets = Math.ceil((vRoof / (3 * SHEET_COVER)) * 1.05);
    add('Veranda', 'Roof sheets, 3 m', 'sheet', vSheets, 'roofSheet', `${fmt(vRoof)} m² of roof, a continuation of the main slope`);
    add('Veranda', 'Roof timber', 'm', Math.ceil(vRoof * 2.2 * waste), 'timber');
    add('Veranda', 'Fascia board', 'm', Math.ceil(ver.w + 2 * ver.d), 'fascia');
    extraNotes.push(`Veranda: ${fmt(ver.w, 2)} × ${fmt(ver.d, 2)} m on ${posts} posts, roofed with whole 3 m sheets as a continuation of the main roof.`);
  }

  add('Doors', 'Interior door leaves', 'each', innerDoors, null, `${DOOR_W} × 2.1 m, ${grade}`, innerDoors * rk('doorLeaf'));
  add('Doors', 'Main door, solid', 'each', mainDoors, null, `${MAIN_W} × 2.1 m, ${grade}`, mainDoors * rk('doorMain'));
  add('Doors', 'Door frames, timber', 'm', Math.ceil(doorFrameM), 'doorFrame', 'Two sides and head of every opening');
  add('Doors', 'Locks, hinges and handles', 'set', innerDoors + mainDoors, 'ironmongery');
  if (ventN) add('Doors', 'Vent grilles above doors', 'each', ventN, 'ventGrille', '0.9 × 0.3 m. Lets air pass from the room into the passage and out of its end window');

  WIN_STD.forEach((s) => {
    if (win[s.id]) add('Windows', `Window frame ${s.w} × ${s.h} m`, 'each', win[s.id], null, grade, win[s.id] * s.w * s.h * rk('windowFrame'));
  });
  add('Windows', `Glass, ${finish === 'basic' ? '4 mm clear' : finish === 'luxury' ? '6 mm toughened' : '5 mm clear'}`, 'm²', r1(winArea), null, `${winCount} windows`, winArea * rk('glass'));
  add('Windows', 'Window stays and latches', 'set', winCount, 'winHardware');

  add('Finishes', 'Cement, plaster and floor screed', 'bag', cementFin, 'cement');
  add('Finishes', 'Sand, plaster and floor screed', 'm³', r1(sandFin), 'sand');
  if (tiledArea) {
    add('Finishes', `Floor tiles, ${tile.ts} × ${tile.ts} m`, 'm²', Math.ceil(tile.area * 1.03), null,
      `${finish === 'basic' ? 'Bathrooms and kitchen only, other floors are sealed screed. ' : ''}About ${fmt(tileWastePct)}% cutting allowance plus 3% breakage, ${grade}`,
      Math.ceil(tile.area * 1.03) * rk('tile'));
  }
  if (wallTileArea) add('Finishes', 'Wall tiles, bathrooms and kitchen', 'm²', Math.ceil(wallTileArea * 1.1), null, 'Bathrooms to 2.1 m, kitchen splashback to 0.6 m', Math.ceil(wallTileArea * 1.1) * rk('wallTile'));
  if (finish !== 'basic') {
    add('Finishes', finish === 'luxury' ? 'Gypsum ceiling board' : 'Ceiling board', 'm²', Math.ceil(floorArea * 1.05), null, grade, Math.ceil(floorArea * 1.05) * rk('ceiling'));
    add('Finishes', 'Ceiling brandering, timber', 'm', Math.ceil(floorArea * 1.8), 'timber');
  }
  if (finish === 'luxury') add('Finishes', 'Timber skirting', 'm', Math.ceil(skirt), null, grade, Math.ceil(skirt) * rk('skirting'));
  add('Finishes', `Paint, ${coats} coats`, 'L', paintL, null, `${fmt(paintArea)} m² of wall${finish === 'basic' ? '' : ' and ceiling'}, ${grade}`, paintL * rk('paint'));

  const sv = snap.services;
  add('Plumbing', 'WC sets', 'each', wc, null, grade, wc * rk('wc'));
  add('Plumbing', 'Basins', 'each', wc, null, grade, wc * rk('basin'));
  add('Plumbing', 'Kitchen sinks', 'each', sinks, null, grade, sinks * rk('sink'));
  if (laundryN) add('Plumbing', 'Laundry sinks', 'each', laundryN, null, grade, laundryN * rk('sink'));
  add('Plumbing', 'Water pipe 20 mm, 4 m lengths', 'each', Math.ceil(sv.supply / 4), 'pipe20', `${fmt(sv.supply)} m of supply run measured from the layout`);
  add('Plumbing', 'Waste pipe 50 mm, 3 m lengths', 'each', Math.ceil(sv.waste / 3), 'pipe50', `${fmt(sv.waste)} m`);
  add('Plumbing', 'Soil pipe 110 mm, 6 m lengths', 'each', Math.ceil(sv.soil / 6), 'pipe110', `${fmt(sv.soil)} m to the nearest outside wall`);
  add('Plumbing', 'Pipe fittings', 'each', wc + sinks + laundryN, 'plumbFit', 'One set per wet room');

  add('Electrical', 'Electrical points', 'each', points, 'point', 'Lights and sockets');
  add('Electrical', 'Cable 1.5 mm² (lights), 100 m rolls', 'roll', Math.ceil(sv.l15 / 100), 'cable15', `${fmt(sv.l15)} m needed`);
  add('Electrical', 'Cable 2.5 mm² (sockets), 100 m rolls', 'roll', Math.ceil(sv.l25 / 100), 'cable25', `${fmt(sv.l25)} m needed`);
  add('Electrical', 'Conduit 20 mm, 3 m lengths', 'each', Math.ceil(sv.conduit / 3), 'conduit');
  add('Electrical', 'Distribution board', 'each', 1, 'db');

  if (f.furnBoq) {
    const cnt = {}, len = {};
    floors.forEach((fl) => fl.rooms.forEach((r) => (r.furn || []).forEach((it) => {
      cnt[it.k] = (cnt[it.k] || 0) + 1;
      len[it.k] = (len[it.k] || 0) + Math.max(it.w, it.h);
    })));
    const row = (item, k, key) => { if (cnt[k]) add('Furniture', item, 'each', cnt[k], key, 'Sizes as drawn on the plan'); };
    row('Double beds with mattress', 'bed2', 'bedDouble');
    row('Single beds with mattress', 'bed1', 'bedSingle');
    row('Bedside tables', 'bedtable', 'bedside');
    if (len.wardrobe) add('Furniture', 'Wardrobes', 'm', r1(len.wardrobe), 'wardrobe', '0.6 m deep');
    row('Sofa sets', 'sofa', 'sofa');
    row('Coffee tables', 'table', 'coffee');
    row('TV units', 'tv', 'tvUnit');
    row('Dining tables', 'dtable', 'diningTable');
    row('Chairs', 'chair', 'chair');
    if (len.counter) add('Furniture', 'Kitchen cabinets and worktop', 'm', r1(len.counter), 'kitchenCab', '0.6 m deep');
    row('Desks', 'desk', 'desk');
    row('Shelving units', 'shelf', 'shelf');
  }

  const roofA = 2 * slopeLen * ridgeLen;
  if (f.septic !== false) {
    const persons = Math.max(4, Math.round(n(f.bedrooms, 3)) * 2);
    const sepV = (180 * persons + 2000) / 1000;
    const sw = Math.ceil(Math.sqrt(sepV / 1.5 / 2) / MOD) * MOD;
    const sl = 2 * sw;
    const wallLen = 2 * (sl + sw) + sw;
    const wallA = wallLen * 1.8;
    const sBlocks = Math.ceil(wallA * perM2 * blockWaste);
    const sMortar = wallA * mortarPerM2;
    const sConc = (sl + 0.5) * (sw + 0.5) * 0.15 + (sl + 0.3) * (sw + 0.3) * 0.1;
    const sRender = wallA * 0.02;
    const sCement = Math.ceil((sConc * 6.3 + ((sMortar * 1.33) / 5) * 28.8 + ((sRender * 1.4) / 4) * 28.8) * waste);
    const sSand = (sConc * 0.44 + (sMortar * 1.33 * 4) / 5 + (sRender * 1.4 * 3) / 4) * waste;
    const soakD = Math.max(2, Math.ceil((0.5 * persons) / 4 / 0.5) * 0.5);
    add('External works', 'Septic tank excavation', 'm³', r1((sl + 0.9) * (sw + 0.9) * 2.1), 'excavation', `${persons} people: ${fmt(sepV, 1)} m³ tank, ${fmt(sl, 1)} × ${fmt(sw, 1)} m inside`);
    add('External works', 'Septic tank blocks', 'each', sBlocks, 'block', `${fmt(wallA)} m² of walling, 1.8 m deep, with a baffle wall`);
    add('External works', 'Septic tank cement', 'bag', sCement, 'cement', 'Base and cover slabs, mortar and waterproof render');
    add('External works', 'Septic tank sand', 'm³', r1(sSand), 'sand');
    add('External works', 'Septic tank aggregate', 'm³', r1(sConc * 0.88 * waste), 'aggregate');
    add('External works', 'Septic tank steel', 'kg', Math.ceil(sConc * 60 * waste), 'steel');
    add('External works', 'Soakaway excavation', 'm³', r1(2.4 * 2.4 * (soakD + 0.3)), 'excavation', `2 × 2 m pit, ${fmt(soakD, 1)} m deep`);
    add('External works', 'Soakaway fill, hardcore or rubble', 'm³', r1(4 * soakD), 'hardcore');
    extraNotes.push(`Septic tank: sized for ${persons} people at 180 L each plus 2,000 L, so ${fmt(sepV, 1)} m³, with a soakaway pit. Ask your local authority about distance from boundaries and wells.`);
  }
  if (f.rain) {
    const tanks = Math.min(5, Math.max(1, Math.ceil(roofA * 0.03)));
    add('External works', 'Gutter', 'm', Math.ceil(2 * ridgeLen), 'gutter');
    add('External works', 'Downpipes', 'm', Math.ceil(2 * (h * ns + 0.6)), 'downpipe');
    add('External works', 'Rainwater tank, 1,000 L', 'each', tanks, 'tank1000', `${fmt(roofA)} m² of roof, about 30 mm of rain stored`);
    extraNotes.push(`Rainwater: gutters on both long eaves feed ${tanks} tank${tanks === 1 ? '' : 's'} of 1,000 L, enough for about 30 mm of rain off your ${fmt(roofA)} m² roof.`);
  }

  const sections = [];
  lines.forEach((l) => {
    let s = sections.find((x) => x.name === l.sec);
    if (!s) { s = { name: l.sec, lines: [], total: 0 }; sections.push(s); }
    s.lines.push(l); s.total += l.amount;
  });
  const materials = lines.reduce((a, l) => a + l.amount, 0);
  const labour = materials * (n(f.labour, 35) / 100);
  const contingency = (materials + labour) * (n(f.contingency, 10) / 100);
  const total = materials + labour + contingency;

  const winKinds = WIN_STD.filter((s) => win[s.id]).length;
  const design = [
    `Walls: ${fmt(bw, 2)} × ${fmt(bl, 2)} m footprint, ${snap.courses} courses high (${fmt(h, 3)} m), every room and partition on a 0.225 m grid. Blocks go in whole or half, so none are cut.`,
    `Openings: ${innerDoors + mainDoors} doors in 2 sizes and ${winCount} windows in ${winKinds} size${winKinds === 1 ? '' : 's'}, all on the grid with heads at the same course. Windows sit on outside walls, and rooms with two opposite outside walls get a window on each for cross-ventilation.`,
    ventN ? `Ventilation: ${ventN} grilles above doors and windows at the ends of the passage give rooms with windows on one wall a way to ventilate across.` : 'Ventilation: rooms rely on windows on opposite walls.',
    'Circulation: every room opens onto the passage, which links the living room to the bedrooms. Nobody walks through the kitchen to reach a bedroom.',
    `Roof: ${combo.pieces.map((p) => p + ' m').join(' + ')} sheets run eave to ridge, ${sheetsAcross} sheets across each slope. Eaves are ${fmt(ovhEave, 2)} m and gables ${fmt(ovhGable, 2)} m, so no sheet is cut.`,
    tiledArea ? `Floor: ${tile.ts} × ${tile.ts} m tiles cut least across your rooms (about ${fmt(tileWastePct)}% cutting allowance).` : 'Floor: sealed screed throughout.',
    `Electrical: the distribution board sits ${fmt(sv.db.x, 2)} m from the left wall on the passage line, the spot with the least cable.${sv.savingPct >= 1 ? ` That saves about ${fmt(sv.savingPct)}% against putting it at the entrance wall.` : ' The entrance wall would use about the same.'} Lights and sockets are chained room to room, not run separately back to the board.`,
    `Pipes: ${fmt(sv.supply)} m supply, ${fmt(sv.waste)} m waste and ${fmt(sv.soil)} m soil pipe, bought in standard lengths. ${floors.every((fl) => fl.wetBands <= 1) ? 'Bathrooms sit side by side, so their soil and supply pipes run together.' : 'Bathrooms are spread over more than one wall line, which lengthens the pipe runs.'}`,
    ...extraNotes,
  ];

  return {
    sections, materials, labour, contingency, total, floorArea, design,
    perM2: floorArea ? total / floorArea : 0,
    steelTons: (steelSub + steelSup) / 1000,
  };
}

function buildReport(snap, boq, cur) {
  const f = snap.form;
  const out = [];
  out.push(`${f.name || 'Project'}: Blueprint and BoQ`);
  out.push(`Plot ${snap.plotW} × ${snap.L} m, building ${fmt(snap.bw, 2)} × ${fmt(snap.bl, 2)} m${snap.notch ? ' (L-shaped)' : ''}, ${snap.floors.length} storey(s), ${f.finish || 'standard'} finish`);
  out.push(`Street side: ${snap.street}. Floor area ${fmt(boq.floorArea)} m².`);
  out.push('');
  snap.floors.forEach((fl) => {
    out.push(fl.label);
    fl.rooms.filter((r) => r.type !== 'passage').forEach((r) => {
      out.push(`  ${r.name}: ${fmt(r.w, 2)} × ${fmt(r.h, 2)} m, ${fmt(r.area, 1)} m²${r.wing ? (r.wing === 'M' ? ' (male wing)' : ' (female wing)') : ''}`);
    });
  });
  out.push('');
  out.push('Waste designed out');
  boq.design.forEach((d) => out.push('  ' + d));
  out.push('');
  boq.sections.forEach((s) => {
    out.push(`${s.name}: ${cur} ${fmt(s.total)}`);
    s.lines.forEach((l) => out.push(`  ${l.item}: ${fmt(l.qty, l.qty % 1 ? 1 : 0)} ${l.unit} = ${cur} ${fmt(l.amount)}`));
  });
  out.push('');
  out.push(`Materials: ${cur} ${fmt(boq.materials)}`);
  out.push(`Labour: ${cur} ${fmt(boq.labour)}`);
  out.push(`Contingency: ${cur} ${fmt(boq.contingency)}`);
  out.push(`Total: ${cur} ${fmt(boq.total)} (${cur} ${fmt(boq.perM2)} per m²)`);
  out.push('');
  out.push('Planning estimate only. Have an engineer and a quantity surveyor check it before you build.');
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */
const Field = ({ label, value, onChangeText, suffix, keyboardType = 'decimal-pad', style }) => (
  <View style={[s.field, style]}>
    <Text style={s.label}>{label}</Text>
    <View style={s.inputWrap}>
      <TextInput style={s.input} value={String(value)} onChangeText={onChangeText} keyboardType={keyboardType} />
      {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
    </View>
  </View>
);

const Toggle = ({ label, hint, value, onChange }) => (
  <View style={s.switchRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
    <Switch value={!!value} onValueChange={onChange} trackColor={{ true: C.primary }} thumbColor={value ? C.stake : '#ECEFF0'} />
  </View>
);

const Seg = ({ options, value, onChange }) => (
  <View style={s.seg}>
    {options.map((o) => (
      <TouchableOpacity key={o.v} onPress={() => onChange(o.v)} style={[s.segItem, value === o.v && s.segOn]}>
        <Text style={[s.segText, value === o.v && s.segTextOn]}>{o.l}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const Step = ({ label, value, onChange, min = 0, max = 12 }) => {
  const v = Math.round(n(value));
  return (
    <View style={[s.field, { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepper}>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(String(Math.max(min, v - 1)))}>
          <Text style={s.stepTxt}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepVal}>{v}</Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(String(Math.min(max, v + 1)))}>
          <Text style={s.stepTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Sec = ({ title, children }) => (
  <View style={s.sec}>
    <Text style={s.secTitle}>{title}</Text>
    {children}
  </View>
);

const Empty = ({ onGo }) => (
  <View style={s.sec}>
    <Text style={s.secTitle}>No design yet</Text>
    <Text style={s.body}>Enter your plot on the Site tab, then press Generate design.</Text>
    <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={onGo}>
      <Text style={s.btnTxt}>Go to Site</Text>
    </TouchableOpacity>
  </View>
);

/* ------------------------------------------------------------------ */
/*  Plan drawing                                                       */
/* ------------------------------------------------------------------ */
const FURN_FILL = {
  bed1: '#FFFFFF', bed2: '#FFFFFF', bedtable: '#E8DFCF', wardrobe: '#DDD5C4', sofa: '#C6D3DA', table: '#EEE6D2',
  tv: '#9AA8AE', dtable: '#EEE6D2', chair: '#F5F1E6', counter: '#E3E7E1', sink: '#FFFFFF', cooker: '#C9CED0',
  fridge: '#F2F4F4', wc: '#FFFFFF', basin: '#FFFFFF', shower: '#E3F0F6', washer: '#F2F4F4', lsink: '#FFFFFF',
  desk: '#E8DFCF', shelf: '#DDD5C4',
};

function drawFurn(it, rx, ry, key) {
  const x = rx + it.x, y = ry + it.y;
  const line = '#6F8187';
  if (it.k === 'steps') {
    const vert = it.h >= it.w;
    const cnt = Math.max(2, Math.floor((vert ? it.h : it.w) / 0.27));
    const lines = [];
    for (let i = 0; i <= cnt; i++) {
      const o = (i * (vert ? it.h : it.w)) / cnt;
      lines.push(vert
        ? <Line key={i} x1={x} y1={y + o} x2={x + it.w} y2={y + o} stroke={line} strokeWidth={0.03} />
        : <Line key={i} x1={x + o} y1={y} x2={x + o} y2={y + it.h} stroke={line} strokeWidth={0.03} />);
    }
    return <G key={key}><Rect x={x} y={y} width={it.w} height={it.h} fill="none" stroke={line} strokeWidth={0.04} />{lines}</G>;
  }
  let extra = null;
  if (it.k === 'bed1' || it.k === 'bed2') {
    extra = it.side === 'B' ? <Line x1={x} y1={y + 0.45} x2={x + it.w} y2={y + 0.45} stroke={line} strokeWidth={0.03} />
      : it.side === 'F' ? <Line x1={x} y1={y + it.h - 0.45} x2={x + it.w} y2={y + it.h - 0.45} stroke={line} strokeWidth={0.03} />
        : it.side === 'Lf' ? <Line x1={x + 0.45} y1={y} x2={x + 0.45} y2={y + it.h} stroke={line} strokeWidth={0.03} />
          : <Line x1={x + it.w - 0.45} y1={y} x2={x + it.w - 0.45} y2={y + it.h} stroke={line} strokeWidth={0.03} />;
  } else if (it.k === 'cooker') {
    extra = [0.3, 0.7].flatMap((a) => [0.3, 0.7].map((b) => <Circle key={a + '-' + b} cx={x + it.w * a} cy={y + it.h * b} r={0.07} fill="none" stroke={line} strokeWidth={0.03} />));
  } else if (it.k === 'basin' || it.k === 'lsink' || it.k === 'sink') {
    extra = <Circle cx={x + it.w / 2} cy={y + it.h / 2} r={Math.min(it.w, it.h) * 0.28} fill="none" stroke={line} strokeWidth={0.03} />;
  } else if (it.k === 'wc') {
    extra = <Circle cx={x + it.w / 2} cy={y + it.h / 2} r={0.13} fill="none" stroke={line} strokeWidth={0.03} />;
  } else if (it.k === 'shower') {
    extra = <Line x1={x} y1={y} x2={x + it.w} y2={y + it.h} stroke={line} strokeWidth={0.03} />;
  }
  return (
    <G key={key}>
      <Rect x={x} y={y} width={it.w} height={it.h} fill={FURN_FILL[it.k] || '#fff'} fillOpacity={0.9} stroke={line} strokeWidth={0.03} />
      {extra}
    </G>
  );
}

function PlanSvg({ snap, floorIdx, showFurn }) {
  const { W, L, rear, side, bw, bl, street, notch } = snap;
  const rooms = snap.floors[floorIdx].rooms;
  const hub = snap.floors[0].rooms.find((r) => r.type === 'passage') || snap.floors[0].rooms[0];
  const outline = !notch ? [[0, 0], [bw, 0], [bw, bl], [0, bl]]
    : notch.side === 'R' ? [[0, 0], [bw - notch.w, 0], [bw - notch.w, notch.d], [bw, notch.d], [bw, bl], [0, bl]]
      : [[notch.w, 0], [bw, 0], [bw, bl], [0, bl], [0, notch.d], [notch.w, notch.d]];
  const M = 2, T = 2.2;
  const vbW = W + M * 2, vbH = L + T + 1.8;
  const { width: winW } = useWindowDimensions();
  const px = Math.min(winW - 32, 688);
  const ox = M + side, oy = T + rear;
  const rot = -((BEAR[street] + 180) % 360);
  const fillFor = (r) => (r.wing === 'M' ? C.wingM : r.wing === 'F' ? C.wingF : C.zone[r.zone]);

  return (
    <Svg width={px} height={(px * vbH) / vbW} viewBox={`0 0 ${vbW} ${vbH}`}>
      {/* plot */}
      <Rect x={M} y={T} width={W} height={L} fill={C.surface} stroke={C.ink} strokeWidth={0.08} />
      {/* street */}
      <Rect x={M} y={T + L + 0.15} width={W} height={0.9} fill="#C5D1D4" />
      <SvgText x={M + W / 2} y={T + L + 0.8} fontSize={0.5} fill={C.ink} textAnchor="middle">
        {`Street (${street} side)`}
      </SvgText>
      {/* width dimension */}
      <Line x1={M} y1={T - 0.6} x2={M + W} y2={T - 0.6} stroke={C.sub} strokeWidth={0.04} />
      <Line x1={M} y1={T - 0.8} x2={M} y2={T - 0.4} stroke={C.sub} strokeWidth={0.04} />
      <Line x1={M + W} y1={T - 0.8} x2={M + W} y2={T - 0.4} stroke={C.sub} strokeWidth={0.04} />
      <SvgText x={M + W / 2} y={T - 0.8} fontSize={0.5} fill={C.sub} textAnchor="middle">{`${fmt(W, 1)} m`}</SvgText>
      {/* length dimension */}
      <Line x1={M - 0.6} y1={T} x2={M - 0.6} y2={T + L} stroke={C.sub} strokeWidth={0.04} />
      <Line x1={M - 0.8} y1={T} x2={M - 0.4} y2={T} stroke={C.sub} strokeWidth={0.04} />
      <Line x1={M - 0.8} y1={T + L} x2={M - 0.4} y2={T + L} stroke={C.sub} strokeWidth={0.04} />
      <G transform={`rotate(-90 ${M - 0.8} ${T + L / 2})`}>
        <SvgText x={M - 0.8} y={T + L / 2} fontSize={0.5} fill={C.sub} textAnchor="middle">{`${fmt(L, 1)} m`}</SvgText>
      </G>
      {/* rooms */}
      {rooms.map((r, i) => {
        const x = ox + r.x, y = oy + r.y;
        const fs = Math.max(0.2, Math.min(0.55, r.w / (r.short.length * 0.62), r.h / 1.7));
        const showArea = r.type !== 'passage' && r.h >= 1.6 && r.w >= 1.8;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={r.w} height={r.h} fill={fillFor(r)} stroke={C.ink} strokeWidth={0.06} />
            {showFurn ? (r.furn || []).map((it, k) => drawFurn(it, x, y, k)) : null}
            {showFurn && r.furn && r.furn.length && r.type !== 'passage' ? (
              <Rect x={x + r.w / 2 - (r.short.length * fs * 0.62) / 2 - 0.1} y={y + r.h / 2 - fs * 1.0} width={r.short.length * fs * 0.62 + 0.2} height={showArea ? fs * 2.3 : fs * 1.4} fill={fillFor(r)} fillOpacity={0.8} />
            ) : null}
            <SvgText x={x + r.w / 2} y={y + r.h / 2 + (showArea ? -0.05 : fs * 0.35) + (r.type === 'passage' ? 0.2 : 0)} fontSize={fs} fill={C.ink} textAnchor="middle" fontWeight="bold">
              {r.short}
            </SvgText>
            {showArea ? (
              <SvgText x={x + r.w / 2} y={y + r.h / 2 + fs * 0.95} fontSize={fs * 0.8} fill={C.sub} textAnchor="middle">
                {`${fmt(r.area, 1)} m²`}
              </SvgText>
            ) : null}
          </G>
        );
      })}
      {/* outer walls */}
      <Polygon points={outline.map(([px2, py2]) => `${ox + px2},${oy + py2}`).join(' ')} fill="none" stroke={C.ink} strokeWidth={0.22} />
      {/* windows and doors */}
      {rooms.map((r, i) => {
        const edge = (side, a, len) => {
          if (side === 'F') return { x1: ox + r.x + a, y1: oy + r.y + r.h, nx: 0, ny: -1, hz: true };
          if (side === 'B') return { x1: ox + r.x + a, y1: oy + r.y, nx: 0, ny: 1, hz: true };
          if (side === 'Lf') return { x1: ox + r.x, y1: oy + r.y + a, nx: 1, ny: 0, hz: false };
          return { x1: ox + r.x + r.w, y1: oy + r.y + a, nx: -1, ny: 0, hz: false };
        };
        return (
          <G key={'o' + i}>
            {r.windows.map((wd, k) => {
              const e = edge(wd.side, wd.a, wd.w);
              return (
                <G key={'w' + k}>
                  <Rect x={e.hz ? e.x1 : e.x1 - 0.1} y={e.hz ? e.y1 - 0.1 : e.y1} width={e.hz ? wd.w : 0.2} height={e.hz ? 0.2 : wd.w} fill="#fff" />
                  <Line x1={e.hz ? e.x1 : e.x1 - 0.05} y1={e.hz ? e.y1 - 0.05 : e.y1} x2={e.hz ? e.x1 + wd.w : e.x1 - 0.05} y2={e.hz ? e.y1 - 0.05 : e.y1 + wd.w} stroke="#2C7DA0" strokeWidth={0.05} />
                  <Line x1={e.hz ? e.x1 : e.x1 + 0.05} y1={e.hz ? e.y1 + 0.05 : e.y1} x2={e.hz ? e.x1 + wd.w : e.x1 + 0.05} y2={e.hz ? e.y1 + 0.05 : e.y1 + wd.w} stroke="#2C7DA0" strokeWidth={0.05} />
                </G>
              );
            })}
            {r.doors.map((d, k) => {
              const e = edge(d.side, d.a, d.w);
              return (
                <G key={'d' + k}>
                  <Rect x={e.hz ? e.x1 : e.x1 - 0.1} y={e.hz ? e.y1 - 0.1 : e.y1} width={e.hz ? d.w : 0.2} height={e.hz ? 0.2 : d.w} fill="#fff" />
                  <Line x1={e.x1} y1={e.y1} x2={e.x1 + e.nx * d.w} y2={e.y1 + e.ny * d.w} stroke={C.ink} strokeWidth={0.05} />
                  {d.main ? <Rect x={e.hz ? e.x1 : e.x1 - 0.07} y={e.hz ? e.y1 - 0.07 : e.y1} width={e.hz ? d.w : 0.14} height={e.hz ? 0.14 : d.w} fill={C.stake} /> : null}
                </G>
              );
            })}
          </G>
        );
      })}
      {floorIdx === 0 && snap.veranda ? (
        <G>
          <Rect x={ox + snap.veranda.x} y={oy + bl} width={snap.veranda.w} height={snap.veranda.d} fill="#EDEFE6" stroke={C.ink} strokeWidth={0.06} strokeDasharray="0.25 0.15" />
          <SvgText x={ox + snap.veranda.x + snap.veranda.w / 2} y={oy + bl + snap.veranda.d / 2 + 0.15} fontSize={0.45} fill={C.sub} textAnchor="middle">Veranda</SvgText>
          {Array.from({ length: Math.ceil(snap.veranda.w / 2.7) + 1 }).map((_, k, arr) => (
            <Rect key={k} x={ox + snap.veranda.x + (k * (snap.veranda.w - 0.2)) / (arr.length - 1)} y={oy + bl + snap.veranda.d - 0.2} width={0.2} height={0.2} fill={C.ink} />
          ))}
        </G>
      ) : null}
      {/* services */}
      {floorIdx === 0 ? (
        <G>
          <Circle cx={ox + bw / 2 + 1.3} cy={oy + bl} r={0.18} fill={C.primary} />
          <Rect x={ox + snap.services.db.x - 0.2} y={oy + hub.y + 0.08} width={0.4} height={0.4} fill="#fff" stroke={C.ink} strokeWidth={0.04} />
          <SvgText x={ox + snap.services.db.x} y={oy + hub.y + 0.37} fontSize={0.24} fill={C.ink} textAnchor="middle" fontWeight="bold">DB</SvgText>
        </G>
      ) : null}
      {/* north arrow */}
      <G transform={`translate(${vbW - 1} 1.25) rotate(${rot})`}>
        <Polygon points="0,-0.75 0.3,0.45 0,0.2 -0.3,0.45" fill={C.ink} />
        <SvgText x={0} y={-0.95} fontSize={0.45} fill={C.ink} textAnchor="middle" fontWeight="bold">N</SvgText>
      </G>
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
// Shows the error on screen instead of leaving a blank page.
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <View style={{ padding: 20, paddingTop: 60 }}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>Something went wrong</Text>
          <Text selectable style={{ marginTop: 8 }}>{String(this.state.err.message || this.state.err)}</Text>
          <Text selectable style={{ marginTop: 8, fontSize: 11 }}>{String(this.state.err.stack || '').slice(0, 700)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('error', (e) => {
    const d = document.createElement('pre');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff;color:#900;padding:12px;white-space:pre-wrap;font-size:12px';
    d.textContent = 'Error: ' + (e.message || e);
    document.body.appendChild(d);
  });
}

export default function App() {
  return (
    <Boundary>
      <Main />
    </Boundary>
  );
}

function Main() {
  const [tab, setTab] = useState('site');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [rates, setRates] = useState(defaultRates());
  const [currency, setCurrency] = useState('USD');
  const [snap, setSnap] = useState(null);
  const [floorIdx, setFloorIdx] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [factor, setFactor] = useState('1');
  const [actuals, setActuals] = useState({});
  const [showFurn, setShowFurn] = useState(true);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem('bp:projects');
        if (p) setProjects(JSON.parse(p));
        const r = await AsyncStorage.getItem('bp:rates');
        const ac = await AsyncStorage.getItem('bp:actuals');
        if (ac) setActuals(JSON.parse(ac));
        if (r) {
          const o = JSON.parse(r);
          if (o.rates) setRates((prev) => ({ ...prev, ...o.rates }));
          if (o.currency) setCurrency(o.currency);
        }
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem('bp:rates', JSON.stringify({ rates, currency })).catch(() => {});
  }, [rates, currency, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem('bp:actuals', JSON.stringify(actuals)).catch(() => {});
  }, [actuals, loaded]);

  const boq = useMemo(() => (snap ? computeBoQ(snap, rates) : null), [snap, rates]);

  const run = (f) => {
    const res = generate(f);
    if (res.error) { notify('Check your inputs', res.error); return false; }
    setSnap(res); setFloorIdx(0);
    return true;
  };
  const onGenerate = () => { if (run(form)) setTab('plan'); };

  const saveProject = async () => {
    const entry = { id: String(Date.now()), name: form.name || 'Untitled', savedAt: new Date().toISOString().slice(0, 10), form };
    const next = [entry, ...projects];
    setProjects(next);
    try { await AsyncStorage.setItem('bp:projects', JSON.stringify(next)); } catch (e) {}
    notify('Saved', `"${entry.name}" is saved on this device.`);
  };
  const loadProject = (p) => {
    setForm({ ...DEFAULT_FORM, ...p.form });
    if (run({ ...DEFAULT_FORM, ...p.form })) setTab('plan');
  };
  const deleteProject = async (id) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    try { await AsyncStorage.setItem('bp:projects', JSON.stringify(next)); } catch (e) {}
  };
  const sendText = async (title, message) => {
    if (Platform.OS !== 'web') { Share.share({ message }); return; }
    try {
      if (navigator.share) await navigator.share({ title, text: message });
      else { await navigator.clipboard.writeText(message); notify('Copied', 'Copied. Paste it into a message or document.'); }
    } catch (e) { /* share cancelled */ }
  };
  const share = () => {
    if (snap && boq) sendText(form.name || 'Blueprint and BoQ', buildReport(snap, boq, currency));
  };

  // Actual versus estimate
  const setActual = (id, k, v) => setActuals((p) => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }));
  let aEst = 0, aBought = 0, aWaste = 0, aCount = 0;
  const actualRows = boq ? boq.sections.map((sec) => ({
    name: sec.name,
    lines: sec.lines.map((l) => {
      const id = sec.name + '|' + l.item;
      const a = actuals[id] || {};
      const unit = l.qty ? l.amount / l.qty : 0;
      const b = a.bought === undefined || a.bought === '' ? null : n(a.bought);
      const u = a.used === undefined || a.used === '' ? null : n(a.used);
      if (b !== null) { aCount++; aEst += l.amount; aBought += b * unit; }
      if (b !== null && u !== null) aWaste += (b - u) * unit;
      return { id, l, a, b, u };
    }),
  })) : [];
  const shareActual = () => {
    const out = [`${form.name || 'Project'}: actual versus estimate`];
    actualRows.forEach((sec) => sec.lines.forEach((r) => {
      if (r.b === null) return;
      let t = `${r.l.item}: estimate ${fmt(r.l.qty, 1)} ${r.l.unit}, bought ${fmt(r.b, 1)}`;
      if (r.u !== null) t += `, used ${fmt(r.u, 1)}, waste ${fmt(r.b - r.u, 1)} (${r.b ? fmt(((r.b - r.u) / r.b) * 100, 1) : 0}%)`;
      out.push(t);
    }));
    out.push('', `Estimate for these items: ${currency} ${fmt(aEst)}`, `Actually bought: ${currency} ${fmt(aBought)}`, `Wasted: ${currency} ${fmt(aWaste)}`);
    sendText((form.name || 'Project') + ': actual versus estimate', out.join('\n'));
  };

  /* ---------------- Site tab ---------------- */
  const SiteTab = (
    <>
      <Sec title="Plot">
        <Field label="Project name" value={form.name} onChangeText={set('name')} keyboardType="default" />
        <View style={s.row}>
          <Field label="Width" value={form.width} onChangeText={set('width')} suffix="m" style={s.half} />
          <Field label="Length" value={form.length} onChangeText={set('length')} suffix="m" style={s.half} />
        </View>
        <Field label="Width at the back, if the plot narrows or widens (leave blank if the same)" value={form.width2} onChangeText={set('width2')} suffix="m" />
        <View style={s.row}>
          <Field label="Front setback" value={form.front} onChangeText={set('front')} suffix="m" style={s.third} />
          <Field label="Rear setback" value={form.rear} onChangeText={set('rear')} suffix="m" style={s.third} />
          <Field label="Side setback" value={form.side} onChangeText={set('side')} suffix="m" style={s.third} />
        </View>
        <Field label="Maximum plot coverage" value={form.maxCover} onChangeText={set('maxCover')} suffix="%" />
        <Text style={s.label}>Street is on the plot's</Text>
        <Seg value={form.street} onChange={set('street')} options={DIRS.map((d) => ({ v: d, l: d }))} />
      </Sec>

      <Sec title="Building">
        <Text style={s.label}>Storeys</Text>
        <Seg value={form.storeys} onChange={set('storeys')} options={[{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }]} />
        <Text style={[s.label, { marginTop: 12 }]}>Room sizes</Text>
        <Seg value={form.size} onChange={set('size')} options={[{ v: 'compact', l: 'Compact' }, { v: 'comfortable', l: 'Comfortable' }, { v: 'generous', l: 'Generous' }]} />
        <Text style={[s.label, { marginTop: 12 }]}>Building shape</Text>
        <Seg value={form.shape} onChange={set('shape')} options={[{ v: 'rect', l: 'Rectangle' }, { v: 'Lr', l: 'L, notch right' }, { v: 'Ll', l: 'L, notch left' }]} />
        <View style={[s.row, { marginTop: 12 }]}>
          <Step label="Bedrooms" value={form.bedrooms} onChange={set('bedrooms')} min={1} max={12} />
          <Step label="Bathrooms" value={form.baths} onChange={set('baths')} min={1} max={8} />
        </View>
        <Field label="Floor-to-floor height" value={form.height} onChangeText={set('height')} suffix="m" />
        <View style={s.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.label}>Separate male and female wings</Text>
            <Text style={s.hint}>Splits bedrooms and bathrooms to opposite sides of each floor.</Text>
          </View>
          <Switch value={form.segregate} onValueChange={set('segregate')} trackColor={{ true: C.primary }} thumbColor={form.segregate ? C.stake : '#ECEFF0'} />
        </View>
      </Sec>

      <Sec title="Extras">
        <Toggle label="Study" hint="A quiet room with a window, placed at the back with the bedrooms where it fits." value={form.study} onChange={set('study')} />
        <Toggle label="Laundry" hint="Replaces the store with a laundry and store room beside the kitchen." value={form.laundry} onChange={set('laundry')} />
        <Toggle label="En-suite for the master bedroom" hint="Needs 2 or more bathrooms. Not used with separate wings." value={form.ensuite} onChange={set('ensuite')} />
        <Toggle label="Veranda at the front" hint="A covered porch in front of the living room. Its depth fits your front setback, leaving 1 m to the boundary." value={form.veranda} onChange={set('veranda')} />
        <Toggle label="Septic tank and soakaway" hint="Sized from the number of bedrooms." value={form.septic} onChange={set('septic')} />
        <Toggle label="Rainwater tank and gutters" hint="Gutters on the long eaves feeding 1,000 L tanks." value={form.rain} onChange={set('rain')} />
        <Toggle label="Furniture in the BoQ" hint="Adds beds, wardrobes, sofas, tables and kitchen cabinets as drawn on the plan." value={form.furnBoq} onChange={set('furnBoq')} />
      </Sec>

      <Sec title="Construction">
        <Text style={s.label}>Wall block thickness</Text>
        <Seg value={form.block} onChange={set('block')} options={[{ v: '150', l: '150 mm' }, { v: '200', l: '200 mm' }]} />
        <Text style={[s.label, { marginTop: 12 }]}>Finish level</Text>
        <Seg value={form.finish} onChange={set('finish')} options={[{ v: 'basic', l: 'Basic' }, { v: 'standard', l: 'Standard' }, { v: 'luxury', l: 'Luxury' }]} />
        <Text style={[s.hint, { marginBottom: 6 }]}>Basic: tiles in wet rooms only, no ceiling. Standard: tiles throughout, ceiling, wall tiles in wet rooms. Luxury: adds skirting and 3 paint coats at premium prices.</Text>
        <View style={[s.row, { marginTop: 12 }]}>
          <Field label="Roof pitch" value={form.pitch} onChangeText={set('pitch')} suffix="°" style={s.half} />
          <Field label="Eave overhang" value={form.overhang} onChangeText={set('overhang')} suffix="m" style={s.half} />
        </View>
        <View style={s.row}>
          <Field label="Material wastage" value={form.waste} onChangeText={set('waste')} suffix="%" style={s.third} />
          <Field label="Labour" value={form.labour} onChangeText={set('labour')} suffix="%" style={s.third} />
          <Field label="Contingency" value={form.contingency} onChangeText={set('contingency')} suffix="%" style={s.third} />
        </View>
      </Sec>

      <TouchableOpacity style={s.btn} onPress={onGenerate}>
        <Text style={s.btnTxt}>Generate design</Text>
      </TouchableOpacity>
    </>
  );

  /* ---------------- Plan tab ---------------- */
  const PlanTab = !snap ? <Empty onGo={() => setTab('site')} /> : (
    <>
      {snap.floors.length > 1 ? (
        <Seg value={floorIdx} onChange={setFloorIdx} options={snap.floors.map((fl, i) => ({ v: i, l: fl.label }))} />
      ) : null}
      <View style={[s.sec, { paddingVertical: 4, marginTop: snap.floors.length > 1 ? 12 : 0 }]}>
        <Toggle label="Show furniture" value={showFurn} onChange={setShowFurn} />
      </View>
      <View style={[s.sec, { padding: 8 }]}>
        <PlanSvg snap={snap} floorIdx={floorIdx} showFurn={showFurn} />
        <Text style={[s.hint, { marginTop: 6 }]}>
          Yellow door: main entrance. Blue lines: windows. Blue dot: water inlet. DB: distribution board.{snap.form.segregate ? ' Blue rooms are the male wing, rose rooms the female wing.' : ''}
        </Text>
      </View>

      <Sec title="Comfort and privacy">
        <View style={s.statRow}>
          <View style={s.stat}><Text style={s.statNum}>{snap.stats.crossPct}%</Text><Text style={s.statLbl}>of living rooms and bedrooms get cross-ventilation</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{snap.stats.outsidePct}%</Text><Text style={s.statLbl}>have at least one outside wall</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{fmt(snap.cover)}%</Text><Text style={s.statLbl}>of the plot is built on</Text></View>
        </View>
        {snap.checks.map((c, i) => (
          <View key={i} style={[s.check, { backgroundColor: c.level === 'warn' ? C.warnBg : c.level === 'ok' ? C.okBg : C.infoBg }]}>
            <Text style={[s.checkTxt, { color: c.level === 'warn' ? C.warn : c.level === 'ok' ? C.ok : C.info }]}>{c.text}</Text>
          </View>
        ))}
      </Sec>

      <Sec title={`Rooms, ${snap.floors[floorIdx].label.toLowerCase()}`}>
        {snap.floors[floorIdx].rooms.filter((r) => r.type !== 'passage').map((r, i) => (
          <View key={i} style={s.trow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tMain}>{r.name}{r.wing ? (r.wing === 'M' ? ', male wing' : ', female wing') : ''}</Text>
              <Text style={s.tSub}>{r.faces.length ? 'Outside wall: ' + r.faces.join(', ') : 'No outside wall'}{r.cross ? ', cross-ventilated' : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.tMain}>{fmt(r.w, 1)} × {fmt(r.h, 1)} m</Text>
              <Text style={s.tSub}>{fmt(r.area, 1)} m²</Text>
            </View>
          </View>
        ))}
      </Sec>
    </>
  );

  /* ---------------- BoQ tab ---------------- */
  const BoqTab = !snap || !boq ? <Empty onGo={() => setTab('site')} /> : (
    <>
      <Sec title="Cost summary">
        {[
          ['Materials', boq.materials],
          [`Labour (${fmt(n(snap.form.labour, 35))}%)`, boq.labour],
          [`Contingency (${fmt(n(snap.form.contingency, 10))}%)`, boq.contingency],
        ].map(([k, v]) => (
          <View key={k} style={s.trow}><Text style={s.tMain}>{k}</Text><Text style={s.tMain}>{currency} {fmt(v)}</Text></View>
        ))}
        <View style={[s.trow, { borderBottomWidth: 0 }]}>
          <Text style={[s.tMain, { fontFamily: SERIF, fontSize: 17 }]}>Total</Text>
          <Text style={[s.tMain, { fontFamily: SERIF, fontSize: 17 }]}>{currency} {fmt(boq.total)}</Text>
        </View>
        <Text style={s.hint}>{currency} {fmt(boq.perM2)} per m² across {fmt(boq.floorArea)} m² of floor. Steel: {fmt(boq.steelTons, 2)} tons.</Text>
      </Sec>

      <Sec title="Waste designed out">
        {boq.design.map((d, i) => (
          <View key={i} style={[s.check, { backgroundColor: C.infoBg }]}>
            <Text style={[s.checkTxt, { color: C.ink }]}>{d}</Text>
          </View>
        ))}
      </Sec>

      {boq.sections.map((sec) => (
        <Sec key={sec.name} title={sec.name}>
          {sec.lines.map((l, i) => (
            <View key={i} style={s.trow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={s.tMain}>{l.item}</Text>
                {l.note ? <Text style={s.tSub}>{l.note}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.tMain}>{fmt(l.qty, l.qty % 1 ? 1 : 0)} {l.unit}</Text>
                <Text style={s.tSub}>{currency} {fmt(l.amount)}</Text>
              </View>
            </View>
          ))}
          <Text style={[s.tMain, { textAlign: 'right', marginTop: 6 }]}>{currency} {fmt(sec.total)}</Text>
        </Sec>
      ))}

      <Sec title="Not included">
        <Text style={s.body}>Boundary wall or fence, landscaping, connection to mains water and power, light fittings, appliances, curtains, permits and site costs. Furniture appears only if you switch it on. Quantities use standard assumptions for strip footings, a timber roof and a framed block structure. Have an engineer check the structure before you build.</Text>
      </Sec>

      <TouchableOpacity style={s.btn} onPress={share}><Text style={s.btnTxt}>Share report</Text></TouchableOpacity>
    </>
  );

  /* ---------------- Rates tab ---------------- */
  const RatesTab = (
    <>
      <Sec title="Currency">
        <Field label="Currency label" value={currency} onChangeText={setCurrency} keyboardType="default" />
        <Field label="Multiply all unit prices by" value={factor} onChangeText={setFactor} />
        <TouchableOpacity
          style={[s.btnGhost, { marginBottom: 10 }]}
          onPress={() => {
            const k = n(factor, 1);
            if (k <= 0) return;
            setRates((p) => {
              const o = {};
              Object.keys(p).forEach((key) => { o[key] = String(Math.round(n(p[key]) * k * 100) / 100); });
              return o;
            });
            setFactor('1');
          }}
        >
          <Text style={s.btnGhostTxt}>Apply to every price</Text>
        </TouchableOpacity>
        <Text style={s.hint}>To switch the placeholder prices to your currency, multiply by the exchange rate, set the currency label above, then correct the main items.</Text>
        <Text style={s.hint}>The starting prices are placeholders. Replace them with local prices and the BoQ updates at once. They stay saved on this phone.</Text>
      </Sec>
      <Sec title="Unit prices">
        {RATE_DEFS.map(([k, label, unit]) => (
          <View key={k} style={s.rateRow}>
            <Text style={[s.tMain, { flex: 1 }]}>{label}<Text style={s.tSub}>  per {unit}</Text></Text>
            <TextInput
              style={[s.input, s.rateInput]}
              keyboardType="decimal-pad"
              value={String(rates[k])}
              onChangeText={(v) => setRates((p) => ({ ...p, [k]: v }))}
            />
          </View>
        ))}
        <TouchableOpacity style={[s.btnGhost, { marginTop: 12 }]} onPress={() => setRates(defaultRates())}>
          <Text style={s.btnGhostTxt}>Reset to starting prices</Text>
        </TouchableOpacity>
      </Sec>
    </>
  );

  /* ---------------- Saved tab ---------------- */
  const SavedTab = (
    <>
      <Sec title="Save this design">
        <Field label="Project name" value={form.name} onChangeText={set('name')} keyboardType="default" />
        <TouchableOpacity style={s.btn} onPress={saveProject}><Text style={s.btnTxt}>Save project</Text></TouchableOpacity>
      </Sec>
      <Sec title="Saved projects">
        {projects.length === 0 ? <Text style={s.body}>Nothing saved yet.</Text> : projects.map((p) => (
          <View key={p.id} style={s.trow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tMain}>{p.name}</Text>
              <Text style={s.tSub}>{p.form.width} × {p.form.length} m, {p.form.storeys} storey(s), {p.form.bedrooms} bedrooms. Saved {p.savedAt}</Text>
            </View>
            <TouchableOpacity onPress={() => loadProject(p)} style={s.smallBtn}><Text style={s.smallBtnTxt}>Open</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => deleteProject(p.id)} style={[s.smallBtn, { marginLeft: 6 }]}><Text style={[s.smallBtnTxt, { color: '#9B2C2C' }]}>Delete</Text></TouchableOpacity>
          </View>
        ))}
      </Sec>
    </>
  );

  const ActualTab = !snap || !boq ? <Empty onGo={() => setTab('site')} /> : (
    <>
      <Sec title="Actual versus estimate">
        <Text style={s.body}>For each item, enter what you bought and what went into the building. The app shows how far the estimate was off and what the waste cost.</Text>
        {aCount ? (
          <View style={{ marginTop: 8 }}>
            <View style={s.trow}><Text style={s.tMain}>Estimate for these items</Text><Text style={s.tMain}>{currency} {fmt(aEst)}</Text></View>
            <View style={s.trow}><Text style={s.tMain}>Actually bought</Text><Text style={s.tMain}>{currency} {fmt(aBought)}</Text></View>
            <View style={[s.trow, { borderBottomWidth: 0 }]}><Text style={s.tMain}>Wasted, bought but not used</Text><Text style={s.tMain}>{currency} {fmt(aWaste)}</Text></View>
            <Text style={s.hint}>
              {aBought ? `${fmt((aWaste / aBought) * 100, 1)}% of what you bought was wasted. ` : ''}
              {aEst ? `You bought ${fmt((Math.abs(aBought - aEst) / aEst) * 100, 1)}% ${aBought >= aEst ? 'more' : 'less'} than estimated.` : ''}
            </Text>
          </View>
        ) : null}
      </Sec>
      {actualRows.map((sec) => (
        <Sec key={sec.name} title={sec.name}>
          {sec.lines.map((row) => (
            <View key={row.id} style={{ paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
              <Text style={s.tMain}>{row.l.item}</Text>
              <Text style={s.tSub}>Estimate {fmt(row.l.qty, row.l.qty % 1 ? 1 : 0)} {row.l.unit}</Text>
              <View style={[s.row, { marginTop: 6 }]}>
                <Field label="Bought" value={row.a.bought === undefined ? '' : row.a.bought} onChangeText={(v) => setActual(row.id, 'bought', v)} style={s.half} />
                <Field label="Used" value={row.a.used === undefined ? '' : row.a.used} onChangeText={(v) => setActual(row.id, 'used', v)} style={s.half} />
              </View>
              {row.b !== null && row.l.qty ? (
                <Text style={s.tSub}>
                  {`${row.b >= row.l.qty ? '+' : '-'}${fmt((Math.abs(row.b - row.l.qty) / row.l.qty) * 100, 0)}% against the estimate`}
                  {row.u !== null && row.b ? `. Waste ${fmt(row.b - row.u, 1)} ${row.l.unit} (${fmt(((row.b - row.u) / row.b) * 100, 1)}%)` : ''}
                </Text>
              ) : null}
            </View>
          ))}
        </Sec>
      ))}
      <TouchableOpacity style={s.btn} onPress={shareActual}><Text style={s.btnTxt}>Share comparison</Text></TouchableOpacity>
      <TouchableOpacity style={[s.btnGhost, { marginTop: 10 }]} onPress={() => setActuals({})}><Text style={s.btnGhostTxt}>Clear all entries</Text></TouchableOpacity>
    </>
  );

  const TABS = [['site', 'Site'], ['plan', 'Plan'], ['boq', 'BoQ'], ['rates', 'Rates'], ['actual', 'Actual'], ['saved', 'Saved']];
  const body = { site: SiteTab, plan: PlanTab, boq: BoqTab, rates: RatesTab, actual: ActualTab, saved: SavedTab }[tab];

  return (
    <View style={s.root}>
      <View style={s.top}>
        <Text style={s.title}>Blueprint and BoQ</Text>
        <Text style={s.titleSub}>Estimates are for planning only.</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView>
      <View style={s.tabs}>
        {TABS.map(([k, label]) => (
          <TouchableOpacity key={k} style={s.tab} onPress={() => setTab(k)}>
            <View style={[s.tabBar, tab === k && { backgroundColor: C.stake }]} />
            <Text style={[s.tabTxt, tab === k && { color: C.ink, fontWeight: '700' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { paddingTop: Platform.OS === 'web' ? 16 : (StatusBar.currentHeight || 40) + 8, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { fontFamily: SERIF, fontSize: 24, fontWeight: '700', color: C.ink },
  titleSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  sec: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 3, padding: 14, marginBottom: 12 },
  secTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 20, color: C.ink },
  hint: { fontSize: 12, lineHeight: 17, color: C.sub, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 4 },
  field: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  third: { flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 3, backgroundColor: '#fff' },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: C.ink },
  suffix: { paddingRight: 10, color: C.sub, fontSize: 13 },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 3, overflow: 'hidden', backgroundColor: '#fff' },
  segItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.ink },
  segText: { fontSize: 14, color: C.ink },
  segTextOn: { color: '#fff', fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 3, backgroundColor: '#fff' },
  stepBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 20, color: C.primary, fontWeight: '700' },
  stepVal: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.ink },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  btn: { backgroundColor: C.ink, paddingVertical: 14, borderRadius: 3, alignItems: 'center' },
  btnTxt: { color: C.stake, fontSize: 16, fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: C.ink, paddingVertical: 11, borderRadius: 3, alignItems: 'center' },
  btnGhostTxt: { color: C.ink, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 3, padding: 8 },
  statNum: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: C.primary },
  statLbl: { fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 14 },
  check: { padding: 10, borderRadius: 3, marginBottom: 6 },
  checkTxt: { fontSize: 13, lineHeight: 18 },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  tMain: { fontSize: 14, color: C.ink, fontWeight: '600' },
  tSub: { fontSize: 12, color: C.sub, fontWeight: '400', marginTop: 1 },
  rateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rateInput: { flex: 0, width: 90, borderWidth: 1, borderColor: C.line, borderRadius: 3, backgroundColor: '#fff', textAlign: 'right' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.line, borderRadius: 3 },
  smallBtnTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 12 },
  tabBar: { height: 3, alignSelf: 'stretch', backgroundColor: 'transparent', marginBottom: 10 },
  tabTxt: { fontSize: 13, color: C.sub },
});
