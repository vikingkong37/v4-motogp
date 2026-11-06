// Model and live part builders for the V4 figure. No imports: the build imports it,
// and the page inlines it (exports stripped), with k (kit), G (lathe) and P passed in.

export const RAD = Math.PI / 180;
const S2 = Math.SQRT1_2;

export const ENG = {
  bore: 81, stroke: 48.5, r: 24.25, rod: 106, comp: 19, skirt: 22,
  linerIn: 40.5, linerOut: 50, linerBottom: 74, deck: 150, roof: 164, headTop: 198,
  rpmMin: 8000, rpmMax: 18500, slow: 400,
};

// Bank frames: a = cylinder axis, inner = across the bore toward the middle of the vee (intake side).
export const BANK = {
  F: { a: [S2, 0, S2], inner: [-S2, 0, S2], alpha: 45 },
  R: { a: [-S2, 0, S2], inner: [S2, 0, S2], alpha: -45 },
};
export const PIN = { A: { phase: 0, y0: -67, y1: -23 }, B: { phase: 70, y0: 23, y1: 67 } };

// fire: crank angle (0..720) of each cylinder's firing TDC. Firing 2-1-4-3 at 0°, 90°, 290°, 380°.
export const CYL = [
  { id: 1, bank: "F", pin: "A", y: -56, fire: 405 },
  { id: 2, bank: "R", pin: "A", y: -34, fire: 315 },
  { id: 3, bank: "F", pin: "B", y: 34, fire: 695 },
  { id: 4, bank: "R", pin: "B", y: 56, fire: 605 },
];
export const FIRST = 315;

export const VALVE = {
  I: { q: 17, tilt: 12, r: 17, peak: 470 },
  E: { q: -17, tilt: -12, r: 13.75, peak: 255 },
};
export const CAM = { rb: 13, lift: 11, half: 62, at: 61, samples: 72 };

export const bankAt = (bank, q, y, s) => {
  const B = BANK[bank];
  return [q * B.inner[0] + s * B.a[0], y, q * B.inner[2] + s * B.a[2]];
};
export const seatS = (q) => ENG.deck + (ENG.roof - ENG.deck) * (1 - Math.abs(q) / ENG.linerIn);
export const valveDir = (bank, kind) => {
  const t = VALVE[kind].tilt * RAD;
  const B = BANK[bank];
  return [Math.sin(t) * B.inner[0] + Math.cos(t) * B.a[0], 0, Math.sin(t) * B.inner[2] + Math.cos(t) * B.a[2]];
};
export const seatPoint = (c, kind) => bankAt(c.bank, VALVE[kind].q, c.y, seatS(VALVE[kind].q));
export const camCentre = (c, kind) => {
  const d = valveDir(c.bank, kind);
  const o = seatPoint(c, kind);
  return [o[0] + d[0] * CAM.at, c.y, o[2] + d[2] * CAM.at];
};

export function pinPoint(theta, pin, y = 0) {
  const g = (theta + PIN[pin].phase) * RAD;
  return [ENG.r * Math.sin(g), y, ENG.r * Math.cos(g)];
}
export function pistonS(theta, c) {
  const b = (theta + PIN[c.pin].phase - BANK[c.bank].alpha) * RAD;
  return ENG.r * Math.cos(b) + Math.sqrt(ENG.rod ** 2 - (ENG.r * Math.sin(b)) ** 2);
}
export const cycleOf = (theta, c) => (((theta - c.fire) % 720) + 720) % 720;
export const phaseOf = (cycle) => (cycle < 180 ? "détente" : cycle < 360 ? "échappement" : cycle < 540 ? "admission" : "compression");

// Cam lobe: base circle plus a cos² flank, in polar form around the cam centre.
export function lobeRadius(psi) {
  const x = Math.abs(psi) / CAM.half;
  return CAM.rb + (x < 1 ? CAM.lift * Math.cos((x * Math.PI) / 2) ** 2 : 0);
}
// Lift seen by a flat bucket: the lobe's support distance along the valve, minus the base circle.
export function liftOf(cycle, kind) {
  const delta = (cycle / 2 - VALVE[kind].peak / 2) * RAD;
  let best = 0;
  for (let i = 0; i < CAM.samples; i++) {
    const psi = -180 + (360 * i) / CAM.samples;
    best = Math.max(best, lobeRadius(psi) * Math.cos(psi * RAD + delta));
  }
  return Math.max(0, best - CAM.rb);
}

// Combustion flash: attack from the spark, decaying through the power stroke, zero well before BDC.
export function flameOf(cycle) {
  const x = cycle > 360 ? cycle - 720 : cycle;
  if (x < -14 || x > 140) return 0;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  return smooth((x + 14) / 18) * Math.exp(-Math.max(0, x - 4) / 34) * (1 - smooth((x - 80) / 60));
}
export function sparkOf(cycle) {
  const x = cycle > 360 ? cycle - 720 : cycle;
  return x > -30 && x < -4 ? Math.sin(((x + 30) / 26) * Math.PI) : 0;
}

// ---- builders --------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// A convex prism along `axis`, its section given as 3D offsets (perpendicular to axis) from `o`.
export function prismWorld(X, o, axis, offsets, s0, s1) {
  const a = unit(axis);
  const seed = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  const u = unit(cross(seed, a));
  const v = cross(a, u);
  return X.G.prismOf({ o, a, u, v }, offsets.map((p) => [dot(p, u), dot(p, v)]), s0, s1, X.P);
}

export function rodSvg(X, theta, c) {
  const B = pinPoint(theta, c.pin, c.y - 8);
  const s = pistonS(theta, c);
  const A = BANK[c.bank].a;
  const W = [A[0] * s, c.y - 8, A[2] * s];
  const d = unit(sub(W, B));
  const len = Math.hypot(W[0] - B[0], W[2] - B[2]);
  const y = [0, 1, 0];
  const u = d, v = cross(y, u);
  const paths = X.G.prismOf({ o: B, a: y, u, v }, X.G.stadium(16.5, 10.5, len, 28), 0, 16, X.P);
  // I-beam flanges on the near face, each ending on the eye rings.
  const face = (p) => X.k.iso([p[0], c.y + 8, p[2]], X.P);
  const perp = [-d[2], 0, d[0]];
  const ring = (centre, r) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      pts.push(face([centre[0] + Math.cos(t) * r, 0, centre[2] + Math.sin(t) * r]));
    }
    return "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
  };
  const rb = 11.5, rs = 6.5, w = 4.2;
  const along = (centre, r, side, sign) => {
    const k = Math.sqrt(r * r - w * w) * sign;
    return [centre[0] + d[0] * k + perp[0] * w * side, 0, centre[2] + d[2] * k + perp[2] * w * side];
  };
  let flanges = "";
  for (const side of [-1, 1]) {
    const p0 = face(along(B, rb, side, 1));
    const p1 = face(along(W, rs, side, -1));
    flanges += `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  }
  const inner = X.k.lineSvg(ring(B, rb) + ring(W, rs), { tone: "lo" }) + X.k.lineSvg(flanges, { tone: "faint" });
  const bolts = [1, -1].map((side) => face([B[0] - d[0] * 9 + perp[0] * 13 * side, 0, B[2] - d[2] * 9 + perp[2] * 13 * side]));
  return X.k.solidSvg(paths, { tone: "hi", crease: "lo", inner }) + X.k.dotsSvg(bolts, { size: 0.5, tone: "mid" });
}

export function lobeSvg(X, theta, c, kind) {
  const cycle = cycleOf(theta, c);
  const delta = (cycle / 2 - VALVE[kind].peak / 2) * RAD;
  const d = valveDir(c.bank, kind);
  const down = [-d[0], 0, -d[2]];
  const side = [-down[2], 0, down[0]];
  const C = camCentre(c, kind);
  const offsets = [];
  for (let i = 0; i < CAM.samples; i++) {
    const psi = -180 + (360 * i) / CAM.samples;
    const rho = lobeRadius(psi);
    const t = psi * RAD + delta;
    offsets.push([(down[0] * Math.cos(t) + side[0] * Math.sin(t)) * rho, 0, (down[2] * Math.cos(t) + side[2] * Math.sin(t)) * rho]);
  }
  const paths = prismWorld(X, [C[0], c.y - 7, C[2]], [0, 1, 0], offsets, 0, 14);
  const hub = X.k.iso([C[0], c.y + 7, C[2]], X.P);
  const nose = X.k.iso([C[0] + (down[0] * Math.cos(delta)) * (CAM.rb + CAM.lift - 3), c.y + 7, C[2] + (down[2] * Math.cos(delta) + 0) * (CAM.rb + CAM.lift - 3)], X.P);
  return X.k.solidSvg(paths, { tone: "mid" }) + X.k.dotsSvg([hub], { size: 0.6, tone: "lo" }) + (nose ? "" : "");
}

export function flamePath(X, theta, c) {
  const crown = pistonS(theta, c) + ENG.comp;
  const pts = [[-ENG.linerIn, crown], [ENG.linerIn, crown], [ENG.linerIn, ENG.deck], [0, ENG.roof], [-ENG.linerIn, ENG.deck]]
    .map(([q, s]) => X.k.iso(bankAt(c.bank, q, c.y + 0.4, s), X.P));
  return "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
}

export function wheelSvg(X, theta) {
  const F = X.G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
  const s = 107.2;
  const minor = X.G.spokesOf(F, s, 33.6, 40, 36, X.P, { phase: theta * RAD });
  const major = X.G.spokesOf(F, s, 26, 40, 4, X.P, { phase: theta * RAD + Math.PI / 4 });
  const tdc = X.G.spokesOf(F, s, 0, 40, 1, X.P, { phase: theta * RAD });
  return X.k.lineSvg(minor, { tone: "lo" }) + X.k.lineSvg(major, { tone: "mid" }) + X.k.lineSvg(tdc, { tone: "hi" });
}
