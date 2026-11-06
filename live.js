
const P = __P__;
const X = { k: { iso, solidSvg, lineSvg, dotsSvg }, G, P };
const { ENG, BANK, PIN, CYL } = V4;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (name) => svg.querySelector(`[data-live="${name}"]`);
const refs = {
  wheel: $("wheel"),
  pins: Object.fromEntries(["A", "B"].map((p) => [p, $("pin" + p)])),
  cyl: CYL.map((c) => ({
    c,
    rod: $("rod" + c.id), lamp: $("lamp" + c.id), piston: $("piston" + c.id), flame: $("flame" + c.id), spark: $("spark" + c.id),
    valve: { I: $("valve" + c.id + "I"), E: $("valve" + c.id + "E") },
    lobe: { I: $("lobe" + c.id + "I"), E: $("lobe" + c.id + "E") },
  })),
};
const pin0 = { A: V4.pinPoint(0, "A"), B: V4.pinPoint(0, "B") };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (n) => String(Math.round(n / 100) * 100).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

let theta = __THETA0__, rpm = 13000, target = 13000;
let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0;
const tourAt = (t) => 13250 - 5250 * Math.cos((t / 14) * Math.PI * 2);

function draw() {
  refs.wheel.innerHTML = V4.wheelSvg(X, theta);
  for (const p of ["A", "B"]) {
    const now = V4.pinPoint(theta, p);
    refs.pins[p].setAttribute("transform", translateAlong(P, [now[0] - pin0[p][0], 0, now[2] - pin0[p][2]]));
  }
  let latest = null, since = 1e9;
  for (const r of refs.cyl) {
    const { c } = r;
    const a = BANK[c.bank].a;
    const s = V4.pistonS(theta, c);
    const cyc = V4.cycleOf(theta, c);
    r.rod.innerHTML = V4.rodSvg(X, theta, c);
    r.piston.setAttribute("transform", translateAlong(P, [a[0] * s, 0, a[2] * s]));
    for (const kind of ["I", "E"]) {
      const lift = V4.liftOf(cyc, kind);
      const d = V4.valveDir(c.bank, kind);
      r.valve[kind].setAttribute("transform", translateAlong(P, [-d[0] * lift, 0, -d[2] * lift]));
      r.lobe[kind].innerHTML = V4.lobeSvg(X, theta, c, kind);
    }
    const f = V4.flameOf(cyc);
    r.flame.setAttribute("d", V4.flamePath(X, theta, c));
    r.flame.style.opacity = f.toFixed(3);
    r.spark.style.opacity = V4.sparkOf(cyc).toFixed(3);
    r.lamp.style.opacity = Math.min(1, f * 1.4).toFixed(3);
    const after = cyc < 360 ? cyc : 1e9;
    if (after < since) { since = after; latest = c.id; }
  }
  const text = `${fmt(rpm)} tr/min · explosion : cyl. ${latest}`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(rpm)));
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  rpm = still.matches ? target : rpm + (target - rpm) * (1 - Math.exp(-dt / 0.5));
  if (!still.matches) theta = (theta + (rpm / 60 / ENG.slow) * 360 * dt) % 720;
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, ENG.rpmMin, ENG.rpmMax);
  stage.setAttribute("aria-valuetext", `${fmt(target)} tours par minute`);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = Math.acos(clamp((13250 - target) / 5250, -1, 1)) / (Math.PI * 2) * 14; run(); }, 3600);
  if (still.matches) draw();
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(ENG.rpmMin + clamp((event.clientX - box.left) / box.width, 0, 1) * (ENG.rpmMax - ENG.rpmMin));
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 2000 : 500;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = ENG.rpmMin;
  if (event.key === "End") to = ENG.rpmMax;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
