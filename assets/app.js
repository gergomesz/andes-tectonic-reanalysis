
(function () {
  "use strict";
  const D = window.DATA;

  (function themeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const root = document.documentElement;
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    let stored = null;
    try { stored = localStorage.getItem("rtp-theme"); } catch (e) { /* storage unavailable */ }
    if (stored === "dark" || stored === "light") root.setAttribute("data-theme", stored);
    const current = () => root.getAttribute("data-theme") || (mq && mq.matches ? "dark" : "light");
    const label = () => {
      const dark = current() === "dark";
      btn.setAttribute("aria-pressed", String(dark));
      btn.querySelector("span").textContent = dark ? "Light mode" : "Dark mode";
    };
    btn.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("rtp-theme", next); } catch (e) 
      label();
    });
    if (mq && mq.addEventListener) mq.addEventListener("change", label);
    new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    label();
  })();
  const NS = "http://www.w3.org/2000/svg";
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PROV = ["Puna Plateau", "Eastern Cordillera", "Pampean Ranges"];
  const PCLS = { "Puna Plateau": "m-puna", "Eastern Cordillera": "m-ec", "Pampean Ranges": "m-pr" };
  const PSHORT = { "Puna Plateau": "Puna", "Eastern Cordillera": "E. Cordillera", "Pampean Ranges": "Pampean" };
  const FAULT = { 1: "Reverse fault", 2: "Inferred reverse", 3: "Normal fault", 4: "Inferred normal", 5: "Strike-slip", 6: "Inferred strike-slip", 7: "Photolineament" };
  const E1 = D.classEdges.class1_max, E2 = D.classEdges.class2_max;

  function S(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor) {
    const t = S("text", { x, y, class: cls || "lbl", "text-anchor": anchor || "start" }, parent);
    t.textContent = s;
    return t;
  }
  function mathLabel(parent, x, y, base, sub, anchor) {
    const t = S("text", { x, y, class: "math", "text-anchor": anchor || "start" }, parent);
    t.appendChild(document.createTextNode(base));
    if (sub) { const s = S("tspan", { "baseline-shift": "sub", "font-size": "11" }, t); s.textContent = sub; }
    return t;
  }
  function clear(svg) { while (svg.lastChild) svg.removeChild(svg.lastChild); }
  function hatchDef(svg, id, gap, angle, cls) {
    let defs = svg.querySelector("defs") || S("defs", null, svg);
    if (svg.querySelector("#" + id)) return;
    const p = S("pattern", { id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: "rotate(" + angle + ")" }, defs);
    S("line", { x1: 0, y1: 0, x2: 0, y2: gap, class: cls || "hatch-line" }, p);
  }
  function arrowHead(parent, x, y, ang, size) {
    const s = size || 7, a = ang, w = 0.45;
    const p1 = [x - s * Math.cos(a - w), y - s * Math.sin(a - w)];
    const p2 = [x - s * Math.cos(a + w), y - s * Math.sin(a + w)];
    return S("path", { d: `M${p1} L${x},${y} L${p2}`, class: "ln thin" }, parent);
  }
  function arrow(parent, x1, y1, x2, y2, cls) {
    S("line", { x1, y1, x2, y2, class: cls || "ln thin" }, parent);
    arrowHead(parent, x2, y2, Math.atan2(y2 - y1, x2 - x1));
  }
  function marker(parent, prov, x, y, r) {
    const g = S("g", { class: "mk", transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, parent);
    r = r || 4;
    if (prov === "Pampean Ranges") {
      S("path", { d: `M${-r},${-r} L${r},${r} M${-r},${r} L${r},${-r}`, class: "m-pr" }, g);
      S("circle", { r: r + 2, fill: "transparent" }, g);
    } else {
      S("circle", { r, class: PCLS[prov] }, g);
    }
    return g;
  }
  function legendInto(el) {
    if (!el) return;
    el.innerHTML = "";
    PROV.forEach((p) => {
      const span = document.createElement("span");
      const svg = S("svg", { viewBox: "-6 -6 12 12", "aria-hidden": "true" });
      marker(svg, p, 0, 0, 4);
      span.appendChild(svg);
      span.appendChild(document.createTextNode(p));
      el.appendChild(span);
    });
  }
  function fmt(x, d) { return Number(x).toFixed(d == null ? 2 : d); }
  function hashJitter(id) { const s = Math.sin(id * 12.9898) * 43758.5453; return s - Math.floor(s) - 0.5; }
  function median(a) { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; }
  function ranks(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1;
    }
    return r;
  }
  function spearman(x, y) {
    const rx = ranks(x), ry = ranks(y), n = x.length;
    const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
    return num / Math.sqrt(dx * dy);
  }
  function smfClass(v) { return v <= E1 ? 1 : v <= E2 ? 2 : 3; }

  function makeTip(container) {
    const tip = document.createElement("div");
    tip.className = "tip"; tip.hidden = true; container.appendChild(tip);
    let pinned = null;
    function show(evt, html, node) {
      tip.innerHTML = html; tip.hidden = false;
      const r = container.getBoundingClientRect();
      let x = evt.clientX - r.left + 14, y = evt.clientY - r.top + 14;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > r.width) x = Math.max(0, evt.clientX - r.left - w - 14);
      if (y + h > r.height) y = Math.max(0, evt.clientY - r.top - h - 14);
      tip.style.left = x + "px"; tip.style.top = y + "px";
      container.querySelectorAll(".mk.on").forEach((m) => m.classList.remove("on"));
      if (node) node.classList.add("on");
    }
    function hide() { tip.hidden = true; container.querySelectorAll(".mk.on").forEach((m) => m.classList.remove("on")); pinned = null; }
    function bind(node, html) {
      node.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(e, html, node); });
      node.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && pinned !== node) hide(); });
      node.addEventListener("click", (e) => { e.stopPropagation(); if (pinned === node) { hide(); return; } show(e, html, node); pinned = node; });
    }
    container.addEventListener("click", hide);
    return { bind, hide };
  }
  function frontTip(f) {
    return `<b>Segment ${f.segment_id} · ${PSHORT[f.province]}</b><br>S<sub>mf</sub> ${fmt(f.smf)} · Class ${f["class"]}<br>${FAULT[f.fault_type] || "Fault"}${f.age ? " · " + f.age : ""}<br>Median V<sub>f</sub> ${fmt(f.vf_median)} · ${f.n_basins} basins`;
  }


  function drawOn(root) {
    if (REDUCED || !root) return;
    root.querySelectorAll("[data-draw]").forEach((p) => {
      if (!p.getTotalLength) return;
      const L = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = L + " " + L;
      p.style.strokeDashoffset = L;
      p.getBoundingClientRect();
      requestAnimationFrame(() => {
        p.style.transition = "";
        p.style.strokeDashoffset = 0;
        const done = () => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; };
        p.addEventListener("transitionend", done, { once: true });
        setTimeout(done, 2200);
      });
    });
  }
  document.querySelectorAll(".eli-btn").forEach((b) => b.addEventListener("click", () => {
    const panel = document.getElementById(b.getAttribute("aria-controls"));
    if (!panel) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  }));
  document.querySelectorAll("[data-replay]").forEach((b) => b.addEventListener("click", () => drawOn(document.getElementById(b.dataset.replay))));


  (function smfPlate() {
    const svg = document.getElementById("smf-svg");
    const slider = document.getElementById("smf-slider");
    const VX = [112, 186, 252, 330, 402, 472, 546, 612, 690];
    const DF = [0.9, 0.6, 1.1, 0.7, 1.0, 0.8, 1.2, 0.65, 0.95];
    const WF = [1, 0.8, 1.2, 0.9, 1, 0.85, 1.1, 0.9, 1];
    const X0 = 60, X1 = 740, FAULT_Y = 262;
    function render() {
      const e = slider.value / 100;
      clear(svg);
      hatchDef(svg, "hx-range", 6, 45);
      const y0 = 246 - e * 26;
      const depth = (i) => 150 * e * DF[i];
      const half = (i) => (9 + 24 * e) * WF[i];
      const pts = [];
      for (let x = X0; x <= X1; x += 1.5) {
        let y = y0;
        for (let i = 0; i < VX.length; i++) {
          const u = (x - VX[i]) / half(i);
          if (Math.abs(u) < 1) y -= depth(i) * (1 + Math.cos(Math.PI * u)) / 2;
        }
        pts.push([x, y]);
      }
      let L = 0;
      for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const Ls = X1 - X0, smf = L / Ls;
      const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

      const back = pts.slice().reverse().map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      S("path", { d: `M${X0} 30 L${X1} 30 ${back} Z`, fill: "url(#hx-range)", stroke: "none" }, svg);

      VX.forEach((vx, i) => {
        const apex = y0 - depth(i);
        S("path", { d: `M${vx} ${apex + 2} L${vx} ${y0 + 34 + 16 * e}`, class: "ln faint" }, svg);
        const r = 10 + 18 * e * DF[i];
        S("path", { d: `M${vx - r} ${y0 + 6} A ${r} ${r * 0.8} 0 0 0 ${vx + r} ${y0 + 6}`, class: "ln faint" }, svg);
      });
      S("path", { d: line, class: "ln bold" }, svg);

      S("line", { x1: X0, y1: FAULT_Y, x2: X1, y2: FAULT_Y, class: "ln thin" }, svg);
      for (let x = X0 + 20; x < X1; x += 44) S("path", { d: `M${x - 5} ${FAULT_Y} L${x} ${FAULT_Y - 7} L${x + 5} ${FAULT_Y} Z`, class: "fill-ink" }, svg);

      const dy = 312;
      S("line", { x1: X0, y1: dy - 8, x2: X0, y2: dy + 8, class: "ln thin" }, svg);
      S("line", { x1: X1, y1: dy - 8, x2: X1, y2: dy + 8, class: "ln thin" }, svg);
      arrow(svg, 400, dy, X0 + 1, dy); arrow(svg, 400, dy, X1 - 1, dy);
      mathLabel(svg, 400, dy - 8, "L", "s", "middle");

      txt(svg, X1 + 8, 60, "Range", "lbl"); txt(svg, X1 + 8, 72, "uplifted block", "lbl-sub");
      txt(svg, X1 + 8, FAULT_Y + 4, "Fault", "lbl");
      txt(svg, X1 + 8, FAULT_Y + 16, "stays straight", "lbl-sub");
      txt(svg, X0, 352, "Piedmont · alluvial fans", "lbl-sub");
      const lx = 290, ly = pts[Math.round((lx - X0) / 1.5)][1];
      S("line", { x1: lx, y1: ly, x2: lx + 34, y2: 18, class: "ln thin" }, svg);
      S("circle", { cx: lx, cy: ly, r: 2.2, class: "fill-ink" }, svg);
      const t = mathLabel(svg, lx + 38, 22, "L", "mf");
      txt(svg, lx + 66, 22, "mountain front, measured along every bend", "lbl-sub");
      txt(svg, 8, 22, "N ↑", "lbl");

      document.getElementById("smf-slider-v").textContent = Math.round(e * 100) + "%";
      document.getElementById("smf-val").textContent = fmt(smf);
      const c = smfClass(smf);
      document.getElementById("smf-class").textContent = ["", "Class 1 · Holocene activity", "Class 2 · late Neogene to Holocene", "Class 3 · Neogene or older"][c];
      document.getElementById("smf-lens").innerHTML = `L<sub>mf</sub> ${Math.round(L)} · L<sub>s</sub> ${Ls} (drawing units)`;
    }
    slider.addEventListener("input", render);
    render();
  })();


  (function vfPlate() {
    const svg = document.getElementById("vf-svg");
    const slider = document.getElementById("vf-slider");
    const M = 4; // metres per drawing unit
    const LD = [90, 70], RD = [730, 90], BASE = 352, AX = 44;
    function render() {
      const u = slider.value / 100;
      const W = 240 + (6 - 240) * u;
      const relief = 110 + (250 - 110) * u;
      const fy = LD[1] + relief;
      const fl = 410 - W / 2, fr = 410 + W / 2;
      clear(svg);
      hatchDef(svg, "hx-ground", 7, 45);
      const prof = `M${LD[0]} ${LD[1]} Q ${(LD[0] + fl) / 2 - 20} ${(LD[1] + fy) / 2 - 18}, ${fl} ${fy} L${fr} ${fy} Q ${(fr + RD[0]) / 2 + 20} ${(RD[1] + fy) / 2 - 18}, ${RD[0]} ${RD[1]}`;
      S("path", { d: prof + ` L${RD[0] + 30} ${RD[1] + 4} L${RD[0] + 30} ${BASE} L${LD[0] - 30} ${BASE} L${LD[0] - 30} ${LD[1] + 4} Z`, fill: "url(#hx-ground)", stroke: "none" }, svg);
      S("path", { d: `M${LD[0] - 30} ${LD[1] + 4} L${LD[0]} ${LD[1]} ` + prof.slice(prof.indexOf("Q")) + ` L${RD[0] + 30} ${RD[1] + 4}`, class: "ln bold" }, svg);

      const ww = Math.max(4, Math.min(30, W * 0.5));
      S("line", { x1: 410 - ww / 2, y1: fy - 1, x2: 410 + ww / 2, y2: fy - 1, class: "ln" }, svg);
      S("path", { d: `M404 ${fy - 16} l12 0 l-6 9 z`, class: "ln thin" }, svg);
      S("line", { x1: 405, y1: fy - 4, x2: 415, y2: fy - 4, class: "ln thin" }, svg);

      S("line", { x1: AX, y1: 40, x2: AX, y2: BASE - 10, class: "axis" }, svg);
      [[LD[1], "E", "ld", LD[0]], [RD[1], "E", "rd", RD[0]], [fy, "E", "sc", fl]].forEach(([y, b, s, x]) => {
        S("line", { x1: AX, y1: y, x2: x, y2: y, class: "ln faint dash" }, svg);
        S("line", { x1: AX - 5, y1: y, x2: AX, y2: y, class: "axis" }, svg);
        mathLabel(svg, AX - 8, y + 5, b, s, "end");
      });
      S("line", { x1: RD[0], y1: RD[1], x2: RD[0] + 30, y2: RD[1], class: "ln faint dash" }, svg);

      [LD, RD].forEach(([x, y], i) => { S("circle", { cx: x, cy: y, r: 2.4, class: "fill-ink" }, svg); txt(svg, x, y - 12, i ? "Right divide" : "Left divide", "lbl", "middle"); });

      const dy = fy + 22;
      if (W > 18) {
        S("line", { x1: fl, y1: fy + 6, x2: fl, y2: dy + 6, class: "ln thin" }, svg);
        S("line", { x1: fr, y1: fy + 6, x2: fr, y2: dy + 6, class: "ln thin" }, svg);
        arrow(svg, 410, dy, fl + 1, dy); arrow(svg, 410, dy, fr - 1, dy);
      } else {
        arrow(svg, fl - 26, dy, fl, dy); arrow(svg, fr + 26, dy, fr, dy);
        S("line", { x1: fl, y1: fy + 4, x2: fl, y2: dy + 6, class: "ln thin" }, svg);
        S("line", { x1: fr, y1: fy + 4, x2: fr, y2: dy + 6, class: "ln thin" }, svg);
      }
      const lb = mathLabel(svg, 410, dy + 22, "V", "fw", "middle");
      lb.setAttribute("class", "math");
      const vf = (2 * W) / ((fy - LD[1]) + (fy - RD[1]));
      document.getElementById("vf-slider-v").textContent = Math.round(u * 100) + "% uplift";
      document.getElementById("vf-val").textContent = vf < 0.1 ? fmt(vf, 3) : fmt(vf);
      document.getElementById("vf-class").textContent = vf <= 0.5 ? "V-shaped · uplift wins" : vf <= 1.7 ? "Intermediate" : "U-shaped · widening wins";
      document.getElementById("vf-dims").textContent = `Floor ${Math.round(W * M)} m · relief ${Math.round((fy - LD[1]) * M)} m / ${Math.round((fy - RD[1]) * M)} m`;
    }
    slider.addEventListener("input", render);
    render();
  })();


  (function tPlate() {
    const svg = document.getElementById("t-svg");
    const tilt = document.getElementById("t-slider");
    const noise = document.getElementById("t-noise");
    const CX = 400, CY = 205, RX = 320, RY = 128;
    const PH = [1.3, 4.1, 2.2, 5.7];
    const h = (x) => RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RX) ** 2));
    const taper = (x) => Math.pow(Math.max(0, Math.sin(Math.PI * (CX + RX - x) / (2 * RX))), 0.7);
    const nz = (x) => 0.6 * Math.sin(x / 31 + PH[0]) + 0.45 * Math.sin(x / 17 + PH[1]) + 0.35 * Math.sin(x / 53 + PH[2]);
    function render() {
      const t = tilt.value / 100, n = noise.value / 100;
      clear(svg);

      txt(svg, 30, 40, "N", "lbl", "middle"); arrow(svg, 30, 78, 30, 48);
      S("line", { x1: CX + RX, y1: 40, x2: CX + RX, y2: 372, class: "ln thin dash" }, svg);
      txt(svg, CX + RX + 10, 52, "Mountain front", "lbl"); txt(svg, CX + RX + 10, 64, "runs N–S", "lbl-sub");

      S("ellipse", { cx: CX, cy: CY, rx: RX, ry: RY, class: "ln", "stroke-dasharray": "14 4 2 4" }, svg);
      S("line", { x1: CX - RX + 6, y1: CY, x2: CX + RX, y2: CY, class: "ln faint dash" }, svg);
      txt(svg, CX - RX + 14, CY + 16, "Basin midline", "lbl-sub");
      txt(svg, CX - 120, CY - RY - 10, "Drainage divide", "lbl-sub", "middle");
 
      const sy = (x) => {
        const hh = h(x), tp = taper(x);
        let v = (t * 0.72 + n * 0.9 * nz(x)) * tp;
        v = Math.max(-0.93, Math.min(0.93, v));
        return CY - v * hh;
      };
      let d = "";
      for (let x = CX - RX + 40; x <= CX + RX; x += 2) d += (d ? " L" : "M") + x + " " + sy(x).toFixed(1);
      S("path", { d, class: "ln bold" }, svg);
      txt(svg, CX + RX - 6, CY + 18, "outlet", "lbl-sub", "end");

      const xs = [160, 220, 280, 340, 400, 460, 520, 580, 640];
      const T = xs.map((x) => (CY - sy(x)) / h(x));
      xs.forEach((x, i) => {
        const hh = h(x), ys = sy(x);
        S("line", { x1: x, y1: CY - hh, x2: x, y2: CY + hh, class: "ln faint" }, svg);
        if (Math.abs(ys - CY) > 6) arrow(svg, x, CY, x, ys);
        S("circle", { cx: x, cy: ys, r: 2.4, class: "fill-ink" }, svg);
      });

      const xc = 400, yc = sy(xc), hc = h(xc), north = yc <= CY;
      const dx = xc + 16;
      const ddEnd = north ? CY - hc : CY + hc;
      S("line", { x1: dx + 12, y1: CY, x2: dx + 12, y2: ddEnd, class: "ln thin" }, svg);
      S("line", { x1: dx + 6, y1: ddEnd, x2: dx + 18, y2: ddEnd, class: "ln thin" }, svg);
      mathLabel(svg, dx + 22, (CY + ddEnd) / 2 + 4, "D", "d");
      if (Math.abs(yc - CY) > 10) {
        S("line", { x1: dx, y1: CY, x2: dx, y2: yc, class: "ln thin" }, svg);
        S("line", { x1: dx - 5, y1: yc, x2: dx + 5, y2: yc, class: "ln thin" }, svg);
        mathLabel(svg, dx - 6, (CY + yc) / 2 + 4, "D", "a", "end");
      }
      txt(svg, 160, CY + RY + 36, "Transects every 150 m · arrows = local T-vectors", "lbl-sub");

      const mean = T.reduce((a, b) => a + b, 0) / T.length;
      const meanAbs = T.reduce((a, b) => a + Math.abs(b), 0) / T.length;
      const tl = Math.abs(t) < 0.05 ? "none" : (t > 0 ? "toward north" : "toward south");
      document.getElementById("t-slider-v").textContent = tl;
      document.getElementById("t-noise-v").textContent = n < 0.25 ? "low" : n < 0.6 ? "moderate" : "high";
      document.getElementById("t-val").textContent = fmt(Math.abs(mean));
      document.getElementById("t-dir").textContent = Math.abs(mean) < 0.03 ? "Mean vector ≈ 0 · no preferred tilt" : "Mean vector points " + (mean > 0 ? "N" : "S");
      document.getElementById("t-small").textContent = `Mean |T| per transect ${fmt(meanAbs)} · 9 transects`;
    }
    tilt.addEventListener("input", render);
    noise.addEventListener("input", render);
    render();
  })();


  (function calPlate() {
    const svg = document.getElementById("cal-svg");
    const fig = document.getElementById("cal-fig");
    const tip = makeTip(fig);
    const R = D.results.smf_vs_age;
    const on = { "Puna Plateau": true, "Eastern Cordillera": true, "Pampean Ranges": true };
    const L = 64, Rr = 780, TOP = 24, BOT = 350, YMIN = 0.6, YMAX = 4.8;
    const cats = D.onsetLabels;
    const bw = (Rr - L) / cats.length;
    const yS = (v) => BOT - ((v - YMIN) / (YMAX - YMIN)) * (BOT - TOP);
    const dated = D.fronts.filter((f) => f.onset !== null && f.onset !== undefined);

    document.getElementById("cal-act").textContent = fmt(R.still_active_median_smf);
    document.getElementById("cal-actn").textContent = R.still_active_n;
    document.getElementById("cal-old").textContent = fmt(R.ended_earlier_median_smf);
    document.getElementById("cal-oldn").textContent = R.ended_earlier_n;
    document.getElementById("cal-mw").textContent = String(R.mannwhitney_one_sided_p);

    const chips = document.getElementById("cal-chips");
    PROV.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "true");
      const s = S("svg", { viewBox: "-6 -6 12 12", "aria-hidden": "true" }); marker(s, p, 0, 0, 4);
      b.appendChild(s); b.appendChild(document.createTextNode(PSHORT[p]));
      b.addEventListener("click", () => {
        const n = Object.values(on).filter(Boolean).length;
        if (on[p] && n === 1) return;
        on[p] = !on[p]; b.setAttribute("aria-pressed", String(on[p])); render();
      });
      chips.appendChild(b);
    });
    legendInto(document.getElementById("cal-legend"));

    function render() {
      clear(svg); tip.hide();
      hatchDef(svg, "hx-c2", 9, 45); hatchDef(svg, "hx-c3", 5, 45);
      S("rect", { x: L, y: yS(E2), width: Rr - L, height: yS(E1) - yS(E2), fill: "url(#hx-c2)", opacity: 0.45 }, svg);
      S("rect", { x: L, y: TOP, width: Rr - L, height: yS(E2) - TOP, fill: "url(#hx-c3)", opacity: 0.35 }, svg);
      [[1.0, "Class 1"], [2.07, "Class 2"], [3.6, "Class 3"]].forEach(([v, s]) => txt(svg, Rr - 6, yS(v), s, "lbl", "end"));
 
      S("line", { x1: L, y1: TOP, x2: L, y2: BOT, class: "axis" }, svg);
      S("line", { x1: L, y1: BOT, x2: Rr, y2: BOT, class: "axis" }, svg);
      [1, 1.4, 2, 3, 4].forEach((v) => {
        S("line", { x1: L - 5, y1: yS(v), x2: L, y2: yS(v), class: "axis" }, svg);
        txt(svg, L - 9, yS(v) + 3.5, v === 1.4 ? "1.4" : String(v), "tick", "end");
      });
      S("line", { x1: L, y1: yS(1.4), x2: Rr, y2: yS(1.4), class: "ln faint dash" }, svg);
      mathLabel(svg, 16, TOP + 10, "S", "mf");
      txt(svg, (L + Rr) / 2, BOT + 52, "Epoch in which faulting began  →  older", "lbl", "middle");
      const sel = dated.filter((f) => on[f.province]);
      cats.forEach((c, k) => {
        const cx = L + bw * (k + 0.5);
        txt(svg, cx, BOT + 18, c, "lbl", "middle");
        const grp = sel.filter((f) => f.onset === k);
        txt(svg, cx, BOT + 32, "n = " + grp.length, "lbl-sub", "middle");
        if (k) S("line", { x1: L + bw * k, y1: BOT, x2: L + bw * k, y2: BOT + 6, class: "axis" }, svg);
        if (grp.length) {
          const m = median(grp.map((f) => f.smf));
          S("line", { x1: cx - 34, y1: yS(m), x2: cx + 34, y2: yS(m), class: "ln bold" }, svg);
        }
        grp.forEach((f) => {
          const g = marker(svg, f.province, cx + hashJitter(f.segment_id) * 54, yS(f.smf), 4);
          tip.bind(g, frontTip(f));
        });
      });
    
      const keys = PROV.filter((p) => on[p]);
      let rho, label, ptxt;
      if (keys.length === 3) { rho = R.all.rho; label = "All provinces · n = " + R.all.n; ptxt = "Spearman rank correlation, p = " + R.all.p; }
      else if (keys.length === 1) { const s = R.by_province[keys[0]]; rho = s.rho; label = PSHORT[keys[0]] + " · n = " + s.n; ptxt = "Spearman rank correlation, p = " + s.p; }
      else {
        rho = spearman(sel.map((f) => f.onset), sel.map((f) => f.smf));
        label = keys.map((k) => PSHORT[k]).join(" + ") + " · n = " + sel.length;
        ptxt = "Spearman rank correlation (p not shown for custom subsets)";
      }
      document.getElementById("cal-rho").textContent = (rho < 0 ? "−" : "") + fmt(Math.abs(rho));
      document.getElementById("cal-tag").textContent = label;
      document.getElementById("cal-p").textContent = ptxt;
    }
    render();
  })();

  (function frontsPlate() {
    const svg = document.getElementById("fr-svg");
    const fig = document.getElementById("fr-fig");
    const tip = makeTip(fig);
    const L = 150, Rr = 980, XMIN = 0.6, XMAX = 4.8, BIN = 0.05, STEP = 7.2;
    const xS = (v) => L + ((v - XMIN) / (XMAX - XMIN)) * (Rr - L);
    const rowBase = { "Puna Plateau": 150, "Eastern Cordillera": 262, "Pampean Ranges": 374 };
    clear(svg);

    [[E1, "1.65"], [E2, "2.5"]].forEach(([v, s]) => { S("line", { x1: xS(v), y1: 26, x2: xS(v), y2: 386, class: "ln thin dash" }, svg); txt(svg, xS(v), 400, s, "tick", "middle"); });
    txt(svg, (xS(XMIN) + xS(E1)) / 2, 18, "Class 1 · Holocene", "lbl", "middle");
    txt(svg, (xS(E1) + xS(E2)) / 2, 18, "Class 2", "lbl", "middle");
    txt(svg, (xS(E2) + xS(XMAX)) / 2, 18, "Class 3 · Neogene and older", "lbl", "middle");
    [1, 2, 3, 4].forEach((v) => txt(svg, xS(v), 400, String(v), "tick", "middle"));
    mathLabel(svg, Rr, 416, "S", "mf", "end");
    PROV.forEach((p) => {
      const base = rowBase[p];
      S("line", { x1: L, y1: base + 6, x2: Rr, y2: base + 6, class: "axis" }, svg);
      txt(svg, 0, base - 4, PSHORT[p], "lbl");
      const fr = D.fronts.filter((f) => f.province === p);
      txt(svg, 0, base + 8, fr.length + " fronts", "lbl-sub");
      const sm = marker(svg, p, 6, base - 22, 4); sm.classList.remove("mk");
      const stacks = {};
      fr.slice().sort((a, b) => a.smf - b.smf).forEach((f) => {
        const b = Math.floor((f.smf - XMIN) / BIN);
        const k = (stacks[b] = (stacks[b] || 0) + 1) - 1;
        const x = xS(XMIN + (b + 0.5) * BIN), y = base - k * STEP;
        let g;
        if (f.smf < 1) {
          g = S("g", { class: "mk", transform: `translate(${x},${y})` }, svg);
          S("rect", { x: -4, y: -4, width: 8, height: 8, class: "m-ec" }, g);
          S("line", { x1: x, y1: y + 5, x2: x + 18, y2: y + 20, class: "ln thin" }, svg);
          txt(svg, x + 21, y + 24, "segment 196 · Smf 0.73 < 1", "lbl-sub");
        } else g = marker(svg, p, x, y, 3.2);
        tip.bind(g, frontTip(f));
      });
    });
    legendInto(document.getElementById("fr-legend"));

    const tb = document.querySelector("#class-table tbody");
    const t41 = D.results.class_counts_table41, t42 = D.results.class_counts_table42_reported;
    PROV.forEach((p) => {
      const tr = document.createElement("tr");
      const c = (k) => {
        const a = t41[p][k] || 0, b = t42[p][k];
        return a === b ? String(a) : `<span class="flag">${a}</span> <span style="color:var(--ink-2)">(Table 4.2: ${b})</span>`;
      };
      tr.innerHTML = `<td>${p}</td><td class="num">${c("1")}</td><td class="num">${c("2")}</td><td class="num">${c("3")}</td><td class="num">${fmt(D.results.smf_by_province[p].median)}</td>`;
      tb.appendChild(tr);
    });
  })();


  (function vsPlate() {
    const svg = document.getElementById("vs-svg");
    const fig = document.getElementById("vs-fig");
    const tip = makeTip(fig);
    const R = D.results.vf_vs_smf;
    const L = 64, Rr = 780, TOP = 20, BOT = 380, XMIN = 0.6, XMAX = 4.8, YMIN = Math.log10(0.25), YMAX = Math.log10(80);
    const xS = (v) => L + ((v - XMIN) / (XMAX - XMIN)) * (Rr - L);
    const yS = (v) => BOT - ((Math.log10(v) - YMIN) / (YMAX - YMIN)) * (BOT - TOP);
    document.getElementById("vs-rho").textContent = "−" + fmt(Math.abs(R.all.rho));
    document.getElementById("vs-p").textContent = (R.all.p < 0.001 ? "p < 0.001" : "p = " + R.all.p) + " · Class 1–3 median Vf: " + R.vf_median_by_class["1"] + " / " + R.vf_median_by_class["2"] + " / " + R.vf_median_by_class["3"];
    document.getElementById("vs-c1").textContent = fmt(R.vf_median_by_class["1"]);
    document.getElementById("vs-c3").textContent = fmt(R.vf_median_by_class["3"]);
    clear(svg);
    S("line", { x1: L, y1: TOP, x2: L, y2: BOT, class: "axis" }, svg);
    S("line", { x1: L, y1: BOT, x2: Rr, y2: BOT, class: "axis" }, svg);
    [0.3, 0.5, 1, 1.7, 3, 10, 30].forEach((v) => {
      S("line", { x1: L - 5, y1: yS(v), x2: L, y2: yS(v), class: "axis" }, svg);
      txt(svg, L - 9, yS(v) + 3.5, String(v), "tick", "end");
    });
    [[0.5, "V-shaped below"], [1.7, "U-shaped above"]].forEach(([v, s]) => {
      S("line", { x1: L, y1: yS(v), x2: Rr, y2: yS(v), class: "ln faint dash" }, svg);
      txt(svg, Rr - 4, yS(v) - 5, s, "lbl-sub", "end");
    });
    [1, 2, 3, 4].forEach((v) => { S("line", { x1: xS(v), y1: BOT, x2: xS(v), y2: BOT + 5, class: "axis" }, svg); txt(svg, xS(v), BOT + 18, String(v), "tick", "middle"); });
    [E1, E2].forEach((v) => S("line", { x1: xS(v), y1: TOP, x2: xS(v), y2: BOT, class: "grid" }, svg));
    mathLabel(svg, Rr, BOT + 40, "S", "mf", "end");
    mathLabel(svg, 14, TOP + 8, "V", "f");
    txt(svg, 14, TOP + 22, "median", "lbl-sub");

    S("line", { x1: xS(1.15), y1: yS(0.4), x2: xS(2.6), y2: yS(4.5), class: "ln thin dash" }, svg);
    arrowHead(svg, xS(2.6), yS(4.5), Math.atan2(yS(4.5) - yS(0.4), xS(2.6) - xS(1.15)));
    txt(svg, xS(2.64), yS(4.5) - 6, "expected", "lbl");

    D.fronts.forEach((f) => {
      const g = marker(svg, f.province, xS(f.smf), yS(Math.max(0.26, f.vf_median)), 3.6);
      tip.bind(g, frontTip(f));
    });

    const xs = D.fronts.map((f) => f.smf), ys = D.fronts.map((f) => Math.log10(f.vf_median));
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const b = sxy / sxx, a = my - b * mx;
    const f = (x) => Math.pow(10, a + b * x);
    S("line", { x1: xS(0.9), y1: yS(f(0.9)), x2: xS(4.7), y2: yS(f(4.7)), class: "ln bold" }, svg);
    txt(svg, xS(4.7), yS(f(4.7)) - 18, "observed fit", "lbl", "end");
    legendInto(document.getElementById("vs-legend"));
  })();


  (function rosePlate() {
    const box = document.getElementById("roses");
    const T = D.tfactor, Rt = D.results.t_factor;
    const maxC = Math.max(...PROV.map((p) => Math.max(...T[p].azimuth_bins_10deg)));
    const C = 130, RM = 100;
    const pt = (deg, r) => { const a = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
    PROV.forEach((p) => {
      const fig = document.createElement("figure"); fig.className = "rose";
      const svg = S("svg", { viewBox: "0 0 260 260", role: "img", "aria-label": `Rose diagram of T-factor directions, ${p}` });
      [0.25, 0.5, 1].forEach((q) => S("circle", { cx: C, cy: C, r: RM * Math.sqrt(q), class: "grid" }, svg));
      S("line", { x1: C, y1: C - RM - 6, x2: C, y2: C + RM + 6, class: "grid" }, svg);
      S("line", { x1: C - RM - 6, y1: C, x2: C + RM + 6, y2: C, class: "grid" }, svg);
      T[p].azimuth_bins_10deg.forEach((cnt, i) => {
        if (!cnt) return;
        const r = RM * Math.sqrt(cnt / maxC);
        const a = pt(i * 10, r), b = pt(i * 10 + 10, r);
        S("path", { d: `M${C} ${C} L${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)} Z`, style: "fill:var(--ink);stroke:var(--paper)", "stroke-width": 0.8, opacity: 0.88 }, svg);
      });
      const mv = T[p].mean_vector_T, az = T[p].mean_vector_azimuth;
      const e = pt(az, Math.max(mv * 20 * RM, 6));
      S("line", { x1: C, y1: C, x2: e[0], y2: e[1], style: "stroke:var(--ink)", "stroke-width": 7, "stroke-linecap": "round" }, svg);
      S("line", { x1: C, y1: C, x2: e[0], y2: e[1], style: "stroke:var(--paper)", "stroke-width": 2.6, "stroke-linecap": "round" }, svg);
      S("circle", { cx: C, cy: C, r: 3.2, style: "fill:var(--paper);stroke:var(--ink)", "stroke-width": 1.4 }, svg);
      S("circle", { cx: e[0], cy: e[1], r: 3.4, style: "fill:var(--paper);stroke:var(--ink)", "stroke-width": 1.4 }, svg);
      txt(svg, C, 12, "N", "lbl", "middle"); txt(svg, C, 258, "S", "lbl", "middle");
      txt(svg, 252, C + 4, "E", "lbl", "middle"); txt(svg, 8, C + 4, "W", "lbl", "middle");
      fig.appendChild(svg);
      const cap = document.createElement("figcaption");
      const r = Rt[p];
      cap.innerHTML = `<b>${p}</b><span>${r.n.toLocaleString()} basins · north ${Math.round(r.north_share * 100)}% / south ${100 - Math.round(r.north_share * 100)}% (binomial p = ${r.binomial_p})</span><span>Mean |T| per basin ${fmt(r.mean_R)} · mean vector ${fmt(r.mean_vector_T, 3)}</span>`;
      fig.appendChild(cap);
      box.appendChild(fig);
    });
    document.getElementById("tilt-mv").textContent = PROV.map((p) => fmt(T[p].mean_vector_T, 3)).join(", ").replace(/, ([^,]*)$/, " and $1");
  })();

  (function fanPlate() {
    const box = document.getElementById("fans");
    const BASE = 170;
    const RANGE = "M20 170 L20 64 L54 42 L86 58 L104 84 L120 100";
    const types = [
      { name: "Long, upward-concave fan", n: "20 basins", text: "Fan builds far into the basin; the head steepens and trenches at the front. River pushed to the far side. Long-lived reverse faulting.",
        fan: "M120 100 Q 170 152, 380 162", river: 400, arrow: [330, 400], fault: "rev" },
      { name: "Step-like fan", n: "10 basins", text: "A second scarp cuts the fan basinward. Faulting has stepped out from the range front into the basin.",
        fan: "M120 100 Q 160 128, 214 132 L 226 146 Q 290 160, 380 163", river: 400, arrow: [330, 400], fault: "rev", fault2: "M222 140 L 196 170" },
      { name: "Short, straight fan", n: "11 basins", text: "Small, steep and straight, close to the front, with fan-head trenching. Recent onset of uplift.",
        fan: "M120 100 L 190 160", river: 214, arrow: [196, 236], fault: "rev" },
      { name: "Short, upward-concave fan", n: "2 basins", text: "Small fan beside a Class 1 front, but the river migrates toward it. The hanging wall tilts toward a normal fault.",
        fan: "M120 100 Q 138 150, 186 160", river: 160, arrow: [230, 166], fault: "norm" },
    ];
    types.forEach((t) => {
      const fig = document.createElement("figure"); fig.className = "fan";
      const svg = S("svg", { viewBox: "0 0 460 200", role: "img", "aria-label": t.name });
      const id = "hx-fan-" + Math.random().toString(36).slice(2, 7);
      hatchDef(svg, id, 6, 45);
      S("path", { d: RANGE + ` L120 ${BASE} Z`, fill: `url(#${id})`, stroke: "none" }, svg);
      S("path", { "data-draw": "", d: RANGE, class: "ln" }, svg);
      S("path", { d: "M430 165 L444 118 L460 110 L460 170 Z", fill: `url(#${id})`, stroke: "none" }, svg);
      S("path", { "data-draw": "", d: "M420 165 L430 165 L444 118 L460 110", class: "ln" }, svg);
      S("path", { "data-draw": "", d: t.fan, class: "ln bold" }, svg);
      const end = t.fan.match(/([\d.]+)\s+([\d.]+)\s*$/);
      S("path", { "data-draw": "", d: `M${end[1]} ${end[2]} L420 165`, class: "ln" }, svg);
      S("line", { x1: 10, y1: BASE + 6, x2: 450, y2: BASE + 6, class: "ln faint" }, svg);
      if (t.fault === "rev") {
        S("path", { "data-draw": "", d: "M122 104 L84 176", class: "ln thin dash" }, svg);
        arrow(svg, 100, 150, 108, 134);
      } else {
        S("path", { "data-draw": "", d: "M118 98 L150 176", class: "ln thin dash" }, svg);
        arrow(svg, 146, 150, 140, 166);
      }
      if (t.fault2) { S("path", { "data-draw": "", d: t.fault2, class: "ln thin dash" }, svg); }
      const rx = t.river, ry = t.fault === "norm" ? 158 : (rx > 300 ? 163 : 161);
      S("path", { d: `M${rx - 6} ${ry - 14} l12 0 l-6 9 z`, class: "ln thin" }, svg);
      arrow(svg, t.arrow[0], ry - 34, t.arrow[1], ry - 34);
      txt(svg, (t.arrow[0] + t.arrow[1]) / 2, ry - 42, "river migrates", "lbl-sub", "middle");
      txt(svg, 20, 194, t.fault === "rev" ? "reverse fault" : "normal fault", "lbl-sub");
      txt(svg, 440, 194, t.n, "lbl", "end");
      fig.appendChild(svg);
      const cap = document.createElement("figcaption");
      cap.innerHTML = `<b>${t.name}</b>${t.text}`;
      fig.appendChild(cap);
      box.appendChild(fig);
    });
  })();


  (function notes() {
    const ul = document.getElementById("flags");
    D.results.questions_for_author.forEach((q) => {
      const li = document.createElement("li");
      const qp = document.createElement("span"); qp.textContent = q.question; li.appendChild(qp);
      const ap = document.createElement("span"); ap.className = "answer";
      ap.textContent = q.answer ? "Answer: " + q.answer : "Answer: to be added after speaking with Professor Daxberger.";
      if (!q.answer) ap.classList.add("pending");
      li.appendChild(ap); ul.appendChild(li);
    });
  })();

  if (document.visibilityState === "visible") drawOn(document.getElementById("xsec"));
})();
