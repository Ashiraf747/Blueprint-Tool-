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
  width: '15', length: '25',
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
  ['door', 'Door, fitted', 'each', 120],
  ['window', 'Window, fitted', 'm²', 85],
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
  stairs: 6, bath: 4.5, bed: 11, master: 14,
};
const MIN_SIDE = { living: 3, dining: 2.4, lounge: 2.8, kitchen: 2.2, store: 1.2, stairs: 2, bath: 1.5, bed: 2.7 };
const HABITABLE = ['living', 'dining', 'lounge', 'kitchen', 'bed'];

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
function program(f) {
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
  const wingOrder = (a, b) => (a.wing === b.wing ? 0 : a.wing === 'M' ? -1 : 1);

  let bedIdx = 0;
  let bathIdx = 0;
  const floors = [];
  for (let i = 0; i < ns; i++) {
    const pub = [], svc = [], prv = [];
    if (i === 0) {
      pub.push(R('Living room', 'Living', 'living'));
      if (nb >= 2) pub.push(R('Dining', 'Dining', 'dining'));
      svc.push(R('Kitchen', 'Kitchen', 'kitchen'));
      svc.push(R('Store', 'Store', 'store'));
    } else {
      pub.push(R('Family lounge', 'Lounge', 'lounge'));
    }
    if (ns > 1) svc.push(R('Stairs', 'Stairs', 'stairs'));
    const baths = [];
    for (let b = 0; b < bathsPer[i]; b++) {
      bathIdx++;
      const wing = f.segregate && bathsPer[i] >= 2 ? (b % 2 === 0 ? 'M' : 'F') : null;
      baths.push(R('Bathroom ' + bathIdx, 'Bath', 'bath', wing));
    }
    if (f.segregate) baths.sort(wingOrder);
    svc.push(...baths);
    for (let b = 0; b < bedsPer[i]; b++) {
      const idx = bedIdx++;
      const wing = f.segregate ? (idx % 2 === 0 ? 'M' : 'F') : null;
      const master = !f.segregate && idx === 0;
      prv.push(R(
        master ? 'Master bedroom' : 'Bedroom ' + (idx + 1),
        master ? 'Master' : 'Bed ' + (idx + 1),
        'bed', wing, master ? TYPE_BASE.master : TYPE_BASE.bed,
      ));
    }
    if (f.segregate) prv.sort(wingOrder);
    floors.push({ label: i === 0 ? 'Ground floor' : 'Floor ' + i, public: pub, service: svc, private: prv });
  }
  return floors;
}

/* ------------------------------------------------------------------ */
/*  Layout: bands of rooms, front (street) to back                     */
/* ------------------------------------------------------------------ */
/* Modular coordination: every wall, room and opening sits on a 0.225 m grid
   (half a 450 × 225 block), so blocks are laid whole or half and never cut. */
const MOD = 0.225;
const WIN_STD = [
  { id: 'W1', w: 0.9, h: 1.125 },
  { id: 'W2', w: 1.35, h: 1.125 },
  { id: 'W3', w: 1.8, h: 1.125 },
];
const DOOR_STD = { inner: 0.9, main: 1.125, h: 2.1 }; // openings are 2.25 m (10 courses) high
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

function layoutFloor(fl, bw, bl, street) {
  const maxN = Math.max(1, Math.floor(bw / 2.6));
  const PASS = 6 * MOD; // 1.35 m passage
  const bands = [];
  chunk(fl.public, maxN).forEach((b) => bands.push({ zone: 'public', rooms: b }));
  chunk(fl.service, maxN).forEach((b) => bands.push({ zone: 'service', rooms: b }));
  const priv = chunk(fl.private, maxN);
  if (priv.length) {
    bands.push({ zone: 'passage', rooms: [{ name: 'Passage', short: 'Passage', type: 'passage', base: 0, wing: null }] });
  }
  priv.forEach((b) => bands.push({ zone: 'private', rooms: b }));

  const roomBands = bands.filter((b) => b.zone !== 'passage');
  const passN = bands.length - roomBands.length;
  const bandBase = roomBands.map((b) => b.rooms.reduce((x, r) => x + r.base, 0));
  const base = bandBase.reduce((a, x) => a + x, 0);
  const scale = (bw * bl - passN * PASS * bw) / base;
  const depths = snapSplit(bandBase, bl - passN * PASS, MOD);

  let cursor = bl; // y grows toward the rear; the street side is y = bl
  let di = 0;
  const rooms = [];
  let intLen = 0;
  bands.forEach((b, bi) => {
    let depth, widths;
    if (b.zone === 'passage') {
      depth = PASS; widths = [bw];
    } else {
      depth = depths[di++];
      widths = snapSplit(b.rooms.map((r) => r.base), bw, MOD);
    }
    const top = cursor - depth;
    let x = 0;
    b.rooms.forEach((r, i) => {
      rooms.push({ ...r, zone: b.zone, x, y: top, w: widths[i], h: depth, area: widths[i] * depth });
      x += widths[i];
    });
    intLen += (b.rooms.length - 1) * depth;
    if (bi > 0) intLen += bw;
    cursor = top;
  });

  const eps = 0.02;
  const upB = (BEAR[street] + 180) % 360;
  const faceOf = {
    F: street,
    B: dirFromBearing(upB),
    R: dirFromBearing(upB + 90),
    Lf: dirFromBearing(upB + 270),
  };
  rooms.forEach((r) => {
    const s = { Lf: r.x < eps, R: r.x + r.w > bw - eps, B: r.y < eps, F: r.y + r.h > bl - eps };
    r.faces = Object.keys(s).filter((k) => s[k]).map((k) => faceOf[k]);
    r.cross = (s.Lf && s.R) || (s.F && s.B);
  });
  return { label: fl.label, rooms, intLen, scale, serviceBands: bands.filter((b) => b.zone === 'service').length };
}

/* ------------------------------------------------------------------ */
/*  Generate design + checks                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Electrical and plumbing runs, measured from the layout             */
/* ------------------------------------------------------------------ */
const roomPoints = (rm) => {
  switch (rm.type) {
    case 'bath': case 'store': case 'stairs': return { lights: 1, sockets: 0 };
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

  // Try every whole-block position along the hub line; keep the one with the least cable.
  let best = null;
  for (let x = 0.45; x <= bw - 0.45 + 1e-6; x += 0.45) {
    const e = electrics(x, dbY);
    if (!best || e.total < best.e.total) best = { x, e };
  }
  const base = electrics(bw / 2, bl - 0.5); // board at the entrance wall
  const savingPct = Math.max(0, ((base.total - best.e.total) / base.total) * 100);

  // Plumbing: water enters at the front centre; every wet room gets a drain run to the nearest outside wall.
  let supply = 0, soil = 0, waste = 0;
  floors.forEach((fl, fi) => {
    const wet = fl.rooms.filter((r) => r.type === 'bath' || r.type === 'kitchen');
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

function generate(f) {
  const W = n(f.width), L = n(f.length);
  const front = n(f.front), rear0 = n(f.rear), side0 = n(f.side);
  const bwFull = W - 2 * side0, blFull = L - front - rear0;
  if (!(W > 0 && L > 0) || bwFull < 5 || blFull < 5) {
    return { error: 'The buildable area is under 5 m on one side. Reduce the setbacks or enlarge the plot.' };
  }
  // Footprint in whole blocks (0.45 m). Leftover goes to the side and rear setbacks.
  const bw = Math.floor(bwFull / 0.45 + 1e-6) * 0.45;
  const bl = Math.floor(blFull / 0.45 + 1e-6) * 0.45;
  const side = side0 + (bwFull - bw) / 2;
  const rear = rear0 + (blFull - bl);
  // Wall height in whole block courses
  const courses = Math.max(12, Math.round(n(f.height, 3) / MOD));
  const hMod = courses * MOD;

  const floors = program(f).map((fl) => layoutFloor(fl, bw, bl, f.street));
  const services = planServices(floors, bw, bl, hMod);
  const checks = [];
  const add = (level, text) => checks.push({ level, text });

  add('info', `Building is ${fmt(bw, 2)} × ${fmt(bl, 2)} m, in whole blocks. Wall height is ${fmt(hMod, 3)} m (${courses} courses). All walls and rooms sit on a 0.225 m grid, so no block needs cutting.`);

  const cover = (bw * bl) / (W * L) * 100;
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
      } else if (long / short > 3.5) {
        add('warn', `${r.name}${where} is very long and narrow (${fmt(r.w, 1)} × ${fmt(r.h, 1)} m).`);
      }
      if (HABITABLE.includes(r.type)) {
        habitable++;
        if (r.faces.length) outside++;
        if (r.cross) cross++;
        if (!r.faces.length) add('warn', `${r.name}${where} has no outside wall. Add a light well or roof vent.`);
      }
      if (r.type === 'bed' && r.faces.includes('W')) {
        add('warn', `${r.name}${where} has a west wall, which takes afternoon sun. Use small, shaded openings on that side (tropical site assumed).`);
      }
    });
  });

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
    form: { ...f }, W, L, front, rear, side, bw, bl, street: f.street,
    hMod, courses, floors, checks, cover, services,
    stats: {
      crossPct: habitable ? Math.round((cross / habitable) * 100) : 0,
      outsidePct: habitable ? Math.round((outside / habitable) * 100) : 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Bill of quantities                                                 */
/* ------------------------------------------------------------------ */
// Fewest standard windows (one size per room) that reach the glazing target.
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

function computeBoQ(snap, rates) {
  const f = snap.form;
  const { bw, bl, floors } = snap;
  const rt = (k) => n(rates[k]);
  const ns = floors.length;
  const h = snap.hMod;
  const t = n(f.block, 150) / 1000;
  const perM2 = 1 / (0.45 * 0.225); // modular blocks, 10 mm joints inside the module
  const mortarPerM2 = t * (1 - perM2 * 0.44 * 0.215);
  const waste = 1 + n(f.waste, 5) / 100;
  const blockWaste = 1.03; // breakage only: modular walls need no cutting
  const extPer = 2 * (bw + bl);

  const win = { W1: 0, W2: 0, W3: 0 };
  const tiled = [];
  let innerDoors = 0, floorArea = 0, points = 0, wc = 0, sinks = 0, netWall = 0;
  floors.forEach((fl, i) => {
    let open = 0;
    fl.rooms.forEach((rm) => {
      floorArea += rm.area;
      if (rm.type !== 'stairs') tiled.push(rm);
      const pp = roomPoints(rm);
      points += pp.lights + pp.sockets;
      if (rm.type === 'passage') return;
      if (rm.type !== 'stairs') { innerDoors++; open += DOOR_STD.inner * 2.25; }
      let pick = null;
      if (rm.faces.length) {
        if (HABITABLE.includes(rm.type)) pick = pickWindows(Math.max(1, 0.15 * rm.area));
        else if (rm.type === 'bath') pick = pickWindows(0.6);
      }
      if (pick) {
        win[pick.s.id] += pick.count;
        open += pick.s.w * pick.s.h * pick.count;
      }
      if (rm.type === 'bath') wc++;
      if (rm.type === 'kitchen') sinks++;
    });
    if (i === 0) { innerDoors += 1; open += DOOR_STD.inner * 2.25 + DOOR_STD.main * 2.25; } // back door and main door
    netWall += Math.max(0, (extPer + fl.intLen) * h - open);
  });
  const winArea = WIN_STD.reduce((a, s) => a + win[s.id] * s.w * s.h, 0);

  // Substructure
  const groundLen = extPer + floors[0].intLen;
  const excavation = groundLen * 0.6 * 0.9;
  const footing = groundLen * 0.6 * 0.25;
  const foundArea = groundLen * 0.6;
  const slabG = bw * bl * 0.1;
  const hardcore = bw * bl * 0.2;
  const meshN = (a, b) => Math.ceil(a / (2.4 - 0.15)) * Math.ceil(b / (4.8 - 0.3));
  const meshSheets = Math.min(meshN(bw, bl), meshN(bl, bw));

  // Frame
  const beamV = floors.reduce((a, fl) => a + (extPer + fl.intLen) * 0.2 * 0.15, 0);
  const colN = Math.max(4, Math.ceil(extPer / 3.5));
  const colV = colN * 0.2 * 0.2 * h * ns;
  const slabU = (ns - 1) * bw * bl * 0.15;
  const conc = footing + slabG + beamV + colV + slabU;
  const steelKg = (footing * 40 + beamV * 150 + colV * 120 + slabU * 100) * waste;

  // Masonry and finishes
  const masonryArea = netWall + foundArea;
  const blocks = Math.ceil(masonryArea * perM2 * blockWaste);
  const mortarV = masonryArea * mortarPerM2;
  const plasterArea = 2 * netWall;
  const plasterV = plasterArea * 0.015;
  const screedV = floorArea * 0.04;

  const bagM = (mortarV * 1.33 / 5) * 28.8;
  const bagC = conc * 6.3;
  const bagP = (plasterV * 1.4 / 5) * 28.8;
  const bagS = (screedV * 1.33 / 4) * 28.8;
  const cementBags = Math.ceil((bagM + bagC + bagP + bagS) * waste);
  const sand = ((conc * 0.44) + (mortarV * 1.33 * 4 / 5) + (plasterV * 1.4 * 4 / 5) + (screedV * 1.33 * 3 / 4)) * waste;
  const agg = conc * 0.88 * waste;

  // Roof: simple gable, ridge along the long side. Eaves and gables are tuned
  // so sheets are used at full length and full width, with no cutting.
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
  const roofArea = 2 * slopeLen * ridgeLen;
  const sheetQty = {};
  combo.pieces.forEach((len) => { sheetQty[len] = (sheetQty[len] || 0) + 2 * sheetsAcross; });
  const nTruss = Math.ceil(long / 1.2) + 1;
  const timberRaw = nTruss * (2 * slopeLen + span * 1.3) + 2 * (Math.ceil(slopeLen / 0.9) + 1) * ridgeLen;
  const timberM = Math.ceil(timberRaw * waste);

  // Tiles: pick the tile size that cuts least across all rooms
  const tiledArea = tiled.reduce((a, r) => a + r.area, 0);
  let bestTile = null;
  TILE_SIZES.forEach((ts) => {
    const cnt = tiled.reduce((a, r) => a + Math.ceil(r.w / ts - 1e-6) * Math.ceil(r.h / ts - 1e-6), 0);
    const area = cnt * ts * ts;
    if (!bestTile || area < bestTile.area - 1e-6 || (Math.abs(area - bestTile.area) < 1e-6 && ts > bestTile.ts)) {
      bestTile = { ts, cnt, area };
    }
  });
  const tileWastePct = (bestTile.area / tiledArea - 1) * 100;
  const tileQty = Math.ceil(bestTile.area * 1.03);
  const paintL = Math.ceil((plasterArea * 2) / 10);

  const lines = [];
  const add = (sec, item, unit, qty, key, note, amt) => {
    lines.push({
      sec, item, unit, qty, rate: key ? rt(key) : 0,
      amount: amt !== undefined ? amt : key ? qty * rt(key) : 0, note,
    });
  };
  const r1 = (x) => Math.round(x * 10) / 10;

  add('Earthworks', 'Excavation, strip footings', 'm³', r1(excavation), 'excavation');
  add('Earthworks', 'Hardcore under ground slab', 'm³', r1(hardcore), 'hardcore');
  add('Masonry', `Wall blocks, ${f.block} mm`, 'each', blocks, 'block',
    `${fmt(masonryArea)} m² of wall after openings, plus foundation walling. 3% breakage, no cutting loss`);
  add('Cement, sand, aggregate', 'Cement', 'bag', cementBags, 'cement',
    `Concrete ${fmt(bagC * waste)}, mortar ${fmt(bagM * waste)}, plaster ${fmt(bagP * waste)}, screed ${fmt(bagS * waste)}`);
  add('Cement, sand, aggregate', 'Sand', 'm³', r1(sand), 'sand');
  add('Cement, sand, aggregate', 'Aggregate', 'm³', r1(agg), 'aggregate');
  add('Concrete frame and steel', 'Reinforcement steel', 'kg', Math.ceil(steelKg), 'steel',
    `${fmt(conc, 1)} m³ concrete: footings, ground slab, ring beams, ${colN * ns} columns` + (ns > 1 ? ', upper slabs' : ''));
  add('Concrete frame and steel', 'Ground slab mesh', 'sheet', meshSheets, 'mesh', 'Counted with laps, in the better of two sheet orientations');
  Object.keys(sheetQty).forEach((len) => {
    add('Roofing', `Roof sheet, ${len} m`, 'sheet', sheetQty[len], 'roofSheet', 'Priced pro rata to a 3 m sheet',
      sheetQty[len] * rt('roofSheet') * (Number(len) / 3));
  });
  add('Roofing', 'Roof timber', 'm', timberM, 'timber', `${nTruss} trusses at 1.2 m and purlins at 0.9 m`);
  add('Finishes', `Floor tiles, ${bestTile.ts} × ${bestTile.ts} m`, 'm²', tileQty, 'tile',
    `${fmt(tiledArea)} m² of floor. About ${fmt(tileWastePct)}% cutting allowance, plus 3% breakage`);
  add('Finishes', 'Paint, 2 coats', 'L', paintL, 'paint', `${fmt(plasterArea)} m² of plastered wall`);
  add('Doors, windows, services', `Door ${DOOR_STD.inner} × ${DOOR_STD.h} m`, 'each', innerDoors, 'door');
  add('Doors, windows, services', `Main door ${DOOR_STD.main} × ${DOOR_STD.h} m`, 'each', 1, 'door');
  WIN_STD.forEach((s) => {
    if (win[s.id]) {
      add('Doors, windows, services', `Window ${s.w} × ${s.h} m`, 'each', win[s.id], null, null,
        win[s.id] * s.w * s.h * rt('window'));
    }
  });
  const sv = snap.services;
  add('Plumbing', 'WC sets', 'each', wc, 'wc');
  add('Plumbing', 'Basins', 'each', wc, 'basin');
  add('Plumbing', 'Kitchen sinks', 'each', sinks, 'sink');
  add('Plumbing', 'Water pipe 20 mm, 4 m lengths', 'each', Math.ceil(sv.supply / 4), 'pipe20', `${fmt(sv.supply)} m of supply run measured from the layout`);
  add('Plumbing', 'Waste pipe 50 mm, 3 m lengths', 'each', Math.ceil(sv.waste / 3), 'pipe50', `${fmt(sv.waste)} m`);
  add('Plumbing', 'Soil pipe 110 mm, 6 m lengths', 'each', Math.ceil(sv.soil / 6), 'pipe110', `${fmt(sv.soil)} m to the nearest outside wall`);
  add('Plumbing', 'Pipe fittings', 'each', wc + sinks, 'plumbFit', 'One set per wet room');
  add('Electrical', 'Electrical points', 'each', points, 'point', 'Lights and sockets');
  add('Electrical', 'Cable 1.5 mm² (lights), 100 m rolls', 'roll', Math.ceil(sv.l15 / 100), 'cable15', `${fmt(sv.l15)} m needed`);
  add('Electrical', 'Cable 2.5 mm² (sockets), 100 m rolls', 'roll', Math.ceil(sv.l25 / 100), 'cable25', `${fmt(sv.l25)} m needed`);
  add('Electrical', 'Conduit 20 mm, 3 m lengths', 'each', Math.ceil(sv.conduit / 3), 'conduit');
  add('Electrical', 'Distribution board', 'each', 1, 'db');

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
    `Openings: ${innerDoors + 1} doors in 2 sizes and ${Object.keys(win).reduce((a, k) => a + win[k], 0)} windows in ${winKinds} size${winKinds === 1 ? '' : 's'}, all on the grid with heads at the same course. You order a few sizes in bulk, and the lintel line runs level around the house.`,
    `Roof: ${combo.pieces.map((p) => p + ' m').join(' + ')} sheets run eave to ridge, ${sheetsAcross} sheets across each slope. Eaves are ${fmt(ovhEave, 2)} m and gables ${fmt(ovhGable, 2)} m, so no sheet is cut.`,
    `Floor: ${bestTile.ts} × ${bestTile.ts} m tiles cut least across your rooms (about ${fmt(tileWastePct)}% cutting allowance).`,
    `Electrical: the distribution board sits ${fmt(sv.db.x, 2)} m from the left wall on the passage line, the spot with the least cable.${sv.savingPct >= 1 ? ` That saves about ${fmt(sv.savingPct)}% against putting it at the entrance wall.` : ' The entrance wall would use about the same.'} Lights and sockets are chained from room to room, not run separately back to the board.`,
    `Pipes: ${fmt(sv.supply)} m supply, ${fmt(sv.waste)} m waste and ${fmt(sv.soil)} m soil pipe, bought in standard lengths. Drains run to the nearest outside wall.`,
    floors.every((fl) => fl.serviceBands <= 1)
      ? 'Plumbing: kitchen, bathrooms and stairs share one wall line per floor, which keeps supply and drain runs short.'
      : 'Plumbing: wet rooms spread over more than one wall line on a floor. Fewer bathrooms or a wider plot would shorten the pipe runs.',
  ];

  return {
    sections, materials, labour, contingency, total, floorArea, design,
    perM2: floorArea ? total / floorArea : 0,
    steelTons: steelKg / 1000,
  };
}

function buildReport(snap, boq, cur) {
  const f = snap.form;
  const out = [];
  out.push(`${f.name || 'Project'}: Blueprint and BoQ`);
  out.push(`Plot ${snap.W} × ${snap.L} m, building ${fmt(snap.bw, 2)} × ${fmt(snap.bl, 2)} m, ${snap.floors.length} storey(s)`);
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
    out.push(s.name);
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
function PlanSvg({ snap, floorIdx }) {
  const { W, L, rear, side, bw, bl, street } = snap;
  const rooms = snap.floors[floorIdx].rooms;
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
            <SvgText x={x + r.w / 2} y={y + r.h / 2 + (showArea ? -0.05 : fs * 0.35)} fontSize={fs} fill={C.ink} textAnchor="middle" fontWeight="bold">
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
      <Rect x={ox} y={oy} width={bw} height={bl} fill="none" stroke={C.ink} strokeWidth={0.22} />
      {/* entrance */}
      {floorIdx === 0 ? (
        <G>
          <Rect x={ox + bw / 2 - 0.6} y={oy + bl - 0.14} width={1.2} height={0.28} fill={C.stake} />
          <Circle cx={ox + bw / 2 + 1.3} cy={oy + bl} r={0.18} fill={C.primary} />
          <Rect x={ox + snap.services.db.x - 0.25} y={oy + snap.services.db.y - 0.25} width={0.5} height={0.5} fill="#fff" stroke={C.ink} strokeWidth={0.05} />
          <SvgText x={ox + snap.services.db.x} y={oy + snap.services.db.y + 0.12} fontSize={0.3} fill={C.ink} textAnchor="middle" fontWeight="bold">DB</SvgText>
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
export default function App() {
  const [tab, setTab] = useState('site');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [rates, setRates] = useState(defaultRates());
  const [currency, setCurrency] = useState('USD');
  const [snap, setSnap] = useState(null);
  const [floorIdx, setFloorIdx] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [factor, setFactor] = useState('1');

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem('bp:projects');
        if (p) setProjects(JSON.parse(p));
        const r = await AsyncStorage.getItem('bp:rates');
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
  const share = async () => {
    if (!snap || !boq) return;
    const message = buildReport(snap, boq, currency);
    if (Platform.OS !== 'web') { Share.share({ message }); return; }
    try {
      if (navigator.share) await navigator.share({ title: form.name || 'Blueprint and BoQ', text: message });
      else { await navigator.clipboard.writeText(message); notify('Copied', 'The report is copied. Paste it into a message or document.'); }
    } catch (e) { /* share cancelled */ }
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

      <Sec title="Construction">
        <Text style={s.label}>Wall block thickness</Text>
        <Seg value={form.block} onChange={set('block')} options={[{ v: '150', l: '150 mm' }, { v: '200', l: '200 mm' }]} />
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
      <View style={[s.sec, { padding: 8, marginTop: snap.floors.length > 1 ? 12 : 0 }]}>
        <PlanSvg snap={snap} floorIdx={floorIdx} />
        <Text style={[s.hint, { marginTop: 6 }]}>
          Yellow bar: main entrance. Blue dot: water inlet. DB: distribution board.{snap.form.segregate ? ' Blue rooms are the male wing, rose rooms the female wing.' : ''}
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
        <Text style={s.body}>Ceilings, external works, septic tank and water supply, wiring and plumbing runs, fittings, furniture, permits, and site costs. Quantities use standard assumptions for strip footings, a timber roof and a framed block structure. Have an engineer check the structure before you build.</Text>
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

  const TABS = [['site', 'Site'], ['plan', 'Plan'], ['boq', 'BoQ'], ['rates', 'Rates'], ['saved', 'Saved']];
  const body = { site: SiteTab, plan: PlanTab, boq: BoqTab, rates: RatesTab, saved: SavedTab }[tab];

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
