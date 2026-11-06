import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/anatomy/kit/iso-kit.mjs";
import * as G from "./vendor/anatomy/kit/lathe.mjs";
import { kitScript } from "./vendor/anatomy/scripts/inline-kit.mjs";
import * as V4 from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, "vendor", "anatomy", "kit");
const theme = process.argv.includes("--light") ? "light" : "dark";
const { ENG, BANK, PIN, CYL, VALVE, bankAt, valveDir, seatPoint, camCentre, pinPoint, pistonS, cycleOf, liftOf, flameOf, sparkOf, prismWorld } = V4;

const WIDTH = 620;
const HEIGHT = 470;
const AZIMUTH = Number(process.env.AZ ?? 74);
const THETA0 = V4.FIRST + 22;

// ---- camera ------------------------------------------------------------------
const PLATE = { x: -165, y: -140, w: 330, d: 268, r: 10 };
const BASE_TOP = -100, BASE_H = 12, FOOT_H = 5;
const extremes = [...k.boxCorners(PLATE, BASE_TOP - BASE_H - FOOT_H, BASE_TOP)];
for (const c of CYL) {
  for (const kind of ["I", "E"]) {
    const C = camCentre(c, kind);
    extremes.push([C[0], c.y, C[2] + 26], [C[0] + 26 * Math.sign(C[0]), c.y, C[2]]);
  }
  const t = bankAt(c.bank, 50, c.y, 175);
  const n = BANK[c.bank].inner;
  extremes.push([t[0] + n[0] * 66, c.y, t[2] + n[2] * 66 + 30]);
}
const P = k.fitProjection(extremes, WIDTH, HEIGHT, { pad: 26, azimuth: AZIMUTH, elevation: Number(process.env.EL ?? 27) });
const X = { k, G, P };
const K = (y) => k.depthOf([0, y, 0], P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const pathOf = (pts, closed = true) => "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + (closed ? "Z" : "");
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const Y = [0, 1, 0];

const items = [];
const put = (key, svg) => items.push({ key, svg });

// A prism along y of any (possibly concave) outline in the x–z plane: every visible face is drawn,
// and every edge of a visible face is a real edge of the part.
function prismY(points, y0, y1, style = {}) {
  const V = G.viewOf(P);
  const Lg = G.lightOf(P);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[(i + 1) % points.length];
    area += x0 * z1 - x1 * z0;
  }
  const ring = area < 0 ? [...points].reverse() : points;
  const n = ring.length;
  const near = ring.map(([x, z]) => at([x, y1, z]));
  const far = ring.map(([x, z]) => at([x, y0, z]));
  const faces = [];
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % n];
    const normal = G.unit3([z1 - z0, 0, -(x1 - x0)]);
    if (G.dot3(normal, V) > 1e-6) faces.push({ d: pathOf([near[i], near[(i + 1) % n], far[(i + 1) % n], far[i]]), band: G.bandOf(G.dot3(normal, Lg)) });
  }
  const capBand = G.bandOf(G.dot3(Y, Lg));
  const fill = pathOf(near) + faces.map((f) => f.d).join("");
  const shades = [[], [], [], []];
  let top = "";
  for (const f of faces) (f.band === 4 ? (top += f.d) : shades[f.band].push(f.d));
  const cap = pathOf(near);
  if (capBand === 4) top += cap; else shades[capBand].push(cap);
  const out = [`<path class="iso-fill" d="${fill}"/>`];
  shades.forEach((list, i) => list.length && out.push(`<path class="iso-shade" data-shade="${i}" d="${list.join("")}"/>`));
  out.push(`<path class="iso-top" d="${top}"/>`);
  out.push(style.inner ?? "");
  out.push(`<path class="iso-line iso-edge" data-tone="${style.tone ?? "mid"}" d="${cap}${faces.map((f) => f.d).join("")}"/>`);
  return `<g class="iso-solid">${out.join("")}</g>`;
}

// ---- base -------------------------------------------------------------------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, BASE_TOP - BASE_H - FOOT_H, BASE_H, P)}"/>`];
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, BASE_TOP - BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, BASE_TOP - BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, BASE_TOP - BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), BASE_TOP, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, BASE_TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, BASE_TOP])), { size: 0.5 }));
  // ruler strip along the near edge (crank axis), 10 mm ticks
  const strip = { x: PLATE.x + PLATE.w - 18, y: -118, w: 9, d: 232, r: 1 };
  out.push(S(k.slabOf(strip, BASE_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.y + 4, strip.y + strip.d - 4, 4, 5, strip.x + 0.8, BASE_TOP + 0.6, [2.2, 4], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 4.5, strip.y + 2, BASE_TOP + 0.6]), at([strip.x + 4.5, strip.y + strip.d - 2, BASE_TOP + 0.6])], { size: 0.45 }));
  // label plate
  const plate = { x: 60, y: -128, w: 58, d: 22, r: 1.5 };
  out.push(S(k.slabOf(plate, BASE_TOP, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.8), BASE_TOP + 0.8, P), { tone: "faint" }));
  [[-0.1, 40], [5.2, 28], [10.5, 34]].forEach(([dy, len]) => out.push(k.lineSvg(k.lineOnTop([plate.x + 8, plate.y + 6 + dy], [plate.x + 8 + len, plate.y + 6 + dy], BASE_TOP + 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([plate.x + 4, plate.y + 11, BASE_TOP + 0.8]), at([plate.x + plate.w - 4, plate.y + 11, BASE_TOP + 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---- crankcase far wall (the near half is cut away) ------------------------------
const WALL_Y = [-122, -113];
function backWall() {
  const pts = [[-100, BASE_TOP], [100, BASE_TOP], [100, 18]];
  const edge = (bank, q, s) => { const p = bankAt(bank, q, 0, s); return [p[0], p[2]]; };
  const sF = (100 - 41) / Math.SQRT1_2; // where the front bank's outer edge crosses x = 100
  pts.push(edge("F", -58, sF), edge("F", -58, 202), edge("F", 50, 202), [0, 70.7], edge("R", 50, 202), edge("R", -58, 202), edge("R", -58, sF), [-100, 18]);
  const near = WALL_Y[1];
  const bolts = [];
  for (const [bank, sList] of [["F", [100, 140, 180]], ["R", [100, 140, 180]]]) for (const s of sList) bolts.push(at(bankAt(bank, -52, near, s)), at(bankAt(bank, 44, near, s)));
  for (const x of [-80, -40, 0, 40, 80]) bolts.push(at([x, near, BASE_TOP + 7]));
  return prismY(pts, WALL_Y[0], WALL_Y[1], { tone: "mid" }) + D(bolts, { size: 0.5, tone: "lo" });
}

// ---- bank outer walls and their brackets ----------------------------------------
const OUTER_END = { F: 92, R: 110 };
function outerWall(bank) {
  const corners = [[-58, 60], [-50, 60], [-50, ENG.deck], [-58, ENG.deck]].map(([q, s]) => bankAt(bank, q, 0, s));
  const paths = prismWorld(X, [0, 0, 0], Y, corners, WALL_Y[1], OUTER_END[bank]);
  const endBolts = [75, 100, 125].map((s) => at(bankAt(bank, -54, OUTER_END[bank], s)));
  const rows = [];
  for (let y = -104; y <= OUTER_END[bank] - 8; y += 12) rows.push(at(bankAt(bank, -50, y, 146)), at(bankAt(bank, -50, y, 64)));
  const seam = L(G.sub3 ? "" : "", {});
  return S(paths, { tone: "mid" }) + D(endBolts, { size: 0.45, tone: "lo" }) + D(rows, { size: 0.42, tone: "lo" }) + seam;
}
function bracket(bank, y0) {
  const sign = bank === "F" ? 1 : -1;
  const top = (x) => { const a = bankAt(bank, -50, 0, 60), b = bankAt(bank, -58, 0, 60); const t = (x - a[0]) / (b[0] - a[0]); return a[2] + (b[2] - a[2]) * t; };
  const xs = [78 * sign, 83 * sign];
  const pts = [[xs[0], BASE_TOP], [xs[1], BASE_TOP], [xs[1], top(xs[1])], [xs[0], top(xs[0])]];
  const foot = { x: Math.min(...xs) - 7, y: y0 - 3, w: 19, d: 20, r: 2 };
  return S(k.slabOf(foot, BASE_TOP, 4, P, 3, 0.5), { tone: "mid" }) + D([at([foot.x + 3, foot.y + 3, BASE_TOP + 4]), at([foot.x + foot.w - 3, foot.y + foot.d - 3, BASE_TOP + 4])], { size: 0.45 }) + prismY(pts, y0, y0 + 14, { tone: "mid" });
}

// ---- crankshaft, bearings, degree wheel ---------------------------------------------
const yAxis = (y) => G.frameOf([0, y, 0], Y, [0, 0, 1], [1, 0, 0]);
const disc = (y0, y1, r, style = { tone: "mid" }, inner = "") => S(G.disc(0, y1 - y0, r, yAxis(y0), P), { ...style, inner });
function pedestal(yc, half) {
  const foot = { x: -34, y: yc - 13, w: 68, d: 26, r: 3 };
  const upright = { x: -15, y: yc - half, w: 30, d: half * 2, r: 2 };
  return S(k.slabOf(foot, BASE_TOP, 6, P, 3, 0.6), { tone: "mid" }) +
    D([[-28, yc - 8], [28, yc - 8], [-28, yc + 8], [28, yc + 8]].map(([x, y]) => at([x, y, BASE_TOP + 6])), { size: 0.5 }) +
    S(k.slabOf(upright, BASE_TOP + 6, -24 - BASE_TOP - 6, P, 3, 0.5), { tone: "mid" });
}
function housing(yc, half) {
  const F = yAxis(yc + half);
  const face = L(G.circleOf(F, 0, 21.6, P), { tone: "lo" });
  const bolts = D([at([-24, yc + half, 0]), at([24, yc + half, 0]), at([0, yc + half, 24])], { size: 0.5 });
  return disc(yc - half, yc + half, 30, { tone: "mid" }) + face + bolts;
}
const web = (y0, y1) => disc(y0, y1, 46, { tone: "hi", crease: "lo" }, L(G.circleOf(yAxis(y1), 0, 39, P), { tone: "faint" }));
const journal = (y0, y1) => disc(y0, y1, 21, { tone: "hi", crease: "lo" });
function crankPin(pin) {
  const p = pinPoint(0, pin, PIN[pin].y0);
  const F = G.frameOf(p, Y, [0, 0, 1], [1, 0, 0]);
  return S(G.disc(0, PIN[pin].y1 - PIN[pin].y0, 17, F, P), { tone: "hi", crease: "lo" });
}
function wheelStatic() {
  const F = yAxis(104);
  return S(G.disc(0, 3.2, 40, F, P), { tone: "hi", crease: "lo", inner: L(G.circleOf(F, 3.2, 26, P) + G.circleOf(F, 3.2, 33.6, P), { tone: "faint" }) }) + D([at([0, 107.2, 0])], { size: 0.7, tone: "mid" });
}
function pointer() {
  const post = S(k.slabOf({ x: -2.2, y: 86, w: 4.4, d: 5, r: 0.8 }, 29.2, 17, P, 2), { tone: "mid", crease: "none" });
  const arm = S(k.slabOf({ x: -2.2, y: 86, w: 4.4, d: 24, r: 0.8 }, 46.2, 2.6, P, 2, 0.3), { tone: "mid" });
  const tab = S(k.slabOf({ x: -1.2, y: 107.6, w: 2.4, d: 2.4, r: 0.5 }, 41.4, 4.8, P, 2), { tone: "mid", crease: "none" });
  return post + arm + tab + D([at([0, 88.5, 48.8])], { size: 0.45 });
}

// ---- cylinders ------------------------------------------------------------------
function linerSectors(c) {
  const B = BANK[c.bank];
  const out = [];
  const dir = (phi) => add(mul(B.inner, Math.cos(phi * V4.RAD)), mul(Y, Math.sin(phi * V4.RAD)));
  for (let phi = 180; phi < 360; phi += 15) {
    const d0 = dir(phi), d1 = dir(phi + 15);
    const offsets = [mul(d0, ENG.linerIn), mul(d0, ENG.linerOut), mul(d1, ENG.linerOut), mul(d1, ENG.linerIn)];
    const o = [0, c.y, 0];
    const mid = add(o, mul(add(B.a, [0, 0, 0]), 110));
    const centre = add(mid, mul(dir(phi + 7.5), 45));
    out.push({ depth: k.depthOf(centre, P), svg: S(prismWorld(X, o, B.a, offsets, ENG.linerBottom, ENG.deck), { tone: "mid" }) });
  }
  return `<g class="v4-bore">${out.sort((a, b) => a.depth - b.depth).map((s) => s.svg).join("")}</g>`;
}
function piston(c) {
  const F = G.frameAlong([0, c.y, 0], BANK[c.bank].a);
  const profile = [[-ENG.skirt, 40.2], [16.5, 40.2], [ENG.comp, 38.4]];
  const grooves = [15, 12.6, 10.2].map((s) => G.arcOf(F, s, 40.2, P)).join("");
  return S(G.solidOf(profile, F, P), { tone: "hi", crease: "lo", inner: L(grooves, { tone: "faint" }) });
}
const headPieces = {
  E: [[-50, ENG.deck], [-ENG.linerIn, ENG.deck], [0, ENG.roof], [0, ENG.headTop], [-50, ENG.headTop]],
  I: [[50, ENG.deck], [ENG.linerIn, ENG.deck], [0, ENG.roof], [0, ENG.headTop], [50, ENG.headTop]],
};
const ports = {
  I: [[2, 163.3], [32, 152.9], [50, 166], [50, 186], [31, 184], [14, 172]],
  E: [[-2, 163.3], [-31, 153.3], [-50, 165], [-50, 184], [-30, 181], [-14, 171]],
};
function head(c) {
  const pieces = ["E", "I"].map((kind) => S(prismWorld(X, [0, 0, 0], Y, headPieces[kind].map(([q, s]) => bankAt(c.bank, q, 0, s)), c.y - 46, c.y), { tone: "mid" })).join("");
  const face = (q, s) => at(bankAt(c.bank, q, c.y + 0.2, s));
  const voids = ["I", "E"].map((kind) => `<path class="v4-port" d="${pathOf(ports[kind].map(([q, s]) => face(q, s)))}"/>`).join("");
  const jacket = ["I", "E"].map((kind) => {
    const sgn = kind === "I" ? 1 : -1;
    return `<path class="v4-port" d="${pathOf([[8, 190], [44, 190], [44, 194], [8, 194]].map(([q, s]) => face(q * sgn, s)))}"/>`;
  }).join("");
  const edges = L(["I", "E"].map((kind) => pathOf(ports[kind].map(([q, s]) => face(q, s)))).join(""), { tone: "lo" });
  return pieces + voids + jacket + edges;
}
function valve(c, kind) {
  const F = G.frameAlong(seatPoint(c, kind), valveDir(c.bank, kind));
  const r = VALVE[kind].r;
  const body = S(G.solidOf([[0, r], [2.2, r], [3.4, r - 2.6], [7, 6, 1], [11, 3.6, 1], [40, 3.2]], F, P), { tone: "hi", crease: "lo" });
  const bucket = S(G.disc(36, 48, 12, F, P), { tone: "hi", crease: "lo" });
  return body + bucket;
}
function camshaft(bank, kind, y0, y1, c) {
  const C = camCentre(c, kind);
  const F = G.frameOf([C[0], y0, C[2]], Y, [0, 0, 1], [1, 0, 0]);
  return S(G.disc(0, y1 - y0, 8.5, F, P), { tone: "hi", crease: "lo" });
}
function camCap(c) {
  const y0 = c.y - 46, y1 = c.y - 35;
  const corners = [[-46, ENG.headTop], [46, ENG.headTop], [46, 222], [-46, 222]].map(([q, s]) => bankAt(c.bank, q, 0, s));
  const top = [[-38, 222], [-14, 222], [14, 222], [38, 222]].map(([q, s]) => at(bankAt(c.bank, q, (y0 + y1) / 2, s)));
  return S(prismWorld(X, [0, 0, 0], Y, corners, y0, y1), { tone: "mid" }) + D(top, { size: 0.5 });
}
function plug(c) {
  const F = G.frameAlong(bankAt(c.bank, 0, c.y, ENG.headTop - 2), BANK[c.bank].a);
  const coil = S(G.solidOf([[0, 6.4], [9, 6.4], [9, 8.8], [15, 8.8], [16, 7.2], [36, 7.2], [37, 6], [40, 6]], F, P), { tone: "mid" });
  return coil;
}
function trumpet(c) {
  const o = bankAt(c.bank, 50, c.y, 176);
  const F = G.frameAlong(o, BANK[c.bank].inner);
  const body = S(G.solidOf([[0, 21], [4, 21], [4, 15.5], [26, 15.5], [27, 17.5], [33, 17.5], [34, 15.2], [46, 16.4, 1], [56, 21, 1], [62, 26.5, 1], [64, 28]], F, P), { tone: "mid", inner: L(G.arcOf(F, 30, 17.5, P), { tone: "faint" }) });
  const mouth = `<path class="v4-port" d="${pathOf(G.circleOf(F, 64, 24.6, P).replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number).reduce((acc, v, i, arr) => (i % 2 ? acc : [...acc, [v, arr[i + 1]]]), []))}"/>`;
  const shaft = D([at(add(add(o, mul(BANK[c.bank].inner, 30)), [0, 17.5, 0]))], { size: 0.6, tone: "lo" });
  return body + mouth + L(G.circleOf(F, 64, 24.6, P), { tone: "lo" }) + shaft;
}
function exhaustFlange(c) {
  const o = bankAt(c.bank, -50, c.y, 175);
  const out = mul(BANK[c.bank].inner, -1);
  const F = G.frameAlong(o, out);
  const ring = S(G.disc(0, 5, 17, F, P), { tone: "mid" });
  const hole = G.circleOf(F, 5, 11.5, P);
  const pts = hole.replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number).reduce((acc, v, i, arr) => (i % 2 ? acc : [...acc, [v, arr[i + 1]]]), []);
  const studs = D([G.pointOf(F, 5, 14.5, 0), G.pointOf(F, 5, 14.5, Math.PI)].map(at), { size: 0.6, tone: "lo" });
  return ring + `<path class="v4-port" d="${pathOf(pts)}"/>` + L(hole, { tone: "lo" }) + studs;
}

// ---- ignition indicator: four lamps laid out like the cylinders seen from above ----
const LAMP_BOX = { x: -150, y: 64, w: 46, d: 52, r: 3 };
const LAMP_AT = { 1: [-115, 80], 2: [-139, 80], 3: [-115, 102], 4: [-139, 102] };
function lampBox() {
  const z = BASE_TOP, h = 12;
  const out = [S(k.slabOf(LAMP_BOX, z, h, P, 4, 0.8), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LAMP_BOX, 3), z + h, P, 4), { tone: "faint" }));
  out.push(D(k.corners(LAMP_BOX, 3.5).map(([x, y]) => at([x, y, z + h])), { size: 0.45 }));
  const lamps = Object.entries(LAMP_AT).sort((a, b) => k.depthOf([a[1][0], a[1][1], 0], P) - k.depthOf([b[1][0], b[1][1], 0], P));
  for (const [id, [x, y]] of lamps) {
    out.push(S(k.cylinder(x, y, 7, z + h, 1.6, P, 28), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 5, z + h + 1.6, 2.4, P, 28), { tone: "hi", crease: "lo" }));
    out.push(`<path data-live="lamp${id}" class="v4-lamp" d="${k.planOutline({ x: x - 5, y: y - 5, w: 10, d: 10, r: 5 }, z + h + 4, P, 10)}" style="opacity:0"/>`);
  }
  // cable from the box to the near pedestal foot
  return out.join("");
}

// ---- assemble ---------------------------------------------------------------------
put(-1e9, base());
put(-1e8, backWall());
put(-1e9 + 1, lampBox());
put(-1e7, outerWall("R"));
put(-1e7 + 1, outerWall("F"));
for (const [bank, ys] of [["F", [-104, 74]], ["R", [-104, 92]]]) for (const y0 of ys) put(K(y0 + 7) - 0.5, bracket(bank, y0));
for (const [yc, half] of [[-89, 7], [0, 8], [89, 7]]) {
  put(K(yc) - 6, pedestal(yc, half));
  put(K(yc) - 0.2, housing(yc, half));
}
put(K(-78.5), journal(-82, -75));
put(K(-71), web(-75, -67));
put(K(-19), web(-23, -15));
put(K(-11.5), journal(-15, -8));
put(K(11.5), journal(8, 15));
put(K(19), web(15, 23));
put(K(71), web(67, 75));
put(K(78.5), journal(75, 82));
put(K(100), journal(96, 104));
put(K(105.6), wheelStatic());
put(K(105.6) + 0.1, `<g data-live="wheel">${V4.wheelSvg(X, THETA0)}</g>`);
put(K(108), pointer());
for (const pin of ["A", "B"]) {
  const shift = G.sub3(pinPoint(THETA0, pin), pinPoint(0, pin));
  put(K(PIN[pin].y0), `<g data-live="pin${pin}" transform="${k.translateAlong(P, shift)}">${crankPin(pin)}</g>`);
}

const SHAFTS = { F: [[1, -102, -12], [3, -12, 41]], R: [[2, -80, 10], [4, 10, 63]] };
for (const c of CYL) {
  const K0 = K(c.y);
  const A = BANK[c.bank].a;
  put(K0 - 3, linerSectors(c));
  put(K0 - 2, `<g data-live="rod${c.id}">${V4.rodSvg(X, THETA0, c)}</g>`);
  put(K0 - 1, `<g data-live="piston${c.id}" transform="${k.translateAlong(P, mul(A, pistonS(THETA0, c)))}">${piston(c)}</g>`);
  put(K0 + 1, head(c));
  put(K0 + 1.6, exhaustFlange(c));
  const cyc = cycleOf(THETA0, c);
  put(K0 + 2, `<path data-live="flame${c.id}" class="v4-flame" d="${V4.flamePath(X, THETA0, c)}" style="opacity:${flameOf(cyc).toFixed(3)}"/>`);
  const spark = at(bankAt(c.bank, 0, c.y + 0.5, 162.6));
  put(K0 + 2.1, `<circle data-live="spark${c.id}" class="v4-spark" cx="${spark[0].toFixed(1)}" cy="${spark[1].toFixed(1)}" r="2.2" style="opacity:${sparkOf(cyc).toFixed(3)}"/>`);
  for (const kind of ["E", "I"]) {
    const lift = liftOf(cyc, kind);
    put(K0 + (kind === "E" ? 3 : 3.1), `<g data-live="valve${c.id}${kind}" transform="${k.translateAlong(P, mul(valveDir(c.bank, kind), -lift))}">${valve(c, kind)}</g>`);
  }
  const [, y0, y1] = SHAFTS[c.bank].find(([id]) => id === c.id);
  put(K0 + 2.5, camshaft(c.bank, "E", y0, y1, c) + camshaft(c.bank, "I", y0, y1, c));
  put(K0 + 2.6, camCap(c));
  put(K0 + 3.2, plug(c));
  put(K0 + 3.3, trumpet(c));
  for (const kind of ["E", "I"]) put(K0 + 4, `<g data-live="lobe${c.id}${kind}">${V4.lobeSvg(X, THETA0, c, kind)}</g>`);
}
items.sort((a, b) => a.key - b.key);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Moteur V4 à 90° de MotoGP en écorché, posé sur un banc : vilebrequin à deux manetons décalés de 70°, quatre bielles, quatre pistons dans des chemises ouvertes, culasses à deux arbres à cames, soupapes, cornets d'admission et disque gradué sur le nez du vilebrequin. Le moteur tourne ; chaque cylindre s'éclaire quand il explose, dans l'ordre 2, 1, 4, 3.",
  body: items.map((item) => item.svg),
});

const CSS = `
.iso{--v4-fire:#ff5a1f;--v4-fire-core:#ffd27a;--v4-port:#d6d6d9}
.iso[data-theme="dark"],.iso:not([data-theme]){--v4-fire:#ff7a2e;--v4-fire-core:#ffe0a0;--v4-port:#141414}
.iso[data-theme="light"]{--v4-fire:#e8480c;--v4-port:#d3d3d7}
.v4-port{fill:var(--v4-port)}
.v4-lamp{fill:var(--v4-fire);stroke:var(--v4-fire-core);stroke-width:.6}
.iso[data-theme="light"] .v4-bore{--anatomy-paper:#e4e4e6;--anatomy-face:#dedee1;--anatomy-top:#e2e2e5;--anatomy-shade-0:#c9c9cd;--anatomy-shade-1:#d0d0d4;--anatomy-shade-2:#d6d6da;--anatomy-shade-3:#dcdce0}
.iso:not([data-theme="light"]) .v4-bore{--anatomy-paper:#101010;--anatomy-face:#121212;--anatomy-top:#151515;--anatomy-shade-0:#0b0b0b;--anatomy-shade-1:#0e0e0e;--anatomy-shade-2:#111;--anatomy-shade-3:#141414}
.v4-flame{fill:var(--v4-fire);mix-blend-mode:normal}
.iso:not([data-theme="light"]) .v4-flame{mix-blend-mode:screen}
.v4-spark{fill:var(--v4-fire-core);stroke:var(--v4-fire);stroke-width:.8}
.iso-stage{touch-action:pan-y;cursor:ew-resize}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
`;

const latheSource = readFileSync(join(KIT, "lathe.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { viewOf, lightOf, scaleOf, frameAlong, frameOf, pointOf, disc, prismOf, stadium, spokesOf, circleOf, arcOf, dot3, add3, sub3, mul3, unit3, cross3, len3, bandOf };})();\n`;
const partsSource = readFileSync(join(HERE, "parts.mjs"), "utf8").replace(/^export /gm, "");
const partsScript = `const V4 = (() => {${partsSource}\nreturn { RAD, ENG, BANK, PIN, CYL, FIRST, VALVE, bankAt, valveDir, pinPoint, pistonS, cycleOf, phaseOf, liftOf, flameOf, sparkOf, rodSvg, lobeSvg, flamePath, wheelSvg };})();\n`;
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__P__", JSON.stringify(P)).replace("__THETA0__", String(THETA0));

const fmt = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
const rpm0 = 13000;
const body = k.plateHtml({
  fig: "Fig 1",
  title: "V4 MotoGP · 1 000 cm³",
  hint: "Survolez de gauche à droite : régime",
  readout: `${fmt(rpm0)} tr/min · explosion : cyl. 2`,
  keys: [
    { mark: "lit", label: "L'explosion dans le cylindre qui vient d'allumer" },
    { mark: "raised", label: "Équipage mobile : vilebrequin, bielles, pistons, soupapes" },
    { mark: "flat", label: "Carter et culasses coupés pour montrer l'intérieur" },
  ],
  caption:
    "Un V4 à 90° comme ceux de Ducati, Honda, KTM et Aprilia : 4 cylindres de 81 mm d'alésage (le maximum autorisé en MotoGP) et 48,5 mm de course, soit 1 000 cm³. Les deux manetons sont décalés de 70°, donc les cylindres explosent par paires rapprochées, à 0°, 90°, 290° et 380° sur deux tours (ordre « big bang » / twin pulse). Le mouvement est montré 400 fois plus lentement : à 18 500 tr/min, chaque cylindre explose 154 fois par seconde et les pistons filent à 29,9 m/s en moyenne.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Moteur V4 : flèches gauche et droite pour changer le régime" aria-valuemin="${ENG.rpmMin}" aria-valuemax="${ENG.rpmMax}" aria-valuenow="${rpm0}" aria-valuetext="${fmt(rpm0)} tours par minute">${svg}</div>`,
});
const file = theme === "light" ? "v4-motogp-light.html" : "v4-motogp.html";
writeFileSync(join(HERE, "docs", file), k.pageHtml({ title: "Moteur V4 de MotoGP", theme, body: `<style>${CSS}</style>` + body, script: kitScript() + latheScript + partsScript + LIVE, width: 680 }));
console.log("wrote", file, "items", items.length);
