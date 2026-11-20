// Anatomía de un Pikachu: un modelo de exhibición sobre un banco de medida.
// Las bolsas de las mejillas cargan, el voltímetro lo lee y la cola descarga.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 600, HEIGHT = 470;
const AZ = 45;

// Escala: 2 unidades = 1 cm. Altura canónica 0,4 m → 80 unidades desde el pedestal.
const PLATE = { x: -96, y: -78, w: 192, d: 150, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const PED_R = 34, PED_H = 6;               // pedestal giratorio (placa de tierra)
const STAND = 0 + PED_H;                    // donde apoyan los pies
const HEAD_Z = STAND + 61, HEAD_A = 22, HEAD_B = 19; // top de la cabeza = STAND + 80
const VOLT_MAX = 100000;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, STAND + 112], [-40, -40, STAND + 96], [40, 40, 0]],
  WIDTH, HEIGHT, { pad: 26, azimuth: AZ },
);
const a = (AZ * Math.PI) / 180;
const F = [Math.cos(a), Math.sin(a), 0];      // frente: hacia el espectador
const SD = [-Math.sin(a), Math.cos(a), 0];    // lateral
const UP = [0, 0, 1];
const C0 = [-8, -6];                          // centro del modelo en el banco
const W = (f, s, z) => [C0[0] + F[0] * f + SD[0] * s, C0[1] + F[1] * f + SD[1] * s, z];
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const path = (pts, close = false) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("") + (close ? "Z" : "");
const sdS = (sign) => SD.map((v) => v * sign);

// ---------- banco ----------
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const byDepth = (pts) => [...pts].sort((p, q) => k.depthOf([p[0], p[1], 0], P) - k.depthOf([q[0], q[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H / 2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // regla en el borde frontal
  const strip = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 14, w: 112, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // placa de identificación grabada
  const tag = { x: PLATE.x + PLATE.w - 46, y: PLATE.y + PLATE.d - 22, w: 36, d: 14, r: 1.4 };
  out.push(S(k.slabOf(tag, 0, 1, P, 3, 0.4), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 6], 1, P, "x"), "N.º 025", { size: 3, tone: "mid", anchor: "middle" }));
  out.push(L([10, 12.2].map((yy) => k.lineOnTop([tag.x + 6, tag.y + yy], [tag.x + tag.w - 6, tag.y + yy], 1, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([tag.x + 2.4, tag.y + 2.4, 1]), at([tag.x + tag.w - 2.4, tag.y + 2.4, 1]), at([tag.x + 2.4, tag.y + tag.d - 2.4, 1]), at([tag.x + tag.w - 2.4, tag.y + tag.d - 2.4, 1])], { size: 0.4 }));
  return out.join("");
}

// ---------- tallímetro: poste con escala y cursor a la altura de la coronilla ----------
const POST = W(-14, -54, 0);
const POST_TOP = STAND + 92;
function stadiometerPost() {
  const out = [];
  const base = { x: POST[0] - 9, y: POST[1] - 9, w: 18, d: 18, r: 2.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 4, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(base, 0, 4, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(base, 3).map(([x, y]) => at([x, y, 4])), { size: 0.45 }));
  const col = { x: POST[0] - 3.5, y: POST[1] - 3.5, w: 7, d: 7, r: 0.6 };
  out.push(S(k.slabOf(col, 4, POST_TOP - 4, P, 2, 0.4), { tone: "mid" }));
  // escala en la cara +y: marcas cada 1 cm (2 u), mayores cada 5 cm, colgando de la arista frontal
  const minor = [], major = [];
  for (let i = 0; i <= 40; i++) {
    const z = STAND + i * 2, len = i % 5 === 0 ? 3.4 : 1.8;
    const ex = col.x + col.w;
    (i % 5 === 0 ? major : minor).push(k.segment([ex, col.y + col.d, z], [ex - len, col.y + col.d, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(POST[0], POST[1], 4.6, POST_TOP, 2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(POST[0], POST[1], 2, POST_TOP + 2, 1.4, P, 16), { tone: "mid" }));
  return out.join("");
}
function stadiometerCursor() {
  const out = [];
  const z = HEAD_Z + HEAD_B;           // 80 u = 40 cm sobre el pedestal
  const col = { x: POST[0] - 5.5, y: POST[1] - 5.5, w: 11, d: 11, r: 1.4 };
  out.push(S(k.slabOf(col, z - 4, 8, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(col, z, P, 3), { tone: "faint" }) }));
  const knob = [POST[0] - 8.5, POST[1]];
  out.push(S(k.slabOf({ x: knob[0], y: knob[1] - 1.2, w: 3, d: 2.4, r: 0.6 }, z - 1.2, 2.4, P, 2), { tone: "mid", crease: "none" }));
  // pestaña que apunta hacia la coronilla, a lo largo de +SD
  const tab = [];
  for (const [f, s] of [[-1.6, 0], [-1.6, 12], [0, 15], [1.6, 12], [1.6, 0]]) tab.push([POST[0] + F[0] * f + SD[0] * (s + 4), POST[1] + F[1] * f + SD[1] * (s + 4)]);
  out.push(S(k.extrude(tab, z - 0.6, 1.2, P), { tone: "hi", lit: true }));
  out.push(D([at([POST[0] + SD[0] * 7, POST[1] + SD[1] * 7, z + 0.6])], { size: 0.4 }));
  return out.join("");
}

// ---------- pedestal (placa de tierra) ----------
const PED = W(0, 0, 0);
function pedestal() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: PED[0] - PED_R, y: PED[1] - PED_R, w: PED_R * 2, d: PED_R * 2, r: PED_R }, 0, PED_H, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.cylinder(PED[0], PED[1], PED_R, 0, 2, P, 72), { tone: "mid" }));
  out.push(S(k.cylinder(PED[0], PED[1], PED_R - 2, 2, PED_H - 2, P, 72, 0.8), { tone: "mid" }));
  out.push(L(k.knurl(PED[0], PED[1], PED_R - 2, 2.6, PED_H - 0.6, 96, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(PED[0], PED[1], PED_R - 6, STAND, P, 72), { tone: "lo" }));
  const ticks = k.radialTicks(PED[0], PED[1], PED_R - 6.5, 48, 4, STAND, [1, 2.2], P);
  out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "lo" }));
  return out.join("");
}
// borne de tierra en el canto del pedestal
const LUG = W(10, -27, 0);
function lug() {
  const out = [];
  out.push(S(k.cylinder(LUG[0], LUG[1], 3, PED_H, 2.4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(LUG[0], LUG[1], 3, PED_H + 0.3, PED_H + 2.1, 14, P), { tone: "lo" }));
  out.push(S(k.cylinder(LUG[0], LUG[1], 1.6, PED_H + 2.4, 2.2, P, 16), { tone: "mid" }));
  return out.join("");
}

// ---------- voltímetro ----------
const VM = [52, 38];
const VM_R = 19, VM_Z = 12, VM_H = 6, VM_TOP = VM_Z + VM_H;
const SWEEP = 1.5 * Math.PI, FROM = -0.75 * Math.PI;
function voltmeter() {
  const out = [];
  const [x, y] = VM;
  const box = { x: x - 24, y: y - 24, w: 48, d: 48, r: 4 };
  out.push(`<path class="iso-halo" d="${k.haloOf(box, 0, VM_Z, P)}" style="filter:blur(4px)"/>`);
  out.push(S(k.slabOf(box, 0, VM_Z, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(box, 4, P, 6), { tone: "faint" }) }));
  out.push(D(k.corners(box, 3.6).map(([px, py]) => at([px, py, VM_Z])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, VM_R + 1.6, VM_Z, 2, P, 64), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, VM_R, VM_Z + 2, VM_H - 2, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, VM_R, VM_Z + 2.4, VM_TOP - 0.4, 80, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, VM_R - 2, VM_TOP, P, 64), { tone: "lo" }));
  const t = k.radialTicks(x, y, VM_R - 3, 50, 5, VM_TOP, [1.3, 2.8], P, FROM, SWEEP);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // zona roja de 80 a 100 kV
  const red = [];
  for (let i = 0; i <= 16; i++) { const g = FROM + SWEEP * (0.8 + 0.2 * i / 16); red.push(at([x + Math.sin(g) * (VM_R - 3.6), y - Math.cos(g) * (VM_R - 3.6), VM_TOP])); }
  out.push(L(path(red), { tone: "red" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 9], VM_TOP, P, "x"), "kV", { size: 3, tone: "lo", anchor: "middle" }));
  // borne del voltímetro
  out.push(S(k.cylinder(x - 18, y - 18, 2.6, VM_Z, 2.4, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(x - 18, y - 18, 1.4, VM_Z + 2.4, 2, P, 14), { tone: "mid" }));
  // perilla de ajuste
  out.push(S(k.cylinder(x + 16, y + 16, 3.4, VM_Z, 3.6, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(x + 16, y + 16, 3.4, VM_Z + 0.4, VM_Z + 3.4, 22, P), { tone: "lo" }));
  return out.join("");
}
const needleAt = (q) => {
  const g = -0.75 * Math.PI + 1.5 * Math.PI * q;
  return k.lineOnTop([VM[0] - Math.sin(g) * 3.4, VM[1] + Math.cos(g) * 3.4], [VM[0] + Math.sin(g) * (VM_R - 4), VM[1] - Math.cos(g) * (VM_R - 4)], VM_TOP + 0.2, P);
};

// ---------- el personaje ----------
const ellip = (A, B, c) => ({
  radius: (s) => A * Math.sqrt(Math.max(0, 1 - ((s - c) / B) ** 2)),
  slope: (s) => { const u = (s - c) / B; const q = Math.max(1e-4, 1 - u * u); return (-A * u) / (B * Math.sqrt(q)); },
});
const ellipsoid = (F0, A, B, s0, s1, n = 24) => {
  const e = ellip(A, B, 0); const prof = [];
  for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; prof.push([s, Math.max(0.05, e.radius(s)), 1]); }
  return G.solidOf(prof, F0, P, { smooth: { slope: e.slope, radius: (s) => Math.max(0.05, e.radius(s)) } });
};

function feet() {
  return [1, -1].map((sg) => {
    const Ff = G.frameAlong(W(4, 9 * sg, STAND + 3.2), G.unit3([F[0] + SD[0] * 0.25 * sg, F[1] + SD[1] * 0.25 * sg, 0]));
    return S(ellipsoid(Ff, 5.6, 9, -8.9, 8.9), { tone: "hi", className: "pk-y" });
  }).join("");
}
function body() {
  const Fb = G.frameOf([PED[0], PED[1], STAND], UP, [1, 0, 0], [0, 1, 0]);
  const r = (s) => { const u = s / 50; return Math.max(0.2, 21 * Math.sin(Math.PI * Math.min(1, u * 0.78 + 0.08)) * (1 - 0.35 * u)); };
  const prof = []; for (let i = 0; i <= 28; i++) { const s = 2 + 48 * i / 28; prof.push([s, r(s), 1]); }
  const sl = (s) => (r(s + 0.01) - r(s - 0.01)) / 0.02;
  return S(G.solidOf(prof, Fb, P, { smooth: { slope: sl, radius: r } }), { tone: "hi", className: "pk-y" })
    + L(G.arcOf(Fb, 22, r(22), P, { slope: sl(22) }), { tone: "faint", className: "pk-stripe-line" });
}
// rayas pardas en la espalda: bandas en la parte trasera (casi ocultas) — se ven de perfil
function arms() {
  return [1, -1].map((sg) => {
    const c = W(13, 12 * sg, STAND + 34);
    const Fa = G.frameAlong(c, G.unit3([F[0] * 0.8 + SD[0] * 0.3 * sg, F[1] * 0.8 + SD[1] * 0.3 * sg, -0.5]));
    return S(ellipsoid(Fa, 3.8, 7.5, -7.4, 7.4), { tone: "hi", className: "pk-y" });
  }).join("");
}
const HC = [PED[0], PED[1], HEAD_Z];
function head() {
  const Fh = G.frameOf([HC[0], HC[1], HC[2]], UP, [1, 0, 0], [0, 1, 0]);
  return S(ellipsoid(Fh, HEAD_A, HEAD_B, -HEAD_B + 0.1, HEAD_B - 0.1, 30), { tone: "hi", className: "pk-y" });
}
// punto de la superficie de la cabeza: acimut desde el frente (+ hacia +SD) y elevación
const onHead = (az, el, lift = 0) => {
  const dir = [F[0] * Math.cos(az) + SD[0] * Math.sin(az), F[1] * Math.cos(az) + SD[1] * Math.sin(az)];
  const p = [HC[0] + dir[0] * HEAD_A * Math.cos(el), HC[1] + dir[1] * HEAD_A * Math.cos(el), HC[2] + HEAD_B * Math.sin(el)];
  const n = G.unit3([dir[0] * Math.cos(el) / HEAD_A, dir[1] * Math.cos(el) / HEAD_A, Math.sin(el) / HEAD_B]);
  return { p: G.add3(p, G.mul3(n, lift)), n };
};
function ears() {
  return [1, -1].map((sg) => {
    const root = onHead(sg * Math.PI / 2 * 0.62, 0.95, -3).p;
    const axis = G.unit3([SD[0] * 0.5 * sg - F[0] * 0.12, SD[1] * 0.5 * sg - F[1] * 0.12, 0.86]);
    const Fe = G.frameAlong(root, axis);
    const L0 = 36;
    const r = (s) => s < 0 ? 6.6 : Math.max(0.05, (6.6 + 1.2 * Math.sin(Math.PI * Math.min(1, s / 18))) * Math.pow(1 - s / L0, 0.8));
    const sl = (s) => (r(s + 0.01) - r(s - 0.01)) / 0.02;
    const prof = (s0, s1, n) => { const o = []; for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; o.push([s, Math.max(0.05, r(s)), 1]); } return o; };
    const opt = { smooth: { slope: sl, radius: (s) => Math.max(0.05, r(s)) } };
    return S(G.solidOf(prof(0, 25, 20), Fe, P, opt), { tone: "hi", className: "pk-y" })
      + S(G.solidOf(prof(25, L0 - 0.05, 10), Fe, P, opt), { tone: "hi", className: "pk-k" });
  }).join("");
}
// un disco o un óvalo sobre la superficie de la cabeza
const patch = (az, el, r, h, cls, tone = "hi") => {
  const { p, n } = onHead(az, el, -0.6);
  const Fp = G.frameAlong(p, n);
  return S(G.disc(0, h, r, Fp, P), { tone, className: cls });
};
function face() {
  const out = [];
  for (const sg of [1, -1]) {
    out.push(patch(sg * 0.42, 0.22, 3.6, 1.2, "pk-k"));
    const hl = onHead(sg * 0.42 - 0.06, 0.29, 0.9).p;
    out.push(`<circle class="pk-glint" cx="${at(hl)[0].toFixed(2)}" cy="${at(hl)[1].toFixed(2)}" r="0.85"/>`);
  }
  out.push(D([at(onHead(0, -0.02, 0.4).p)], { size: 0.8, tone: "hi" }));
  const m = []; for (let i = 0; i <= 16; i++) { const u = -1 + 2 * i / 16; m.push(at(onHead(u * 0.2, -0.17 + 0.05 * Math.abs(Math.sin(u * Math.PI)), 0.2).p)); }
  out.push(`<path class="pk-mouth" data-free="" d="${path(m)}"/>`);
  return out.join("");
}
const CHEEK = (sg) => ({ az: sg * 0.64, el: -0.2, r: 5.2 });
function cheeks() {
  return [1, -1].map((sg) => {
    const c = CHEEK(sg);
    const { p } = onHead(c.az, c.el, 0.6);
    const [cx, cy] = at(p);
    return patch(c.az, c.el, c.r, 1.3, "pk-r", "hi")
      + `<ellipse class="pk-glow" data-part="glow" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${(c.r * 2.1 * P.scale).toFixed(2)}" ry="${(c.r * 1.8 * P.scale).toFixed(2)}" opacity="0"/>`;
  }).join("");
}
// chispas: trazos en zigzag que nacen del borde de cada mejilla
function sparks() {
  const out = [];
  [1, -1].forEach((sg) => {
    const c = CHEEK(sg);
    for (let j = 0; j < 3; j++) {
      const o = onHead(c.az, c.el, 0.8).p;
      const [ox, oy] = at(o);
      const [hx, hy] = at(HC);
      const base0 = Math.atan2(oy - hy, ox - hx);
      const ang = base0 + (j - 1) * 0.6;
      const dirScreen = [Math.cos(ang), Math.sin(ang)];
      const base = [ox + dirScreen[0] * c.r * P.scale * 1.05, oy + dirScreen[1] * c.r * P.scale * 1.05];
      const pts = [base];
      for (let i = 1; i <= 4; i++) {
        const t = i * 3.2 * P.scale;
        const wob = (i % 2 ? 1 : -1) * 1.8 * P.scale;
        pts.push([base[0] + dirScreen[0] * t - dirScreen[1] * wob, base[1] + dirScreen[1] * t + dirScreen[0] * wob]);
      }
      out.push(`<path class="iso-line pk-spark" data-tone="lit" data-free="end" data-part="spark" d="${path(pts)}" opacity="0"/>`);
    }
  });
  return out.join("");
}

// ---------- la cola en forma de rayo: placa gruesa en el plano lateral ----------
const TAIL_F = -17, TAIL_T = 3.2;
const tailPt = (u, v, f = TAIL_F) => W(f, u, STAND + v);
function plateSolid(poly, f0, t) {
  const front = poly.map(([u, v]) => at(tailPt(u, v, f0 + t / 2)));
  const back = poly.map(([u, v]) => at(tailPt(u, v, f0 - t / 2)));
  const strips = [];
  const n = poly.length;
  // la normal hacia fuera de cada arista en el plano (u, v); se ven las que miran hacia arriba
  let area = 0; for (let i = 0; i < n; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
  const cw = area < 0;
  for (let i = 0; i < n; i++) {
    const [u1, v1] = poly[i], [u2, v2] = poly[(i + 1) % n];
    let nu = v2 - v1, nv = -(u2 - u1); if (cw) { nu = -nu; nv = -nv; }
    if (nv > 0.02) strips.push({ d: path([front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]], true), up: nv / Math.hypot(nu, nv) });
  }
  const top = strips.map((s) => s.d).join("");
  const faceD = path(front, true);
  return {
    fill: faceD + top,
    shades: ["", "", "", faceD],
    top,
    crease: "",
    outline: faceD + strips.map((s) => s.d).join(""),
  };
}
// contorno del rayo en (u lateral, v altura)
const BOLT = [[13, 11], [27, 20], [21, 25], [41, 34], [34, 40], [62, 56], [50, 84], [26, 50], [33, 46], [18, 35], [24, 31], [10, 20]];
const STEM = [[3, 5], [14, 11], [11, 20], [2, 15]];
function tail() {
  return S(plateSolid(STEM, TAIL_F, TAIL_T), { tone: "hi", className: "pk-b" })
    + S(plateSolid(BOLT, TAIL_F, TAIL_T), { tone: "hi", className: "pk-y" });
}
// rayas pardas de la espalda (vistas por encima de los hombros, sobre la cola)
// descarga: un rayo que sale de la punta de la cola hacia arriba
function discharge() {
  const tip = at(tailPt(50, 84, TAIL_F + TAIL_T / 2));
  const pts = [tip]; let [x, y] = tip;
  const steps = [[4, -9], [-5, -6], [6, -10], [-4, -7], [7, -11], [-3, -8]];
  for (const [dx, dy] of steps) { x += dx * 1.0; y += dy * 1.0; pts.push([x, y]); }
  return `<path class="iso-line pk-bolt" data-tone="lit" data-free="end" data-part="bolt" d="${path(pts)}" opacity="0"/>`;
}

// ---------- cable de tierra del pedestal al voltímetro ----------
function wire() {
  const from = at([LUG[0], LUG[1], PED_H + 4.6]);
  const to = at([VM[0] - 18, VM[1] - 18, VM_Z + 4.4]);
  const rim = at([LUG[0] + 2, LUG[1] - 6, PED_H]);
  const floor1 = at([LUG[0] + 6, LUG[1] - 14, 0]);
  const floor2 = at([VM[0] - 30, VM[1] - 26, 0]);
  return k.wireSvg(from, to, { via: [rim, floor1, floor2], tone: "mid", size: 1.2 });
}

const STYLE = `<style>
.pk-y{--anatomy-shade-0:#7a5c0c;--anatomy-shade-1:#9c7812;--anatomy-shade-2:#bd951b;--anatomy-shade-3:#d8ae24;--anatomy-top:#e9c22e;--anatomy-hi:#3a2c06}
.pk-k{--anatomy-shade-0:#050505;--anatomy-shade-1:#0b0b0b;--anatomy-shade-2:#121212;--anatomy-shade-3:#1a1a1a;--anatomy-top:#222;--anatomy-hi:#000}
.pk-b{--anatomy-shade-0:#3e2410;--anatomy-shade-1:#4e2e14;--anatomy-shade-2:#603a1a;--anatomy-shade-3:#724622;--anatomy-top:#87562c;--anatomy-hi:#24140a}
.pk-r{--anatomy-shade-0:#8a1a16;--anatomy-shade-1:#a8231d;--anatomy-shade-2:#c52d25;--anatomy-shade-3:#dc392f;--anatomy-top:#ea4a3e;--anatomy-hi:#5a0e0b}
.pk-glint{fill:#fff}
.pk-mouth{fill:none;stroke:#3a2c06;stroke-width:.7;stroke-linecap:round;stroke-linejoin:round}
.pk-glow{fill:url(#pk-glow);mix-blend-mode:screen;pointer-events:none}
.pk-spark{stroke-width:.9;stroke:#fff6b0}
.pk-bolt{stroke-width:1.6;stroke:#fff6b0;filter:drop-shadow(0 0 3px #ffe14a)}
[data-theme="light"] .pk-y{--anatomy-shade-0:#c99a12;--anatomy-shade-1:#dcab17;--anatomy-shade-2:#ebbb1f;--anatomy-shade-3:#f5c928;--anatomy-top:#fcd73a;--anatomy-hi:#5a4200}
[data-theme="light"] .pk-glow{mix-blend-mode:multiply;fill:url(#pk-glow-l)}
[data-theme="light"] .pk-spark,[data-theme="light"] .pk-bolt{stroke:#d9a400;filter:none}
</style>`;
const DEFS = `<defs>
<radialGradient id="pk-glow"><stop offset="0" stop-color="#ffd84a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff5a2a" stop-opacity=".45"/><stop offset="1" stop-color="#ff3a1a" stop-opacity="0"/></radialGradient>
<radialGradient id="pk-glow-l"><stop offset="0" stop-color="#ff8a3a" stop-opacity=".7"/><stop offset=".5" stop-color="#ffc04a" stop-opacity=".35"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>
</defs>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Modelo anatómico de un Pikachu sobre un banco de medida. Está de pie en un pedestal que sirve de placa de tierra; un tallímetro marca su altura de 40 cm. Un cable lleva la tierra del pedestal a un voltímetro. Al cargar, las bolsas eléctricas de las mejillas se iluminan y la aguja sube hasta 100 kV; al soltar, la cola en forma de rayo descarga.",
  body: [
    STYLE, DEFS,
    bench(),
    stadiometerPost(),
    pedestal(),
    tail(),
    feet(),
    body(),
    arms(),
    ears(),
    head(),
    face(),
    cheeks(),
    stadiometerCursor(),
    lug(),
    voltmeter(),
    wire(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
    sparks(),
    discharge(),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const VM = ${JSON.stringify(VM)}, VM_R = ${VM_R}, VM_TOP = ${VM_TOP};
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const needle = svg.querySelector('[data-part="needle"]');
const glows = [...svg.querySelectorAll('[data-part="glow"]')];
const sparks = [...svg.querySelectorAll('[data-part="spark"]')];
const bolt = svg.querySelector('[data-part="bolt"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let q = 0, holding = false, touring = !still.matches, clock = 0, flash = 0, last = 0, frame = 0, visible = false, idle = 0, t = 0;
const TOUR = 5.2;
function release() { if (q > 0.15) flash = Math.min(1, q * 1.1); holding = false; }
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now; t += dt;
  if (touring) {
    clock += dt; const ph = clock % TOUR;
    const want = ph < 3 ; if (holding && !want) release(); holding = want;
  }
  if (holding) q += (1 - q) * (1 - Math.exp(-dt / 0.9));
  else q += (0 - q) * (1 - Math.exp(-dt / (flash > 0.05 ? 0.12 : 0.6)));
  flash *= Math.exp(-dt / 0.22);
  if (q < 0.0005) q = 0;
  needle.setAttribute("d", needleAt(q));
  const g = still.matches ? q : q * (0.86 + 0.14 * Math.sin(t * 23) * Math.sin(t * 7.1));
  glows.forEach((e) => e.setAttribute("opacity", g.toFixed(3)));
  sparks.forEach((e, i) => { const f = q > 0.45 ? Math.max(0, Math.sin(t * (17 + i * 3.3) + i * 1.7)) ** 6 * (q - 0.45) / 0.55 : 0; e.setAttribute("opacity", (still.matches ? 0 : f).toFixed(3)); });
  bolt.setAttribute("opacity", (flash > 0.02 ? flash * (0.7 + 0.3 * Math.sin(t * 60)) : 0).toFixed(3));
  const v = Math.round(q * 100) * 1000;
  const text = (flash > 0.2 ? "descarga · " : holding ? "cargando · " : "en reposo · ") + v.toLocaleString("es-CO") + " V";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(q * 100)));
  stage.setAttribute("aria-valuetext", text);
  const settled = !touring && !holding && q === 0 && flash < 0.01;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const user = () => { touring = false; clearTimeout(idle); };
const later = () => { idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000); };
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", (e) => { user(); holding = true; stage.setPointerCapture?.(e.pointerId); run(); });
const up = () => { if (holding) { release(); later(); run(); } };
stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
stage.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); user(); holding = true; run(); } });
stage.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") up(); });
needle.setAttribute("d", needleAt(0));
run();
`;

const body_ = k.plateHtml({
  fig: "Fig 25",
  title: "Pikachu, anatomía",
  hint: "Mantén pulsado para cargar · suelta para descargar",
  readout: "en reposo · 0 V",
  keys: [
    { mark: "lit", label: "Bolsas eléctricas de las mejillas y aguja del voltímetro: lo que cambia con la carga" },
    { mark: "raised", label: "Cola en forma de rayo, orejas de punta negra y pedestal de tierra" },
    { mark: "dim", label: "Tallímetro: 40 cm de altura (0,4 m · 6,0 kg)" },
  ],
  caption:
    "Modelo de exhibición de un Pikachu, el Pokémon ratón. Guarda la electricidad en las bolsas de las mejillas: mantén pulsado y la carga sube hacia los 100 000 V del ataque Rayo (en japonés, «10 man volt», cien mil voltios); al soltar, la energía sale por la cola. Mide 0,4 m y pesa 6,0 kg.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Carga de las mejillas: mantén pulsado o pulsa la barra espaciadora para cargar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
});
const name = theme === "light" ? "pikachu-light.html" : "pikachu.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Anatomía de Pikachu", theme, body: body_, script: kitScript() + live }));
console.log("wrote", name);
