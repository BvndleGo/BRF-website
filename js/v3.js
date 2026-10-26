(() => {
  const cfg = window.BRF;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // Figma export: Figma's capture tool opens the page with #figmacapture=…; in that case every section is shown
  // in its finished state (reveals in, charts full, zones laid out), since the capture is a single snapshot
  const CAPTURE = /figmacapture/.test(location.hash);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* theme: dark by default; the sun/moon button switches to light and the choice is remembered */
  const themeBtn = $("#themeToggle"), metaTheme = document.querySelector('meta[name="theme-color"]');
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    if (metaTheme) metaTheme.content = t === "light" ? "#ffffff" : "#111111";
    if (themeBtn) { themeBtn.setAttribute("aria-label", t === "light" ? "Switch to dark mode" : "Switch to light mode"); themeBtn.setAttribute("aria-pressed", t === "light"); }
  };
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next); try { localStorage.setItem("brf-theme-v2", next); } catch (e) {}   // v2: earlier saved choices are ignored, so everyone starts in dark
  });

  /* config + links */
  $$("[data-brf]").forEach((el) => { if (cfg[el.dataset.brf]) el.textContent = cfg[el.dataset.brf]; });
  $$("[data-tix]").forEach((a) => (a.href = cfg.tixUrl));
  $$("[data-partner]").forEach((a) => (a.href = cfg.partnerUrl));
  $$("[data-gallery]").forEach((a) => (a.href = cfg.galleryUrl));

  /* countdown */
  const clock = $("#clock"), start = new Date(cfg.eventStart).getTime(), pad = (n) => String(n).padStart(2, "0");
  const tick = () => { const d = Math.max(0, start - Date.now()); clock.textContent = d ? `${Math.floor(d / 864e5)}d ${pad(Math.floor((d % 864e5) / 36e5))}h ${pad(Math.floor((d % 36e5) / 6e4))}m ${pad(Math.floor((d % 6e4) / 1e3))}s` : "WE'RE LIVE"; };
  tick(); setInterval(tick, 1000);

  /* ===== 1. Hero: a globe of 2025 photos on black. On load the photos fly in from all over the screen and
     assemble into a slowly spinning sphere (drag to spin, the cursor tilts it, tap a photo to open it).
     Scrolling through the pinned hero swells the globe toward you until the photos stream past the camera,
     and "Be the moment." unveils behind them. Plays on every load. ===== */
  const hero = $("#hero"), cv = $("#burstCv"), bx = cv.getContext("2d"), copy = $("#burstCopy"), zoom = $("#burstZoom");
  // photos: 420px on desktop (tiles grow large as you scroll in), a lighter 240px set on phones
  const B_PHONE = innerWidth < 760, B_SRC = [...Array(80).keys()].map((i) => `assets/img/burst/${B_PHONE ? "sm/" : ""}b${String(i + 1).padStart(3, "0")}.jpg?v=2`);
  const ZSETS = ["funtime", "games", "missions", "music", "redemption", "stage"];
  const B_FULL = (i) => (i < 32 ? `assets/img/concert/c${String(i + 1).padStart(2, "0")}.jpg` : `assets/img/zones/${ZSETS[Math.floor((i - 32) / 8)]}-${((i - 32) % 8) + 1}.jpg`);
  const bImgs = B_SRC.map((src) => { const im = new Image(); im.src = src; return im; });
  // sprites: every photo baked once per tile shape (landscape .75 / portrait 1.2) with rounded corners and the white
  // keyline, so a frame is just ~160 plain drawImage calls (no per-frame clip or stroke)
  const bSprites = new Map();
  function sprite(i, ar) {
    const key = i + "|" + ar; if (bSprites.has(key)) return bSprites.get(key);
    const im = bImgs[i]; if (!(im.complete && im.naturalWidth)) return null;
    const W = B_PHONE ? 240 : 400, H = Math.round(W * ar), c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const r = W / 20, lw = W / 60;
    g.beginPath(); g.roundRect(lw / 2, lw / 2, W - lw, H - lw, r); g.save(); g.clip();
    const iar = im.naturalWidth / im.naturalHeight, tr = W / H;
    const sw = iar > tr ? im.naturalHeight * tr : im.naturalWidth, sh = iar > tr ? im.naturalHeight : im.naturalWidth / tr;
    g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H); g.restore();
    g.lineWidth = lw; g.strokeStyle = "#F3F0EB"; g.stroke();
    bSprites.set(key, c); return c;
  }
  let bSmooth = 0, bW = 0, bH = 0, bDpr = 1, R0 = 200, tiles = [], heroOn = true, bStart = performance.now(), bDrag = null, bMoved = 0;
  // rot eases toward tgt every frame, so a drag follows the hand smoothly; vel carries the throw after release
  const rot = { y: 0, x: -0.22 }, tgt = { y: 0, x: -0.22 }, vel = { y: 0, x: 0 }, bp = { x: -9999, y: -9999 };
  const bLat = $("#bLat"), bLon = $("#bLon"), clampX = (v) => Math.max(-1.3, Math.min(1.3, v));
  const rr = (a, b) => a + Math.random() * (b - a);
  function bLayout() {
    bDpr = Math.min(2, devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(); bW = r.width; bH = r.height;
    cv.width = bW * bDpr; cv.height = bH * bDpr; bx.setTransform(bDpr, 0, 0, bDpr, 0, 0);
    const narrow = bW < 760, N = narrow ? 90 : 160;
    R0 = Math.min(bW, bH) * (narrow ? 0.42 : 0.36);
    if (tiles.length !== N) {
      const GA = Math.PI * (3 - Math.sqrt(5));
      tiles = [...Array(N).keys()].map((i) => {
        const y = 1 - (2 * (i + 0.5)) / N, rad = Math.sqrt(1 - y * y), th = i * GA;   // evenly spread over the sphere
        const ux = Math.cos(th) * rad, uz = Math.sin(th) * rad, hl = Math.hypot(ux, uz) || 1, e = [uz / hl, -ux / hl];
        const n = [-y * ux / hl, hl, -y * uz / hl];                     // perpendicular to e on the surface, pointing toward +y (screen down)
        return { img: (i * 7) % 80, ux, uy: y, uz, e, n, k: 1, ar: Math.random() < 0.5 ? 0.75 : 1.2, at: rr(0, 1300), fx: 0, fy: 0, s: 1, hs: 1 };
      });
    }
    tiles.forEach((t) => { t.fx = rr(-0.1, 1.1) * bW; t.fy = rr(-0.1, 1.1) * bH; });
  }
  bLayout(); addEventListener("resize", bLayout);
  if (reduce) bStart -= 5000;
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  new IntersectionObserver(([e]) => (heroOn = e.isIntersecting)).observe(hero);
  const hit = (x, y) => { for (let i = bDrawn.length - 1; i >= 0; i--) { const t = bDrawn[i]; if (t.front && Math.abs(x - t.sx) < t.w / 2 && Math.abs(y - t.sy) < t.h / 2) return t; } return null; };
  let bDrawn = [];
  cv.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect(); bp.x = e.clientX - r.left; bp.y = e.clientY - r.top;
    if (bDrag) {                                                        // grab and turn the globe in any direction
      const dx = e.clientX - bDrag.x, dy = e.clientY - bDrag.y; bDrag.x = e.clientX; bDrag.y = e.clientY; bMoved += Math.abs(dx) + Math.abs(dy);
      const k = 3.4 / Math.max(bW, 700), vy = dx * k, vx = bDrag.touch ? 0 : -dy * k;   // touch keeps vertical swipes for scrolling
      tgt.y += vy; tgt.x = clampX(tgt.x + vx);
      vel.y = vel.y * 0.5 + vy * 0.5; vel.x = vel.x * 0.5 + vx * 0.5; bDrag.t = performance.now();
    }
    cv.style.cursor = bDrag ? "grabbing" : hit(bp.x, bp.y) ? "pointer" : "grab";
  });
  cv.addEventListener("pointerleave", () => { bp.x = bp.y = -9999; });
  cv.addEventListener("pointerdown", (e) => { if (e.button) return; bDrag = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType === "touch" }; bMoved = 0; vel.x = vel.y = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointercancel", () => (bDrag = null));
  addEventListener("pointerup", () => {
    if (!bDrag) return;
    if (performance.now() - bDrag.t > 90) vel.x = vel.y = 0;            // held still before letting go: no throw
    bDrag = null;
    if (bMoved > 6) return;
    const t = hit(bp.x, bp.y); if (!t) return;
    $("img", zoom).src = B_FULL(t.img); zoom.hidden = false; requestAnimationFrame(() => zoom.classList.add("is-open"));
  });
  zoom.addEventListener("click", () => { zoom.classList.remove("is-open"); setTimeout(() => (zoom.hidden = true), 300); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !zoom.hidden) zoom.click(); });
  function stackStep() {
    if (!heroOn || !bW) return;
    const t = (performance.now() - bStart) / 1000;
    const hr = hero.getBoundingClientRect(), span = Math.max(1, hero.offsetHeight - innerHeight);
    const pRaw = Math.min(1, Math.max(0, -hr.top / span));
    bSmooth = reduce ? pRaw : bSmooth + (pRaw - bSmooth) * 0.085;      // the dive glides after the scroll instead of jumping with it
    const p = bSmooth;
    // the headline unveils between 15% and 55% of the scroll; the globe swells from the start
    const unveil = ease((p - 0.12) / 0.4);
    copy.style.setProperty("--unveil", unveil.toFixed(3));
    copy.classList.toggle("is-live", unveil > 0.6);
    hero.classList.toggle("is-scrolled", p > 0.02);
    hero.classList.toggle("is-unveiled", unveil > 0.92);               // the frame comes back around the revealed headline
    if (!bDrag) {                                                       // momentum after a throw, then a slow idle turn
      tgt.y += vel.y + (reduce ? 0 : 0.0011); tgt.x = clampX(tgt.x + vel.x);
      vel.y *= 0.95; vel.x *= 0.95;
      if (Math.abs(vel.x) < 0.0005) tgt.x += (-0.22 - tgt.x) * 0.008;   // drift back to a slight top-down view
    }
    rot.y += (tgt.y - rot.y) * 0.16; rot.x += (tgt.x - rot.x) * 0.16;
    // edge readouts (as in the reference): where the globe faces, starting from Lagos
    if (bLat) {
      const lat = Math.max(-90, Math.min(90, 6.5244 + (rot.x + 0.22) * 57.3)), lon = (((3.3792 - rot.y * 57.3) % 360) + 540) % 360 - 180;
      bLat.textContent = `${lat >= 0 ? "N" : "S"} ${Math.abs(lat).toFixed(2)}\u00b0`; bLon.textContent = `${lon >= 0 ? "E" : "W"} ${Math.abs(lon).toFixed(2)}\u00b0`;
    }
    const R = R0 * (1 + Math.pow(p, 1.8) * 3.2), D = R0 * 3.2, cx = bW / 2, cy = bH / 2;
    const cY = Math.cos(rot.y), sY = Math.sin(rot.y), cX = Math.cos(rot.x), sX = Math.sin(rot.x);
    const base = R0 * (bW < 760 ? 0.26 : 0.205) * (1 + p * 2.4), list = [];
    for (const tl of tiles) {
      // rotate the unit position, then project with a simple pinhole camera at distance D
      const x1 = tl.ux * cY + tl.uz * sY, z1 = -tl.ux * sY + tl.uz * cY;
      const y1 = tl.uy * cX - z1 * sX, z2 = tl.uy * sX + z1 * cX;
      const zR = z2 * R * tl.k, depth = D - zR;
      if (depth < D * 0.12) continue;                                  // already flown past the camera
      const sc = D / depth, gx = cx + x1 * R * tl.k * sc, gy = cy + y1 * R * tl.k * sc;
      const land = ease((t * 1000 - tl.at) / 1700);                    // assemble from a random spot on load
      const sx = tl.fx + (gx - tl.fx) * land, sy = tl.fy + (gy - tl.fy) * land;
      const w = base * sc * (0.55 + 0.45 * land), h = w * tl.ar;
      const front = z2 > 0;
      // the card lies flat on the sphere: project its across and down edges, so cards near the rim foreshorten
      const hw = base / (2 * R * tl.k), hh = hw * tl.ar, RS = R * tl.k;
      const proj = (vx, vy, vz) => {
        const a1 = vx * cY + vz * sY, c1 = -vx * sY + vz * cY, b1 = vy * cX - c1 * sX, d1 = vy * sX + c1 * cX, s2 = D / Math.max(D * 0.1, D - d1 * RS);
        return [cx + a1 * RS * s2, cy + b1 * RS * s2];
      };
      const [ex, ez] = tl.e, [nx, ny, nz] = tl.n;
      const pA = proj(tl.ux + ex * hw, tl.uy, tl.uz + ez * hw), pB = proj(tl.ux - ex * hw, tl.uy, tl.uz - ez * hw);
      const pC = proj(tl.ux + nx * hh, tl.uy + ny * hh, tl.uz + nz * hh), pD = proj(tl.ux - nx * hh, tl.uy - ny * hh, tl.uz - nz * hh);
      let ux = [pA[0] - pB[0], pA[1] - pB[1]], vv = [pC[0] - pD[0], pC[1] - pD[1]];
      if (ux[0] * vv[1] - ux[1] * vv[0] < 0) ux = [-ux[0], -ux[1]];    // never show a photo mirrored, even from inside
      const fl = 0.55 + 0.45 * land;                                    // flat while flying in, settling onto the sphere as it lands
      const U = [w * (1 - land) + ux[0] * land * fl, ux[1] * land * fl], V = [vv[0] * land * fl, h * (1 - land) + vv[1] * land * fl];
      let a = (front ? 1 : 0.22 + 0.25 * (z2 + 1) + p * 0.6) * Math.min(1, land * 1.5);
      a *= sc > 2 ? Math.max(0, 1 - (sc - 2) / 1.6) : 1;              // fade as they rush past, before they swamp the headline
      // keep a calm patch behind the headline once it unveils
      if (unveil > 0 && Math.abs(sx - cx) < bW * 0.4 && Math.abs(sy - cy) < bH * 0.2) a *= 1 - unveil * 0.85;
      list.push({ t: tl, img: tl.img, sx, sy, w: Math.hypot(U[0], U[1]), h: Math.hypot(V[0], V[1]), U, V, z: z2, a, front });
    }
    list.sort((m, n) => m.z - n.z);
    // hover: the front photo under the cursor grows a little
    let hot = null;
    for (let i = list.length - 1; i >= 0; i--) { const m = list[i]; if (m.front && Math.abs(bp.x - m.sx) < m.w / 2 && Math.abs(bp.y - m.sy) < m.h / 2) { hot = m; break; } }
    bx.clearRect(0, 0, bW, bH);
    for (const m of list) {
      m.t.hs += ((m === hot ? 1.35 : 1) - m.t.hs) * 0.12;                // eased hover growth
      const hs = m.t.hs, w = m.w * hs;
      if (m.a <= 0.01 || w < 2) continue;
      bx.globalAlpha = m.a;
      const sp = sprite(m.img, m.t.ar), U = [m.U[0] * hs, m.U[1] * hs], V = [m.V[0] * hs, m.V[1] * hs];
      // unit square -> the card's projected parallelogram, centred on the tile
      bx.setTransform(bDpr * U[0], bDpr * U[1], bDpr * V[0], bDpr * V[1], bDpr * (m.sx - (U[0] + V[0]) / 2), bDpr * (m.sy - (U[1] + V[1]) / 2));
      if (sp) bx.drawImage(sp, 0, 0, 1, 1);
      else { bx.fillStyle = "#222"; bx.fillRect(0, 0, 1, 1); }
    }
    bx.setTransform(bDpr, 0, 0, bDpr, 0, 0);
    bx.globalAlpha = 1;
    bDrawn = list.map((m) => ({ ...m, w: m.w * m.t.hs, h: m.h * m.t.hs }));
  }

  /* hero navigation frame: four thin sides with corner brackets. Wherever a label (readouts, north, hint) crosses a
     side, the line stops short of it and picks up again after, so nothing is drawn through the text. */
  const hud = $("#burstHud");
  if (hud) {
    const hudLabels = [$(".burst__north"), $("#bLat"), $("#bLon"), $(".burst__hint")].filter(Boolean);
    const cut = (from, to, holes) => { const out = []; let a = from; holes.sort((p, q) => p[0] - q[0]).forEach(([s, e]) => { if (e <= a || s >= to) return; if (s > a) out.push([a, s]); a = Math.max(a, e); }); if (a < to) out.push([a, to]); return out; };
    const pin = hud.parentElement, navEl = $(".nav"), north = $(".burst__north"), hintEl = $(".burst__hint"), coords = [$("#bLat"), $("#bLon")];
    function drawHud() {
      // fit the frame to what is actually visible: below the nav (and the countdown bar before it scrolls away), above the
      // bottom of the screen; the north marker, hint and readouts follow its edges
      const pr = pin.getBoundingClientRect(); if (pr.bottom < 0 || pr.top > innerHeight) return;
      const gap = parseFloat(getComputedStyle(hud).left) || 24, nb = Math.max(0, navEl.getBoundingClientRect().bottom);   // top and bottom space = side space (SVG has no offsetLeft)
      const visTop = Math.max(pr.top, nb, 0), visBot = Math.min(pr.bottom, innerHeight);
      const top = visTop - pr.top + gap, hh = Math.max(120, visBot - visTop - 2 * gap);
      hud.style.top = `${top}px`; hud.style.height = `${hh}px`;
      north.style.top = `${top}px`; hintEl.style.bottom = `${pr.height - top - hh}px`;
      coords.forEach((el) => el && (el.style.top = `${top + hh / 2}px`));
      const r = hud.getBoundingClientRect(), W = r.width, H = r.height; if (!W || !H) return;
      const PAD = 10, C = 10;                                            // gap around each label; corner bracket length
      const scrolled = hero.classList.contains("is-scrolled");          // once scrolling, the hint is gone: close its gap
      const boxes = hudLabels.filter((el) => getComputedStyle(el).display !== "none" && !(scrolled && el === hintEl)).map((el) => { const b = el.getBoundingClientRect(); return { x1: b.left - r.left - PAD, x2: b.right - r.left + PAD, y1: b.top - r.top - PAD, y2: b.bottom - r.top + PAD }; });
      const holesH = (y) => boxes.filter((b) => b.y1 <= y && b.y2 >= y).map((b) => [b.x1, b.x2]);
      const holesV = (x) => boxes.filter((b) => b.x1 <= x && b.x2 >= x).map((b) => [b.y1, b.y2]);
      const t = 0.75, R = W - 0.75, B = H - 0.75; let d = "";          // line and brackets share the same outer edge
      cut(C, W - C, holesH(t)).forEach(([a, b]) => (d += `M${a} ${t}H${b}`));
      cut(C, W - C, holesH(B)).forEach(([a, b]) => (d += `M${a} ${B}H${b}`));
      cut(C, H - C, holesV(t)).forEach(([a, b]) => (d += `M${t} ${a}V${b}`));
      cut(C, H - C, holesV(R)).forEach(([a, b]) => (d += `M${R} ${a}V${b}`));
      $(".hud__line", hud).setAttribute("d", d);
      const k = 1.5;
      $(".hud__corner", hud).setAttribute("d", `M${k} ${C}V${k}H${C}M${W - C} ${k}H${W - k}V${C}M${W - k} ${H - C}V${H - k}H${W - C}M${C} ${H - k}H${k}V${H - C}`);
    }
    let hudQ = 0; const hudSoon = () => { cancelAnimationFrame(hudQ); hudQ = requestAnimationFrame(drawHud); };
    addEventListener("resize", hudSoon); addEventListener("scroll", () => { if (scrollY < innerHeight * 1.6) hudSoon(); }, { passive: true });
    document.fonts.ready.then(drawHud); drawHud();
    setInterval(() => { if (heroOn) drawHud(); }, 700);              // the readouts change width as the globe turns
  }

  /* ===== 2. Partners: mono logo wall ===== */
  const LOGOS = ["mtn", "uba", "konga", "vfd", "ngx", "purple", "heirs-tech", "HIG", "afripay", "firststone", "cellar", "atiat", "v-logo", "yard", "abbey", "cscs", "flex", "medplus", "chudeandego", "pwc", "tc", "nairametrics", "zikoko"];
  const NAMES = { mtn: "MTN", uba: "UBA", konga: "Konga", vfd: "VFD Group", ngx: "NGX", purple: "Purple", "heirs-tech": "Heirs Technologies", HIG: "Heirs Insurance Group", afripay: "AfriPay", firststone: "FirstStone", cellar: "Cellar Central", atiat: "Atiat", "v-logo": "V", yard: "The Yard", abbey: "Abbey", cscs: "CSCS", flex: "Flex", medplus: "MedPlus", chudeandego: "Chude and Ego", pwc: "PwC", tc: "TechCabal", nairametrics: "Nairametrics", zikoko: "Zikoko" };
  // two slides: sponsors, then partners (media and knowledge brands). Story-style bars mark the slide: the active bar
  // fills, then the wall slides on; hover pauses it, clicking a bar or swiping changes slide.
  const PARTNER_LOGOS = ["pwc", "tc", "nairametrics", "zikoko"];
  const tile = (l) => `<li><img src="assets/logos/${l}.svg" alt="${NAMES[l]}"></li>`;   // eager: lazy images don't load inside a moved track
  const more = `<li class="logowall__more"><a href="#brands">Your brand here</a></li>`;
  $("#logoWall").innerHTML = LOGOS.filter((l) => !PARTNER_LOGOS.includes(l)).map(tile).join("") + more;
  $("#logoWallP").innerHTML = PARTNER_LOGOS.map(tile).join("") + more;
  const ltabs = $$(".ltab"), lslides = [$("#logoWall"), $("#logoWallP")], ltrack = $(".lslides__track"), lview = $(".lslides__view");
  let lcur = 0;
  function showSlide(i) {
    lcur = i;
    ltrack.style.transform = `translateX(${-i * 100}%)`;
    lview.style.height = `${lslides[i].offsetHeight}px`;              // the view takes the height of the slide on show
    lslides.forEach((sl, k) => { sl.setAttribute("aria-hidden", k !== i); sl.inert = k !== i; });
    ltabs.forEach((t, k) => { t.classList.remove("is-on"); t.classList.toggle("is-done", k < i); t.setAttribute("aria-current", k === i); });
    void ltabs[i].offsetWidth; ltabs[i].classList.add("is-on");          // restart the fill
  }
  ltabs.forEach((t, i) => {
    t.addEventListener("click", () => showSlide(i));
    t.querySelector(".ltab__bar i").addEventListener("animationend", () => showSlide((i + 1) % lslides.length));
  });
  let lsx = null;
  lview.addEventListener("pointerdown", (e) => (lsx = e.clientX));
  lview.addEventListener("pointerup", (e) => { if (lsx === null) return; const dx = e.clientX - lsx; lsx = null; if (Math.abs(dx) > 50) showSlide(Math.max(0, Math.min(lslides.length - 1, lcur + (dx < 0 ? 1 : -1)))); });
  addEventListener("resize", () => (lview.style.height = `${lslides[lcur].offsetHeight}px`));
  const lsec = $(".partners");
  lsec.addEventListener("pointerenter", () => lsec.classList.add("is-paused"));
  lsec.addEventListener("pointerleave", () => lsec.classList.remove("is-paused"));
  showSlide(0);

  /* ===== 4. Last December: split the sentence into words; as the section scrolls through the middle of the screen,
     words light up in reading order (numbers and photos light with their neighbours). ===== */
  const story = $("#storyText");
  let storyStep = () => {};
  if (story) {
    const parts = [];
    [...story.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => { if (!t) return; if (/^\s+$/.test(t)) frag.appendChild(document.createTextNode(t)); else { const w = document.createElement("span"); w.className = "sword"; w.textContent = t; frag.appendChild(w); parts.push(w); } });
        story.replaceChild(frag, n);
      } else { n.classList.add("sword"); parts.push(n); }
    });
    let lit = -1;
    storyStep = () => {
      if (reduce || CAPTURE) { if (lit < parts.length) { parts.forEach((w) => w.classList.add("is-lit")); lit = parts.length; } return; }
      // the section is pinned inside a taller track: words light across the pinned stretch, all lit just before it releases
      const tr = $("#storyTrack"), r = tr.getBoundingClientRect(), vh = innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      const p = Math.min(1, Math.max(0, (vh * 0.35 - r.top) / (r.height - vh * 0.85) * 1.3));
      const n = Math.round(p * parts.length);
      if (n !== lit) { parts.forEach((w, i) => w.classList.toggle("is-lit", i < n)); lit = n; }
    };
  }

  /* ===== 3. Why loyalty matters: the row's photo follows the pointer (keyboard focus shows it at a fixed spot) ===== */
  $$(".wrow").forEach((row) => row.addEventListener("pointermove", (e) => {
    const r = row.getBoundingClientRect(); row.style.setProperty("--mx", `${e.clientX - r.left + 130}px`); row.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  /* ===== 3. Recognition: receipts flip into rewards (tap, or they flip in turn when seen) ===== */
  const flips = $$(".flip");
  // the reward (gradient) side shows first; a tap turns it over to the receipt
  flips.forEach((f) => { f.classList.add("is-flipped", "no-anim"); f.setAttribute("aria-pressed", "false"); });
  requestAnimationFrame(() => requestAnimationFrame(() => flips.forEach((f) => f.classList.remove("no-anim"))));
  flips.forEach((f) => f.addEventListener("click", () => { const on = !f.classList.contains("is-flipped"); f.classList.toggle("is-flipped", on); f.setAttribute("aria-pressed", !on); }));

  /* ===== 4. count-up + card tilt ===== */
  const countIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; countIO.unobserve(e.target);
    const el = e.target, end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "";
    if (reduce) return;
    const t0 = performance.now();
    const go = (now) => { const k = Math.min(1, (now - t0) / 1300), v = end * (1 - Math.pow(1 - k, 4)); el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-NG")) + suf; if (k < 1) requestAnimationFrame(go); };
    requestAnimationFrame(go);
  }), { threshold: 0.5 });
  $$("[data-count]").forEach((el) => countIO.observe(el));
  if (!reduce && matchMedia("(hover: hover)").matches) $$(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => { const r = card.getBoundingClientRect(); card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`); card.style.setProperty("--rx", `${(0.5 - (e.clientY - r.top) / r.height) * 8}deg`); });
    card.addEventListener("pointerleave", () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
  });

  /* ===== 4. Numbers: lieflat charts (L14 Hundred Field as a unit waffle, F11 Tick Gauge, L15 Ballot Tally).
     Built once, then driven by scroll: each chart fills in as it travels up the screen. ===== */
  const charts = (() => {
    // colours come from CSS variables (set per theme in css/theme.css), so charts recolour live when the theme switches
    const C = { TXT: "var(--c-txt)", MUT: "var(--c-mut)", GRID: "var(--c-grid)", DATA: "var(--c-data)", HERO: "var(--c-hero)" };
    const NS = "http://www.w3.org/2000/svg";
    const paintAttr = (n, k, v) => { if ((k === "fill" || k === "stroke") && String(v).startsWith("var(")) n.style[k] = v; else n.setAttribute(k, v); };
    const el = (p, t, a) => { const n = document.createElementNS(NS, t); for (const k in a) paintAttr(n, k, a[k]); p.appendChild(n); return n; };
    const txt = (p, a, str) => { const n = el(p, "text", a); n.textContent = str; return n; };
    const rnd = (i, k) => Math.abs(((i * 73856093) ^ (k * 19349663)) % 1000) / 1000;
    const pol = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
    const out = [];

    // waffle: 140 squares = 7,000 registered (1 = 50 people); first 100 fill pink = 5,000 attended
    const sw = $("#chWaffle");
    if (sw) {
      const sq = [];
      for (let k = 0; k < 140; k++) {
        const c = Math.floor(k / 5), r = k % 5, came = k < 100;
        sq.push({ came, n: el(sw, "rect", { x: 2 + c * 36, y: 2 + r * 36, width: 30, height: 30, rx: 5, fill: "none", stroke: C.GRID, "stroke-width": 2 }) });
      }
      out.push({ el: sw.closest(".chart"), set(p) {
        const shown = Math.round(p * 140);
        sq.forEach((q, k) => {
          const on = k < shown;
          q.n.style.fill = on && q.came ? C.HERO : "none";
          q.n.style.stroke = on ? (q.came ? C.HERO : C.DATA) : C.GRID;
        });
      } });
    }

    // gauge: 100 ticks sweep round to 86; the number counts with them
    const sg = $("#chGauge");
    if (sg) {
      const SCORE = 86, cx = 200, cy = 178, R0 = 100, A0 = -195, SW = 210, ticks = [];
      for (let k = 0; k < 100; k++) {
        const a = A0 + (k / 100) * SW, len = k < SCORE ? 14 + rnd(k + 1, 3) * 7 : 6 + rnd(k + 1, 7) * 3;
        const [x1, y1] = pol(cx, cy, R0, a), [x2, y2] = pol(cx, cy, R0 + len, a);
        ticks.push(el(sg, "line", { x1, y1, x2, y2, stroke: C.GRID, "stroke-width": 1.4 }));
      }
      [25, 50, 75, 100].forEach((m) => { const [tx2, ty2] = pol(cx, cy, R0 - 20, A0 + (m / 100) * SW); txt(sg, { x: tx2, y: ty2 + 4, "font-size": 11, "font-weight": 600, fill: C.MUT, "text-anchor": "middle" }, (m / 10).toString()); });
      const num = txt(sg, { x: cx, y: cy, "font-size": 52, "font-weight": 800, fill: C.TXT, "text-anchor": "middle", "letter-spacing": "-2" }, "0.0");
      txt(sg, { x: cx, y: cy + 24, "font-size": 12, "font-weight": 600, fill: C.MUT, "text-anchor": "middle", "letter-spacing": "1.5" }, "OUT OF 10");
      out.push({ el: sg.closest(".chart"), set(p) {
        const lit = Math.round(p * SCORE);
        ticks.forEach((t, k) => { const on = k < lit; t.style.stroke = on ? (k > SCORE - 12 ? C.HERO : C.DATA) : C.GRID; t.setAttribute("stroke-width", on ? 2 : 1.4); });
        num.textContent = (p * 8.6).toFixed(1);
      } });
    }

    // unit row (lieflat G4, as one row): one block per 2025 sponsor or partner, one total.
    // Blocks switch on one by one with scroll; reach counts up beside it.
    const ub = $("#chUnits");
    if (ub) {
      const BRANDS = ["MTN", "UBA", "Konga", "VFD Group", "NGX", "Purple", "Heirs Technologies", "Heirs Insurance Group", "AfriPay", "FirstStone", "Cellar Central", "Atiat", "V", "The Yard", "Abbey", "CSCS", "Flex", "MedPlus", "Chude and Ego", "PwC", "TechCabal", "Nairametrics", "Zikoko"];
      ub.innerHTML = `<div class="ubar__grp" style="--n:1;--c:#FF3E8E"><p><b>${BRANDS.length}</b> <span>brands</span></p><div class="ubar__cells">${BRANDS.map((n) => `<i title="${esc(n)}"></i>`).join("")}</div></div>`;
      const cells = $$("#chUnits i"), reach = $("#reachNum");
      out.push({ el: ub.closest(".chart"), set(p) {
        const on = Math.round(p * cells.length);
        cells.forEach((c, k) => c.classList.toggle("is-on", k < on));
        if (reach) reach.textContent = `${Math.round(p * 10)}M+`;
      } });
    }
    return out;
  })();
  // progress 0..1: starts when the chart's top enters the bottom of the screen, completes when its middle reaches the middle
  function chartsStep() {
    if (CAPTURE) return;
    const vh = innerHeight;
    for (const c of charts) {
      const r = c.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.5 + r.height * 0.5)));
      if (c.last === undefined || Math.abs(c.last - p) > 0.002) { c.set(p); c.last = p; }
    }
  }

  /* ===== 6. Zones: photo gift cards + CD shelf modal ===== */
  const ZONES = [
    ["Stage Experiences", "Talks, hosts and surprise guests on the main stage.", "stage", "g-blue"],
    ["Instant Redemption", "Win it, claim it on the spot.", "redemption", "g-sun"],
    ["Live Games & Challenges", "Play, compete and stack your coins.", "games", "g-candy"],
    ["Performance", "Culture, dance and live acts.", "performance", "g-night"],
    ["Music & Dance", "DJs and dance-offs all day.", "music", "g-gold"],
    ["Brand Missions", "Complete brand tasks for BvndleCoins.", "missions", "g-blue"],
    ["Funtime", "Cup stacking, limbo and everything in between.", "funtime", "g-sun"],
  ];
  const cdm = $("#cdModal"), cdmRow = $("#cdmRow");
  let cdItems = [], cdActive = 0, cdOpener = null, wheelLock = 0;
  function cdLayout() {
    const narrow = innerWidth < 720, dx = narrow ? 46 : 92, dy = narrow ? -30 : -58;
    cdItems.forEach((el, k) => {
      const d = k - cdActive, ad = Math.abs(d), on = d === 0;
      el.style.zIndex = String(200 - ad * 2 - (d > 0 ? 1 : 0));
      el.style.opacity = ad > 9 ? "0" : "1";
      el.style.transform = on ? "translate3d(0,0,160px) scale(1.18)" : `translate3d(${d * dx + (d > 0 ? 70 : -70)}px, ${d * dy}px, ${-ad * 30}px) rotateY(-42deg)`;
      el.classList.toggle("is-active", on);
    });
    $("#cdmCount").textContent = `${cdActive + 1} / ${cdItems.length}`;
  }
  const cdGo = (i) => { cdActive = Math.max(0, Math.min(cdItems.length - 1, i)); cdLayout(); };
  function cdOpen(i, opener, start = 0) {
    const [name, , set] = Array.isArray(i) ? i : ZONES[i];            // a zone index, or a [name, line, set] of 8 photos
    $("#cdmTitle").textContent = name;
    const srcs = Array.isArray(set) ? set : Array.from({ length: 8 }, (_, k) => `assets/img/zones/${set}-${k + 1}.jpg`);   // a zone's 8 photos, or a list
    cdmRow.innerHTML = srcs.map((src, k) => `<button class="cd" type="button" data-k="${k}" aria-label="Photo ${k + 1} of ${srcs.length}"><span class="cd__spine" aria-hidden="true"></span><img src="${src}" alt="${name}, Bvndle Rewards Festival 2025" loading="${k < 4 ? "eager" : "lazy"}" draggable="false"></button>`).join("");
    cdItems = $$(".cd", cdmRow);
    cdItems.forEach((el) => el.addEventListener("click", () => cdGo(+el.dataset.k)));
    cdActive = start; cdOpener = opener; cdm.hidden = false;
    document.documentElement.classList.add("modal-open");
    requestAnimationFrame(() => { cdm.classList.add("is-open"); cdLayout(); });
    $("#cdmClose").focus();
  }
  function cdClose() {
    cdm.classList.remove("is-open"); document.documentElement.classList.remove("modal-open");
    setTimeout(() => { cdm.hidden = true; cdmRow.innerHTML = ""; }, reduce ? 0 : 300);
    if (cdOpener) cdOpener.focus();
  }
  $("#cdmClose").addEventListener("click", cdClose);
  $("#cdmPrev").addEventListener("click", () => cdGo(cdActive - 1));
  $("#cdmNext").addEventListener("click", () => cdGo(cdActive + 1));
  cdm.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cdClose();
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cdGo(cdActive + 1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cdGo(cdActive - 1); }
    if (e.key === "Tab") { const f = $$("button", cdm).filter((b) => !b.disabled && b.offsetParent); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
  });
  cdm.addEventListener("wheel", (e) => { e.preventDefault(); const now = performance.now(); if (now - wheelLock < 260) return; wheelLock = now; cdGo(cdActive + (e.deltaY + e.deltaX > 0 ? 1 : -1)); }, { passive: false });
  let swipe = null;
  $("#cdmStage").addEventListener("pointerdown", (e) => (swipe = { x: e.clientX, y: e.clientY }));
  addEventListener("pointerup", (e) => { if (!swipe || cdm.hidden) { swipe = null; return; } const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) cdGo(cdActive + (dx < 0 ? 1 : -1)); swipe = null; });
  addEventListener("resize", () => { if (!cdm.hidden) cdLayout(); });

  /* ===== 9. Testimonials: data-driven row; add as many as you like ===== */
  const VO = (window.BRF_DATA && window.BRF_DATA.voices) || [];
  const qRow = $("#quotes"), vplayer = $("#vplayer"), vstage = $("#vstage");
  // play icon, duration and the player only for cards that have a video (none yet: they are plain quote cards for now)
  qRow.innerHTML = VO.map((v, i) => v.video ? `<button class="vcard" type="button" data-i="${i}" aria-label="Play ${esc(v.name)}'s video, ${esc(v.time)}">
      <img src="${esc(v.poster)}" alt="" loading="lazy" draggable="false"><span class="vcard__bars" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="vcard__time">${esc(v.time)}</span><span class="vcard__play" aria-hidden="true"><i class="ph-fill ph-play"></i></span>
      <span class="vcard__foot"><q>${esc(v.quote)}</q><b>${esc(v.name)}</b><span>${esc(v.area)}</span></span></button>`
    : `<div class="vcard vcard--still" data-i="${i}">
      <img src="${esc(v.poster)}" alt="" loading="lazy" draggable="false">
      <span class="vcard__foot"><q>${esc(v.quote)}</q><b>${esc(v.name)}</b><span>${esc(v.area)}</span></span></div>`).join("");
  qRow.addEventListener("click", (e) => {
    const b = e.target.closest("button.vcard"); if (!b) return; const v = VO[+b.dataset.i];
    vstage.innerHTML = v.video ? `<video src="${esc(v.video)}" poster="${esc(v.poster)}" controls autoplay playsinline></video>`
      : `<img src="${esc(v.poster)}" alt=""><p class="vplayer__soon"><i class="ph-bold ph-video-camera"></i>Video coming soon<span>${esc(v.name)} &middot; ${esc(v.area)}</span></p>`;
    vplayer.showModal();
  });
  const vClose = () => { const vid = $("video", vstage); if (vid) vid.pause(); vplayer.close(); };
  $("#vclose").addEventListener("click", vClose);
  vplayer.addEventListener("click", (e) => { if (e.target === vplayer) vClose(); });
  const qStep = () => ($(".vcard", qRow)?.offsetWidth || 300) + 16;
  const syncQ = () => { $("#qPrev").disabled = qRow.scrollLeft < 8; $("#qNext").disabled = qRow.scrollLeft > qRow.scrollWidth - qRow.clientWidth - 8; };
  $("#qPrev").addEventListener("click", () => qRow.scrollBy({ left: -qStep(), behavior: reduce ? "auto" : "smooth" }));
  $("#qNext").addEventListener("click", () => qRow.scrollBy({ left: qStep(), behavior: reduce ? "auto" : "smooth" }));
  qRow.addEventListener("scroll", syncQ, { passive: true });
  let qDrag = null;
  qRow.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; qDrag = { x: e.clientX, left: qRow.scrollLeft }; qRow.classList.add("is-dragging"); });
  addEventListener("pointermove", (e) => { if (qDrag) qRow.scrollLeft = qDrag.left - (e.clientX - qDrag.x); });
  addEventListener("pointerup", () => { if (qDrag) { qDrag = null; qRow.classList.remove("is-dragging"); } });
  qRow.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") $("#qNext").click(); if (e.key === "ArrowLeft") $("#qPrev").click(); });
  syncQ();

  /* ===== 12. FAQ tabs ===== */
  const tabs = $$('[role="tab"]');
  const selectTab = (tab) => tabs.forEach((t) => { const on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; $("#" + t.getAttribute("aria-controls")).hidden = !on; });
  tabs.forEach((t, i) => { t.addEventListener("click", () => selectTab(t)); t.addEventListener("keydown", (e) => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; selectTab(n); n.focus(); }); });

  /* reveals + mobile CTA */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$(".h2, .cardwall .gc, .ways .gc, .steps .gc, .q, .why__title, .why__cards, .concert__copy, .lens, .brands__title, .brands__list li").forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--i", i % 4); io.observe(el); });
  const mCta = $("#mobileCta"); let heroIn = true, formIn = false, walkIn = false;
  const syncCta = () => mCta.classList.toggle("is-hidden", heroIn || formIn || walkIn);
  new IntersectionObserver(([e]) => { heroIn = e.isIntersecting; syncCta(); }).observe(hero);
  new IntersectionObserver(([e]) => { formIn = e.isIntersecting; syncCta(); }, { threshold: 0.15 }).observe($("#ticket"));
  // the phone ticket bar steps aside while the floor walk fills the screen (it would cover the stand panel)
  if ($("#jscroll")) new IntersectionObserver(([e]) => { walkIn = e.isIntersecting && e.intersectionRatio > 0; syncCta(); }, { rootMargin: "-40% 0px -40% 0px" }).observe($("#jscroll"));

  /* ===== 11. Free ticket coin: a CSS 3D Bvndle coin (two faces + a rim of thin slices). Drag to spin it; it settles
     back to a slow idle turn. Each new ticket mints the visitor's initials on the back face, flips the coin to show it
     and drops one more coin onto the pile below (one pile coin = COIN_PER tickets). ===== */
  const coinEl = $("#coin"), coinSpin = $("#coinSpin"), coinPile = $("#coinPile");
  const COIN_SLICES = 60, COIN_PER = 5;
  coinSpin.insertAdjacentHTML("beforeend", Array.from({ length: COIN_SLICES }, (_, i) => `<i class="coin3d__edge" style="--a:${i * 360 / COIN_SLICES}deg"></i>`).join(""));
  const spin = { y: -18, x: -10, vy: 0, vx: 0, ty: null };
  let coinDrag = null, coinOn = false, coinsShown = 0;
  const coinLive = !coinEl.hidden;                                     // 22 Oct: the festival guide replaced the coin
  if (coinLive) new IntersectionObserver(([e]) => (coinOn = e.isIntersecting)).observe(coinEl);
  coinEl.addEventListener("pointerdown", (e) => { coinDrag = { x: e.clientX, y: e.clientY }; spin.ty = null; coinEl.setPointerCapture(e.pointerId); coinEl.classList.add("is-drag"); });
  coinEl.addEventListener("pointermove", (e) => {
    if (!coinDrag) return;
    spin.vy = (e.clientX - coinDrag.x) * 0.6; spin.vx = -(e.clientY - coinDrag.y) * 0.35;
    spin.y += spin.vy; spin.x = Math.max(-40, Math.min(40, spin.x + spin.vx));
    coinDrag.x = e.clientX; coinDrag.y = e.clientY;
  });
  const coinUp = () => { coinDrag = null; coinEl.classList.remove("is-drag"); };
  coinEl.addEventListener("pointerup", coinUp); coinEl.addEventListener("pointercancel", coinUp);
  function coinStep() {
    if (!coinOn) return;
    if (spin.ty !== null) { spin.y += (spin.ty - spin.y) * 0.08; if (Math.abs(spin.ty - spin.y) < 0.3) spin.ty = null; }
    else if (!coinDrag) { spin.y += spin.vy + (reduce ? 0 : 0.35); spin.vy *= 0.95; spin.x += (-10 - spin.x) * 0.04; }
    coinSpin.style.transform = `rotateX(${spin.x}deg) rotateY(${spin.y}deg)`;
  }
  // the pile: coins stacked in columns; columns fill unevenly so it reads as a heap, not a bar chart
  const PILE_COLS = 14, pileSeq = [6, 7, 5, 8, 4, 9, 6, 7, 3, 10, 5, 8, 2, 11, 6, 7, 4, 9, 1, 12, 0, 13];
  const pileH = Array(PILE_COLS).fill(0);
  function addPileCoin(fresh) {
    const n = coinsShown++, col = pileSeq[n % pileSeq.length], row = pileH[col]++;
    const c = document.createElement("i");
    c.className = "pcoin" + (fresh ? " is-fresh" : "");
    c.style.cssText = `--c:${col};--r:${row}`;
    coinPile.appendChild(c);
    coinPile.style.setProperty("--rows", Math.max(...pileH));
  }
  /* ===== nudges: every finished action points to the next one (client 23 Oct: "every action should nudge them to
     another action"). What is already done on this device is ticked off, never re-pushed. ===== */
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const doneSteps = () => ({ claim: !!lsGet("brf-claimed"), play: (+lsGet("brf-trivia-best") || 0) > 0, guess: [0, 1, 2].some((i) => lsGet("brf-guess-" + i)), concert: !!lsGet("brf-tix-click") });
  const STEPS = {
    claim: ["Claim your free day pass", "#ticket", "ph-ticket"],
    play: ["Play 1 Million Questions for draw entries", "#trivia", "ph-game-controller"],
    guess: ["Guess the headliners. Right guesses win", "#lineup", "ph-question"],
    concert: ["Book the concert, night of 12th December", null, "ph-music-notes"],
  };
  function nudges(keys, title) {
    const d = doneSteps();
    return `<div class="nudge"><p class="nudge__t">${esc(title)}</p><ul>${keys.map((k) => {
      const [label, href, icon] = STEPS[k], ext = !href;
      return `<li class="${d[k] ? "is-done" : ""}"><a href="${esc(ext ? cfg.tixUrl : href)}"${ext ? ' target="_blank" rel="noopener" data-tixclick' : ""}><i class="ph-bold ${d[k] ? "ph-check-circle" : icon}" aria-hidden="true"></i><span>${esc(label)}</span><i class="ph-bold ${ext ? "ph-arrow-up-right" : "ph-arrow-right"}" aria-hidden="true"></i></a></li>`;
    }).join("")}</ul></div>`;
  }
  // any TIX link counts as "looked at the concert" for the nudges
  document.addEventListener("click", (e) => { if (e.target.closest("[data-tix], [data-tixclick]")) { try { localStorage.setItem("brf-tix-click", "1"); } catch (err) {} } });

  /* ===== form + your ticket ===== */
  const coinCount = $("#coinCount"), coinLabel = $("#coinLabel");
  function syncCoins(fresh) {
    const n = window.PassStore.count(), want = Math.min(PILE_COLS * 12, Math.ceil(n / COIN_PER));
    coinCount.textContent = n.toLocaleString("en-NG");
    coinLabel.textContent = n === 1 ? "ticket claimed" : "tickets claimed";
    if (coinLive) while (coinsShown < want) addPileCoin(fresh && coinsShown === want - 1);
  }
  addEventListener("storage", () => syncCoins(false));
  const area = $("#passArea"), formHTML = area.innerHTML;
  const setInvalid = (id, bad) => { $("#" + id).classList.toggle("is-invalid", bad); $(`#${id} .input`)?.setAttribute("aria-invalid", bad ? "true" : "false"); };   // the yes/no group has no .input
  // the festival guide glows brighter once this visitor has a ticket (and flares the moment it is claimed)
  const guide = $("#guide");
  function lightGuide(flare) {
    if (!guide) return;
    guide.classList.add("is-lit"); $("#guideKey").textContent = "You're in. She's glowing for you.";
    if (flare) { guide.classList.remove("is-flare"); void guide.offsetWidth; guide.classList.add("is-flare"); }
  }
  function showPass(pass, isNew) {
    area.innerHTML = `
      <div class="gc yourpass" role="status" tabindex="-1" id="passCard">
        <p class="gc__label">${isNew ? "You're in." : "Welcome back."} Show this at the gate.</p><span class="gc__tag">FREE TICKET &middot; DAY PASS</span>
        <p class="yourpass__name">${esc(pass.name)}</p>
        <div class="yourpass__meta"><span>${esc(cfg.datesLabel)}</span><span>${esc(cfg.venue)}</span>${pass.tag ? `<span>@${esc(pass.tag)}</span>` : ""}</div>
        <p class="yourpass__code">${esc(pass.code)}</p>${(() => { let n = 0; try { n = +localStorage.getItem("brf-trivia-best") || 0; } catch (e) {} return n ? `<p class="yourpass__entries">${n} trivia ${n === 1 ? "entry" : "entries"} in the draw</p>` : ""; })()}
        <p class="gc__big gc__big--r" aria-hidden="true">2026</p>
      </div>
      ${nudges(["play", "guess", "concert"], "Your day pass is set. What's next?")}
      <button class="linkish" type="button" id="another">Get a ticket for someone else</button>`;
    $("#passCard").focus({ preventScroll: true });
    $("#another").addEventListener("click", () => { area.innerHTML = formHTML; bindForm($("#passForm")); $("#first").focus(); });
  }
  // server-side problems reuse the field's error line with a more specific message, restored on the next edit
  function failField(id, msg) { const fl = $("#" + id), p = $(".err", fl); if (p) { if (p.dataset.def === undefined) p.dataset.def = p.textContent; p.textContent = msg; } setInvalid(id, true); $(".input", fl)?.focus(); }
  function resetErr(fl) { const p = $(".err", fl); if (p && p.dataset.def !== undefined) p.textContent = p.dataset.def; }
  function bindForm(f) {
    f.addEventListener("input", (e) => { const fl = e.target.closest(".field"); if (fl && fl.classList.contains("is-invalid")) { setInvalid(fl.id, false); resetErr(fl); } });
    // "Do you have a Bvndle tag?" Yes shows the tag box, No skips it
    const tagField = $("#f-tag", f);
    f.addEventListener("change", (e) => {
      if (e.target.name !== "hasTag") return;
      $("#f-has", f).classList.remove("is-invalid");
      tagField.hidden = e.target.value !== "yes";
      if (e.target.value === "yes") f.tag.focus(); else { f.tag.value = ""; setInvalid("f-tag", false); }
    });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const clean = (v) => v.trim().replace(/\s+/g, " ");
      const first = clean(f.first.value), last = clean(f.last.value), name = `${first} ${last}`.trim();
      const email = f.email.value.trim().toLowerCase(), emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      const phone = window.normalizeNgPhone(f.phone.value), has = (f.querySelector('[name="hasTag"]:checked') || {}).value;
      const tag = has === "yes" ? f.tag.value.trim().replace(/^@/, "") : "";
      setInvalid("f-first", first.length < 1); setInvalid("f-last", last.length < 1); setInvalid("f-email", !emailOk); setInvalid("f-phone", !phone);
      $("#f-has", f).classList.toggle("is-invalid", !has); setInvalid("f-tag", has === "yes" && !tag);
      if (!first) return f.first.focus();
      if (!last) return f.last.focus();
      if (!emailOk) return f.email.focus();
      if (!phone) return f.phone.focus();
      if (!has) return f.querySelector('[name="hasTag"]').focus();
      if (has === "yes" && !tag) return f.tag.focus();
      const btn = $("#passSubmit", f), label = btn.innerHTML; btn.disabled = true; btn.textContent = "Claiming your ticket...";
      window.PassStore.claim({ first, last, email, phone, tag }).then(({ ok, pass, isNew, error }) => {
        if (!ok) {
          btn.disabled = false; btn.innerHTML = label;
          (window.brfTrack || (() => {}))("ticket_error", error);
          if (error === "email_taken") return failField("f-email", "This email already has a ticket, under a different phone number.");
          if (error === "phone_taken") return failField("f-phone", "This number already has a ticket, under a different email.");
          if (error === "invalid_email") return failField("f-email", "That email doesn't look right. Check it and try again.");
          if (error === "invalid_phone") return failField("f-phone", "Enter a valid Nigerian number, like 0803 123 4567.");
          if (error === "missing_tag") return failField("f-tag", 'Type your tag, or choose "No, skip".');
          btn.textContent = "Try again";
          return alert("We couldn't reach our ticket desk. Check your connection and try again.");
        }
        try {
          localStorage.setItem("brf-claimed", "1");
          // "my ticket": the first ticket claimed on this device (a ticket for someone else does not replace it)
          if (!localStorage.getItem("brf-my-pass")) localStorage.setItem("brf-my-pass", JSON.stringify(pass));
        } catch (e) {}
        storyCta();
        dispatchEvent(new Event("brf:claimed"));
        (window.brfTrack || (() => {}))(isNew ? "ticket_claimed" : "ticket_reopened");
        // mint: initials on the back face, flip to show it, then the pile grows
        $("#coinMine").textContent = name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
        if (isNew) spin.ty = Math.ceil((spin.y + 360) / 360) * 360 + 180;
        syncCoins(isNew); showPass(pass, isNew); lightGuide(true);
      });
    });
  }
  bindForm($("#passForm"));
  syncCoins(false);
  window.PassStore.refreshCount().then(() => syncCoins(false));
  // returning ticket holders see their ticket in the section, not an empty form
  { let mine = null; try { mine = JSON.parse(lsGet("brf-my-pass") || "null"); } catch (e) {}
    if (mine && mine.code) showPass(mine, false); }

  /* ===== the ticket button follows the story (nav + phone bar): "See the experience" until the zones are behind you,
     then "Get free ticket", then "My ticket" once you have one. First-timers are pulled into the story instead of
     jumping straight to the form. The hero keeps its own "Get free ticket" (client asked for that one button). ===== */
  function storyCta() {
    const navB = $(".nav__cta"), barB = $("#mobileCta .btn"), js = $("#jscroll");
    const mine = !!lsGet("brf-my-pass"), passed = lsGet("brf-floor-seen") === "1" || (js && js.getBoundingClientRect().bottom < innerHeight * 0.4);   // the walk's end has scrolled above mid-screen
    const state = mine ? "mine" : passed ? "ticket" : "explore";
    if (navB && navB.dataset.state === state) return;
    const L = { explore: ["See the experience", "#journey", "ph-map-trifold"], ticket: ["Get free ticket", "#ticket", "ph-arrow-right"], mine: ["My ticket", "#ticket", "ph-ticket"] }[state];
    [navB, barB].forEach((b) => { if (!b) return; b.dataset.state = state; b.href = L[1];
      b.innerHTML = b === navB ? (state === "mine" ? `<i class="ph-bold ${L[2]}" aria-hidden="true"></i> ${L[0]}` : L[0]) : `${L[0]} <i class="ph-bold ${L[2]}" aria-hidden="true"></i>`;
      b.classList.remove("is-swap"); void b.offsetWidth; b.classList.add("is-swap"); });
  }
  let ctaT = 0;   // straight from scroll, lightly throttled (a frame callback can stall in background tabs)
  addEventListener("scroll", () => { const n = performance.now(); if (n - ctaT > 120) { ctaT = n; storyCta(); } }, { passive: true });
  addEventListener("scrollend", storyCta);
  storyCta();

  /* fit big faded words edge to edge of their card (or the viewport for the sign-off) */
  function fitAll() {
    $$(".gc__big--fit").forEach((el) => {
      const box = el.classList.contains("signoff__dec") ? document.documentElement.clientWidth : el.parentElement.clientWidth;
      el.style.fontSize = "100px"; el.style.width = "max-content"; // measure the text itself, not its stretched box
      const w = el.getBoundingClientRect().width; el.style.width = "";
      if (!w) return;
      let fs = (100 * box) / w;
      el.style.fontSize = `${fs}px`;
      // reward cards: the numeral starts just under the copy and runs off the bottom; the card clips it
      const info = el.closest(".flip__back") && el.parentElement.querySelector(".flip__info");
      if (info) { el.style.bottom = "auto"; el.style.top = `${info.offsetTop + info.offsetHeight + 14 - fs * 0.1}px`; }
    });
  }
  // re-fit whenever a card changes size (column changes, late fonts, pane resizes), not only on window resize
  if (window.ResizeObserver) { let fq = 0; const ro = new ResizeObserver(() => { cancelAnimationFrame(fq); fq = requestAnimationFrame(fitAll); }); $$(".gc__big--fit").forEach((el) => ro.observe(el.parentElement)); }
  document.fonts.ready.then(fitAll); addEventListener("resize", fitAll); fitAll();

  /* sign-off: the "ride". A glass tube built from offset copies of one spine path (edges, liquid shading,
     specular). Pink-to-purple liquid fills it with scroll (scrubbed, lerped); each title letter appears once the
     liquid's head passes its x position. */
  const ride = $("#signoff");
  let decStep = () => {};
  if (ride) {
    const svg = $(".ride__svg", ride), spine = $("#rideSpine"), title = $("#rideTitle"), L = spine.getTotalLength();
    // letters wrapped per word, so a narrow screen breaks between words, never inside one
    title.innerHTML = title.textContent.split(" ").map((w) => `<span class="rw">${[...w].map((ch) => `<span class="rl">${esc(ch)}</span>`).join("")}</span>`).join(" ");
    const letters = $$(".rl", title);
    const k =matchMedia("(max-width: 760px)").matches ? 0.72 : 1;
    // sample the spine once; offset paths follow its normals (negative = above the centre line)
    const N = 420, pts = [];
    for (let i = 0; i <= N; i++) { const q = spine.getPointAtLength((L * i) / N); pts.push([q.x, q.y]); }
    const offset = (d) => pts.map(([x, y], i) => {
      const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(N, i + 1)], dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy) || 1;
      return `${i ? "L" : "M"}${(x - (dy / m) * d * k).toFixed(1)} ${(y + (dx / m) * d * k).toFixed(1)}`;
    }).join("");
    // smooth glass: many thin translucent offset bands per layer group, softened by a small blur (Paul asked for
    // smooth 3D and a pink-to-purple blend here, an explicit exception to the flat-only rule)
    const NS = "http://www.w3.org/2000/svg", fills = [], R = 34;
    svg.insertAdjacentHTML("afterbegin", `<defs>
      <linearGradient id="rideGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="0"><stop offset="0" stop-color="#FF3E8E"/><stop offset=".35" stop-color="#FF3E8E"/><stop offset="1" stop-color="#8B80F9"/></linearGradient>
      <filter id="rideSoft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="840"><feGaussianBlur stdDeviation="1.3"/></filter>
      <filter id="rideSofter" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="840"><feGaussianBlur stdDeviation="4"/></filter></defs>`);
    const grad = $("#rideGrad", svg);
    const group = (filter) => { const g = document.createElementNS(NS, "g"); if (filter) g.setAttribute("filter", `url(#${filter})`); svg.appendChild(g); return g; };
    const band = (g, cls, off, w, op, fill) => {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("d", offset(off)); el.setAttribute("class", `ride__band ${cls}`); el.style.strokeWidth = w * k;
      if (op != null) el.style.opacity = op;
      if (fill) { el.setAttribute("pathLength", "1"); el.style.strokeDasharray = "1 1"; el.style.strokeDashoffset = 1; fills.push(el); }
      g.appendChild(el);
    };
    // 1. soft shadow under the tube (shows in Light mode only)
    band(group("rideSofter"), "ride__shadow", R + 14, 22);
    // 2. glass body: faint tint, then Fresnel edges that fade toward the centre on both sides
    const gl = group("rideSoft");
    band(gl, "ride__body", 0, R * 2);
    for (let j = 0; j < 20; j++) { const op = 0.16 * Math.pow(1 - j / 20, 2.2); band(gl, "ride__edge", -(R - 1 - j * 0.75), 1.6, op); band(gl, "ride__edge", R - 1 - j * 0.75, 1.6, op * 0.8); }
    // 3. liquid: blended pink to purple, darker underside, soft top highlight; all scrubbed together
    svg.querySelector("defs").insertAdjacentHTML("beforeend", `<clipPath id="rideClip" clipPathUnits="userSpaceOnUse"><path id="rideClipP"/></clipPath>`);
    const liqG = document.createElementNS(NS, "g"); liqG.setAttribute("clip-path", "url(#rideClip)"); svg.appendChild(liqG);
    const clipP = $("#rideClipP", svg);
    band(liqG, "ride__liq", 0, 46, null, true);
    // the liquid's front behaves like a real fluid. At rest it is a still, slightly rounded meniscus. Its motion comes
    // from a damped spring driven by the flow: moving forward, the edge leans and stretches; when the scroll stops it
    // sloshes back once or twice and settles. Nothing moves on its own while the liquid is still.
    function drawFront(now) {
      const r = 25 * k, flow = Math.max(-16, Math.min(16, (cur - lastDraw) * L * 0.9)); lastDraw = cur;
      slosh.v += (flow - slosh.x) * 0.1; slosh.v *= 0.82; slosh.x += slosh.v;   // spring toward the flow, damped
      if (Math.abs(slosh.x) < 0.02 && Math.abs(slosh.v) < 0.02 && cur === drawnAt) return; drawnAt = cur;   // settled and not moving: nothing to redraw
      const lean = slosh.x * k;
      // meniscus (centre a touch ahead) + lean (the lower half runs ahead while flowing) + a soft bulge that follows the lean
      const edge = (s) => 3 * k * (1 - Math.pow(2 * s - 1, 2)) + lean * (s - 0.35) * 1.3 + Math.abs(lean) * 0.35 * Math.sin(Math.PI * s);
      const L1 = L * cur, P = spine.getPointAtLength(L1), Q = spine.getPointAtLength(Math.max(0, L1 - 2));
      let ang = Math.atan2(P.y - Q.y, P.x - Q.x); if (L1 < 2) ang = 0;
      const ca = Math.cos(ang), sa = Math.sin(ang), W = (x, y) => `${(P.x + x * ca - y * sa).toFixed(1)} ${(P.y + x * sa + y * ca).toFixed(1)}`;
      // clip: everything behind the edge (the tube never curves back past its own head)
      let c = `M${W(-4000, -600)} L${W(edge(0), -600)}`;
      for (let i = 0; i <= 16; i++) { const s = i / 16; c += ` L${W(edge(s), -r + 2 * r * s)}`; }
      clipP.setAttribute("d", c + ` L${W(edge(1), 600)} L${W(-4000, 600)}Z`);
    }
    const lq = document.createElementNS(NS, "g"); lq.setAttribute("filter", "url(#rideSoft)"); liqG.appendChild(lq);
    for (let j = 0; j < 16; j++) band(lq, "ride__lshade", 6 + j * 1.1, 1.8, 0.03 + j * 0.016, true);
    band(lq, "ride__lshine", -11, 4, 0.3, true); band(lq, "ride__lshine", -11, 9, 0.22, true);
    // 4. glass highlights: soft specular streak with a crisp core, plus a low catchlight
    const hi = group("rideSoft");
    band(hi, "ride__spec", -R * 0.58, 7, 0.4);
    band(hi, "ride__spec", R * 0.68, 3, 0.12);
    band(svg, "ride__spec", -R * 0.58, 1.6, 0.9);
    let cur = 0, last = -1, lastDraw = 0, drawnAt = -1; const slosh = { x: 0, v: 0 };
    const track = $("#signoffTrack");
    decStep = () => {
      const r = track.getBoundingClientRect(), vh = innerHeight, rh = ride.offsetHeight;
      if (r.top > vh || r.bottom < 0) return;
      // the ride is pinned (sticky) inside a taller track: filling starts as the tube comes up the screen and
      // finishes as the track runs out, about a screen of scrolling while it stays in view
      const pinTop = Math.max(0, (vh - rh) / 2), from = vh * 0.55, to = pinTop - (r.height - rh);
      const target = reduce ? 1 : Math.min(1, Math.max(0, (from - r.top) / (from - to)));
      cur += (target - cur) * (reduce ? 1 : 0.075);
      if (!reduce) drawFront(performance.now());                        // the water keeps moving while it is on screen
      if (Math.abs(cur - last) < 0.0002) return;
      if (reduce) drawFront(0);
      last = cur;
      // purple runs to the head; pink trails a third behind it
      fills.forEach((el) => (el.style.strokeDashoffset = Math.max(0, 1 - cur - (cur > 0.004 ? 30 / L : 0))));
      // the blend always spans the filled length: pink at the tail, purple at the head
      const head = spine.getPointAtLength(L * cur), sr = svg.getBoundingClientRect(), hx = sr.left + (head.x / 1600) * sr.width;
      grad.setAttribute("x2", Math.max(240, head.x));
      letters.forEach((l) => l.classList.toggle("is-in", l.getBoundingClientRect().left + 4 < hx || cur > 0.995));
    };
  }

  /* ===== 8. Concert globe: 2025 concert photos on the outside of a ball, seen from in front. Drag to spin it.
     CSS does the 3D (world: translateZ(-R) rotateX(pitch) rotateY(yaw); tile: rotateY(lon) rotateX(-lat) translateZ(R)),
     so the front photo is largest and the ones round the side shrink and turn away.
     The same rotation is done here in JS to fade tiles towards the rim and to draw the grid. ===== */
  const globe = $("#globe"), gWorld = $("#globeWorld"), gGrid = $("#globeGrid"), gx = gGrid.getContext("2d");
  // concert nights only (2025, Pixieset "Concert Day 1/2" sets): people on the mic and the crowd. No Segun Johnson.
  // assets/img/concert/c01..c32.jpg, captions in the same order
  const G_CAPS = [
    "On stage", "Yinka Ayefele", "Yinka Ayefele", "Yinka Ayefele", "Yinka Ayefele", "On stage", "On stage", "On stage",
    "On stage", "On stage", "On stage", "On stage", "The crowd", "The crowd", "The crowd", "The crowd",
    "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd",
    "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd", "The crowd",
  ];
  const G_SRC = G_CAPS.map((_, i) => `assets/img/concert/c${String(i + 1).padStart(2, "0")}.jpg`), G_N = G_CAPS.length;
  const G_PHOTOS = G_CAPS.map((c, i) => [G_SRC[i], c]);
  // mix stage shots into the crowd: stage, crowd, crowd, stage, crowd, crowd ...
  const G_ORDER = []; { const st = [...G_CAPS.keys()].filter((i) => G_CAPS[i] !== "The crowd"), cr = [...G_CAPS.keys()].filter((i) => G_CAPS[i] === "The crowd"); while (st.length || cr.length) { if (st.length) G_ORDER.push(st.shift()); for (let j = 0; j < 2 && cr.length; j++) G_ORDER.push(cr.shift()); } }
  const G_SET = ["The concert, 2025", "", G_SRC];
  const G_ROWS = [-30, -15, 0, 15, 30], G_STEP = 15;                    // degrees
  const gTiles = [];
  G_ROWS.forEach((lat, r) => {
    for (let c = 0; c < 360 / G_STEP; c++) {
      const k = G_ORDER[(c + r * 15) % G_N];                              // 75 tiles walk the photos, never repeating side by side
      const cap = G_PHOTOS[k][1];
      gTiles.push({ lat, lon: c * G_STEP + (r % 2 ? G_STEP / 2 : 0), k, html: `<button class="gtile" type="button" data-t="${gTiles.length}" aria-label="${cap}, concert photo ${k + 1} of ${G_N}: open"><img src="${G_SRC[k]}" alt="" loading="lazy" draggable="false"><span class="gtile__cap"><span>${cap}</span><span>2025</span></span></button>` });
    }
  });
  gWorld.innerHTML = gTiles.map((t) => t.html).join("");
  $$(".gtile", gWorld).forEach((el, i) => { gTiles[i].el = el; el.style.transform = `rotateY(${gTiles[i].lon}deg) rotateX(${-gTiles[i].lat}deg) translateZ(var(--gr))`; });
  const gView = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: null, tp: null };
  let gP = 1600, gR = 1200, gW = 0, gH = 0, gOn = false, gDrag = null, gMoved = 0, gDirty = true;
  const D2R = Math.PI / 180;
  // unit-sphere position of (lon, lat) after the view rotation, matching the CSS transform order
  function gProj(lon, lat) {
    let x = 0, y = 0, z = 1, a, c, s;
    a = -lat * D2R; c = Math.cos(a); s = Math.sin(a); [y, z] = [y * c - z * s, y * s + z * c];                // rotateX(-lat)
    a = (lon + gView.yaw) * D2R; c = Math.cos(a); s = Math.sin(a); [x, z] = [x * c + z * s, -x * s + z * c]; // rotateY(lon + yaw)
    a = gView.pitch * D2R; c = Math.cos(a); s = Math.sin(a); [y, z] = [y * c - z * s, y * s + z * c];       // rotateX(pitch)
    return [x, y, z];
  }
  function gSize() {
    // everything scales with the ball (gR): photo size, spacing and the section's height, so the
    // composition is the same at every width: about four photos across, three rows in view
    const narrow = innerWidth < 760;
    gR = narrow ? 520 : Math.max(760, innerWidth * 0.83); gP = gR * 1.33;
    globe.style.height = `${narrow ? 460 : Math.round(Math.max(520, Math.min(gR * 0.62, innerHeight)))}px`;
    const r = globe.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    gW = r.width; gH = r.height; gGrid.width = gW * dpr; gGrid.height = gH * dpr; gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    globe.style.setProperty("--gp", `${gP}px`); globe.style.setProperty("--gr", `${gR}px`);
    globe.style.setProperty("--gw", `${narrow ? 96 : Math.round(Math.min(260, Math.max(176, gR * 0.16)))}px`);
    gDirty = true;
  }
  function gDraw() {
    gWorld.style.transform = `translateZ(${-gR}px) rotateX(${gView.pitch}deg) rotateY(${gView.yaw}deg)`;
    for (const t of gTiles) {
      const z = gProj(t.lon, t.lat)[2], o = Math.max(0, Math.min(1, (z - 0.2) / 0.4));       // fade out towards the rim
      t.el.style.opacity = o.toFixed(3); t.el.style.pointerEvents = o > 0.25 ? "" : "none";
    }
    // latitude / longitude grid, 10° apart, projected with the same camera (front half only)
    gx.clearRect(0, 0, gW, gH); gx.strokeStyle = "rgba(255,255,255,.2)"; gx.lineWidth = 1;
    const cx = gW / 2, cy = gH / 2;
    const line = (pts) => { gx.beginPath(); let pen = false; for (const [lon, lat] of pts) { const [x, y, z] = gProj(lon, lat); if (z < 0) { pen = false; continue; } const k = gP / (gP + gR - gR * z), sx = cx + gR * x * k, sy = cy + gR * y * k; pen ? gx.lineTo(sx, sy) : gx.moveTo(sx, sy); pen = true; } gx.stroke(); };
    for (let lat = -80; lat <= 80; lat += 10) line(Array.from({ length: 73 }, (_, i) => [i * 5, lat]));
    for (let lon = 0; lon < 360; lon += 10) line(Array.from({ length: 33 }, (_, i) => [lon, -80 + i * 5]));
    $("#globeN").textContent = `${(6.43 - gView.pitch).toFixed(2).padStart(5, "0")}°`;
    $("#globeE").textContent = `${(((3.43 - gView.yaw) % 360 + 360) % 360).toFixed(2).padStart(6, "0")}°`;
  }
  function globeStep() {
    if (!gOn && !gDirty) return;
    if (!gW) gSize();
    if (gView.ty !== null) {                                              // glide to a focused tile
      const dy = ((gView.ty - gView.yaw + 540) % 360) - 180;
      gView.yaw += dy * 0.12; gView.pitch += (gView.tp - gView.pitch) * 0.12;
      if (Math.abs(dy) < 0.05) gView.ty = null;
    } else if (!gDrag) {
      gView.yaw += gView.vy - (reduce ? 0 : 0.03); gView.pitch += gView.vp;
      gView.vy *= 0.93; gView.vp *= 0.93;
    }
    gView.pitch = Math.max(-16, Math.min(16, gView.pitch));
    gDraw(); gDirty = false;
  }
  new IntersectionObserver(([e]) => (gOn = e.isIntersecting)).observe(globe);
  addEventListener("resize", () => { gW = 0; });
  globe.addEventListener("pointerdown", (e) => { if (e.button) return; gDrag = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" }; gMoved = 0; gView.ty = null; });
  addEventListener("pointermove", (e) => {
    if (!gDrag) return;
    const dx = e.clientX - gDrag.x, dy = e.clientY - gDrag.y; gDrag.x = e.clientX; gDrag.y = e.clientY;
    gMoved += Math.abs(dx) + Math.abs(dy);
    if (gMoved > 6) { globe.classList.add("is-drag", "is-used"); if (!gDrag.cap) { globe.setPointerCapture(e.pointerId); gDrag.cap = true; } }
    const k = 57.3 / gR;                                                  // degrees per pixel, so the photo under the finger follows it
    gView.vy = dx * k; gView.yaw += gView.vy;
    if (!gDrag.touch) { gView.vp = -dy * k; gView.pitch += gView.vp; }   // on phones vertical drags scroll the page
    gDirty = true;
  });
  const gEnd = () => { if (!gDrag) return; gDrag = null; globe.classList.remove("is-drag"); };
  addEventListener("pointerup", gEnd); addEventListener("pointercancel", gEnd);
  gWorld.addEventListener("click", (e) => {
    const b = e.target.closest(".gtile"); if (!b) return;
    if (gMoved > 6) { e.preventDefault(); return; }                      // that was a drag, not a tap
    const t = gTiles[+b.dataset.t]; cdOpen(G_SET, b, t.k);
  });
  gWorld.addEventListener("focusin", (e) => {                            // keyboard: turn the globe to the focused photo
    const b = e.target.closest(".gtile"); if (!b) return;
    const t = gTiles[+b.dataset.t]; gView.ty = -t.lon; gView.tp = t.lat * 0.6; gDirty = true; globe.classList.add("is-used");
  });

  const BD = window.BRF_DATA || {};

  /* ===== 1b. Guess the headliners. 2025 artists in a row; three 2026 headliners hidden behind pixel mosaics.
     Each unlocked clue makes the mosaic finer. A guess always gets "close, but not quite": the answer is never
     on the page. Guesses are kept on this device for now (later: sent to the backend for a "what Lagos thinks" tally). ===== */
  if (BD.lineup) {
    const L = BD.lineup, today = new Date().toISOString().slice(0, 10);
    const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    $("#pastRow").innerHTML = L.past.map((a) => `<li class="pcard">${a.photo ? `<img src="${a.photo}" alt="${esc(a.name)} on the Bvndle stage, 2025" loading="lazy">` : `<span class="pcard__ph" aria-hidden="true">${esc(a.name.split(" ").map((w) => w[0]).join(""))}</span>`}<span class="pcard__name">${esc(a.name)}</span><span class="pcard__yr">2025</span></li>`).join("");
    const getGuess = (i) => { try { return localStorage.getItem("brf-guess-" + i) || ""; } catch (e) { return ""; } };
    const unlocked = (m) => m.clues.filter(([d]) => d <= today).length;
    $("#mystery").innerHTML = L.mystery.map((m, i) => {
      const u = unlocked(m), nextClue = m.clues.find(([d]) => d > today), g = getGuess(i);
      return `<button class="mcard" type="button" data-i="${i}" aria-label="Headliner ${i + 1}: make a guess">
        <img class="mcard__sil" src="assets/img/lineup/sil-${(i % 3) + 1}.png" alt="" draggable="false">
        <span class="mcard__num">0${i + 1}</span><span class="mcard__q" aria-hidden="true">?</span>
        <span class="mcard__meta"><b>Clue ${u} of ${m.clues.length}</b>${nextClue ? ` &middot; next drops ${fmt(nextClue[0])}` : ` &middot; ${esc(L.revealLabel)}`}</span>
        <span class="mcard__guess">${g ? `Your guess: <b>${esc(g)}</b>` : "Tap to guess"}</span></button>`;
    }).join("");
    const box = $("#guessBox"), SAYS = ["You're close… but that's not quite it.", "Ooh, warm. Not quite it.", "Close! Keep watching for the next clue."];
    let gi = 0;
    $("#mystery").addEventListener("click", (e) => {
      const b = e.target.closest(".mcard"); if (!b) return;
      gi = +b.dataset.i; const m = L.mystery[gi];
      $("#guessNum").textContent = $("#guessWhich").textContent = "0" + (gi + 1);
      $("#guessClues").innerHTML = m.clues.map(([d, t], k) => d <= today ? `<li><b>Clue ${k + 1}</b><span>${esc(t)}</span></li>` : `<li class="is-locked"><i class="ph-bold ph-lock-simple" aria-hidden="true"></i><b>Clue ${k + 1}</b><span>${fmt(d)}</span></li>`).join("");
      $("#guessInput").value = getGuess(gi); $("#guessSay").textContent = ""; $("#guessNext").innerHTML = "";
      try { $("#guessTag").value = localStorage.getItem("brf-guess-tag") || ""; } catch (err) {}
      $("#f-gtag").classList.remove("is-invalid");
      box.showModal(); $("#guessInput").focus();
    });
    $("#guessForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#guessInput").value.trim(); if (!v) return $("#guessInput").focus(); (window.brfTrack || (() => {}))("headliner_guess", "Headliner " + (gi + 1));
      const tag = $("#guessTag").value.trim().replace(/^@/, "");
      $("#f-gtag").classList.toggle("is-invalid", !tag); $("#guessTag").setAttribute("aria-invalid", tag ? "false" : "true");
      if (!tag) return $("#guessTag").focus();
      try { localStorage.setItem("brf-guess-" + gi, v); localStorage.setItem("brf-guess-tag", tag); } catch (err) {}
      // the answer is never on the page: a tease, then the promise that a right guess is rewarded
      $("#guessSay").innerHTML = `${esc(SAYS[Math.floor(Math.random() * SAYS.length)])}<small>Locked in for @${esc(tag)}. Right guesses get rewarded at the reveal.</small>`;
      $(`.mcard[data-i="${gi}"] .mcard__guess`).innerHTML = `Your guess: <b>${esc(v)}</b>`;
      $("#guessNext").innerHTML = nudges(["play", "concert"], "While you wait for the reveal");
    });
    $("#guessClose").addEventListener("click", () => box.close());
    $("#guessNext").addEventListener("click", (e) => { if (e.target.closest("a[href^='#']")) box.close(); });
    box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
  }

  /* ===== 5. The journey: the festival floor (the client's isometric plan in zone colours), pinned while you scroll.
     You start at the entrance arrow and walk the dashed route; each station lights up as the walker reaches it and
     the card says what happens there. Stations are visited in route order (the route, not the numbers, sets it).
     A zone's passport stamp lands once all its stations are behind you. Return visits open on the whole floor with
     a zone dock (tap a zone to fly to its area). Data: BRF_DATA.floor + BRF_DATA.journey (zone names, colours). ===== */
  const J = BD.journey || [], FL = BD.floor, jscroll = $("#jscroll");
  let journeyStep = () => {};
  if (jscroll && J.length && FL) fetch(FL.art).then((r) => r.text()).then((art) => {
    const svg = $("#jmap"), NS = "http://www.w3.org/2000/svg", [VX, VY, VW, VH] = FL.view, navEl = $("#jnav");
    svg.innerHTML = art.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    // the drawing keeps its own view box and is rendered once, at about walking zoom (Z px per drawing unit); the
    // camera then moves it with a CSS transform (GPU), so scrolling never forces the detailed drawing to redraw
    svg.setAttribute("viewBox", `${VX} ${VY} ${VW} ${VH}`); svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("is-floor");
    let Z = 1;
    const sizeFloor = () => { const r = navEl.getBoundingClientRect(); Z = Math.max(1, r.width / (innerWidth <= 900 ? 400 : 560)); svg.style.width = `${VW * Z}px`; svg.style.height = `${VH * Z}px`; };
    sizeFloor();
    const trail = $(".trail", svg); if (!trail) return;
    const len = trail.getTotalLength();
    // the walked part of the route: a solid line drawn over the dashed one
    const done = document.createElementNS(NS, "path");
    done.setAttribute("d", trail.getAttribute("d")); done.setAttribute("class", "rt--walked");
    done.style.strokeDasharray = `${len} ${len}`; done.style.strokeDashoffset = len;
    trail.after(done);
    // the walker sits on the floor layer, beneath the stands and people, with a flat "beat" rippling out on the floor
    const walker = document.createElementNS(NS, "g"); walker.setAttribute("class", "jmark"); walker.id = "jmark";
    walker.innerHTML = `<ellipse class="jmark__ring" rx="22" ry="11"/><ellipse class="jmark__ring jmark__ring--2" rx="22" ry="11"/><ellipse class="jmark__dot" rx="9" ry="4.6"/>`;
    done.after(walker);
    // stations in drawing units, then ordered by where the route passes them
    const samples = []; for (let i = 0; i <= 400; i++) { const L = (len * i) / 400, q = trail.getPointAtLength(L); samples.push([L, q.x, q.y]); }
    const stations = FL.stations.map((st) => {
      const x = VX + (st.x_pct / 100) * VW, y = VY + (st.y_pct / 100) * VH;
      let best = samples[0], bd = Infinity; samples.forEach((p) => { const dd = (p[1] - x) ** 2 + (p[2] - y) ** 2; if (dd < bd) { bd = dd; best = p; } });
      return { ...st, x, y, L: best[0], z: J[st.zone] || J[0] };
    }).sort((p, q) => p.L - q.L);
    // stops: the entrance, every station in route order, then the exit
    const stops = [{ kind: "in", L: 0 }, ...stations.map((st, i) => ({ kind: "st", st, i, L: st.L })), { kind: "out", L: len }];
    jscroll.style.setProperty("--steps", stops.length);
    const pins = document.createElementNS(NS, "g"); pins.setAttribute("class", "fpins");
    stations.forEach((st, i) => (st.no = String(i + 1).padStart(2, "0")));   // numbered in walking order
    pins.innerHTML = stations.map((st, i) => `<g class="fpin" data-i="${i}" data-z="${st.zone}" transform="translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})" style="--zc:${st.z.color};--zt:${st.z.text}"><circle r="13"/><text y="4.5">${st.no}</text></g>`).join("")
      // entrance and exit tags where the trail starts and ends (replacing the drawing's arrows)
      + (() => { const a = trail.getPointAtLength(0), b = trail.getPointAtLength(len);
        const tag = (p, label, icon, dx, dy) => `<g class="ftag" transform="translate(${(p.x + dx).toFixed(1)} ${(p.y + dy).toFixed(1)})"><rect x="-46" y="-13" width="92" height="26" rx="13"/><circle cx="-31" cy="0" r="5"/><text x="6" y="4.5">${label}</text></g>`;
        return tag(a, "ENTRANCE", "", -58, 6) + tag(b, "EXIT", "", 0, 22); })();
    svg.appendChild(pins);
    const mark = $("#jmark", svg);
    // the map talks: a callout beside the stand you are at (hidden while you walk to the next one)
    const talk = document.createElement("div"); talk.className = "jtalk"; talk.setAttribute("aria-hidden", "true");
    $("#jnav").appendChild(talk);
    let talkFor = "", talkW = 0;
    function placeTalk(stop, on) {
      if (!on || compact) { talk.classList.remove("is-on"); return; }
      const key = stop.kind === "st" ? stop.st.no : stop.kind;
      if (key !== talkFor) {
        talkFor = key; talkW = 0;
        if (stop.kind === "st") { const st = stop.st, z = st.z; talk.style.setProperty("--zc", z.color);
          talk.innerHTML = `<p class="jtalk__k"><b>${st.no}</b>${esc(z.name)}</p><p class="jtalk__t">${esc(st.name)}</p><p class="jtalk__d">${esc(st.does || "")}</p><p class="jtalk__c">+${st.coins || 0} coins</p>`; }
        else { talk.style.setProperty("--zc", "#FF3E8E");
          talk.innerHTML = stop.kind === "in" ? `<p class="jtalk__t">Start here</p><p class="jtalk__d">Follow the pink trail. Scroll to walk to the first stand.</p>` : `<p class="jtalk__t">That's the floor</p><p class="jtalk__d">Five zones, ${stations.length} stands. Zones open at 1pm on both days.</p>`; }
      }
      // pin to the stand's spot on screen; flip to the left when there is no room on the right
      const ctm = svg.getScreenCTM(), nav = $("#jnav").getBoundingClientRect(); if (!ctm) return;
      const pt = stop.kind === "st" ? { x: stop.st.x, y: stop.st.y } : trail.getPointAtLength(stop.L);
      const sx = pt.x * ctm.a + ctm.e - nav.left, sy = pt.y * ctm.d + ctm.f - nav.top;
      if (!talkW) talkW = talk.offsetWidth;                              // measured once per stand, not every frame
      const left = sx + 36 + talkW > nav.width - 12;
      talk.classList.toggle("is-left", left);
      talk.style.transform = `translate3d(${(left ? sx - 36 - talkW : sx + 36).toFixed(0)}px, ${(sy - 32).toFixed(0)}px, 0)`;
      talk.classList.add("is-on");
    }
    const zoneStations = J.map((_, zi) => stations.filter((st) => st.zone === zi));
    const zoneCoins = zoneStations.map((list) => list.reduce((t, st) => t + (st.coins || 0), 0));
    $("#jbar").innerHTML = stations.map((st, i) => `<i data-k="${i + 1}" style="--zc:${st.z.color}"></i>`).join("");
    $("#jpass").innerHTML = `<p class="jpass__label">Festival passport</p><div class="jpass__slots">` + J.map((z, zi) => `<span class="jpass__slot" data-z="${zi}"><span class="stamp" style="--ink:${z.color === "#FFD23F" ? "#8a6a00" : z.color};--rot:${(zi % 2 ? 1 : -1) * (5 + zi * 2)}deg"><i class="ph-bold ${z.icon}" aria-hidden="true"></i><b>${esc(z.name)}</b><small>Done</small></span></span>`).join("") + `</div><p class="jpass__total"><b id="jtotal">0</b> coins earned</p>`;
    const card = $("#jcard2");
    let cur = -1;
    function show(k) {
      if (k === cur) return; cur = k;
      const s0 = stops[k];
      $$(".fpin", svg).forEach((g) => { const i = +g.dataset.i + 1; g.classList.toggle("is-done", i < k); g.classList.toggle("is-here", i === k); });
      $$("#jbar i").forEach((t) => t.classList.toggle("is-on", +t.dataset.k <= k));
      // stamps: a zone is done once all of its stations are behind the walker; coins add up station by station
      let total = 0;
      stations.forEach((st, i) => { if (i + 1 <= k) total += st.coins || 0; });
      J.forEach((z, zi) => { const list = zoneStations[zi], ok = list.length && list.every((st) => stations.indexOf(st) + 1 <= k); $(`.jpass__slot[data-z="${zi}"]`).classList.toggle("is-stamped", ok); });
      $("#jtotal").textContent = total.toLocaleString("en-NG");
      if (s0.kind === "in") {
        card.style.setProperty("--zc", "#F3F0EB"); card.style.setProperty("--zt", "#111");
        card.innerHTML = `<div class="jnav__zone"><i class="ph-bold ph-sign-in" aria-hidden="true"></i><span>Entrance</span><b>The festival floor</b></div>
          <div class="jnav__body"><p class="jnav__step">${stations.length} stations &middot; ${J.length} zones</p><h4>Follow the trail.</h4>
          <p class="jnav__d">Every station earns coins and every zone has its own prize. Scroll to walk the floor, station by station.</p></div>`;
      } else if (s0.kind === "out") {
        card.style.setProperty("--zc", "#F3F0EB"); card.style.setProperty("--zt", "#111");
        card.innerHTML = `<div class="jnav__zone"><i class="ph-bold ph-sign-out" aria-hidden="true"></i><span>Exit</span><b>That's the floor</b></div>
          <div class="jnav__body"><p class="jnav__step">${total.toLocaleString("en-NG")} coins on the way round</p><h4>Now come and do it for real.</h4>
          <p class="jnav__d">Zones open at 1pm on both days. Your free day pass gets you onto the floor.</p>
          <div class="jnav__next"><a class="btn btn--sm" href="#ticket">Lock in your free day pass <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></a><a class="btn btn--sm btn--ghost" href="#trivia">Play for entries</a></div></div>`;
      } else {
        const { st, i } = s0, z = st.z;
        card.style.setProperty("--zc", z.color); card.style.setProperty("--zt", z.text);
        card.innerHTML = `<div class="jnav__zone"><i class="ph-bold ${z.icon}" aria-hidden="true"></i><span>Zone</span><b>${esc(z.name)}</b></div>
          <p class="jnav__prize"><i class="ph-bold ph-trophy" aria-hidden="true"></i>${z.prize ? `<b>${esc(z.prize)}</b> to be won in ${esc(z.name)}` : `${esc(z.name)} prize to be announced`}</p>
          <img src="assets/img/zones/${z.set}-${st.img || 1}.jpg" alt="" loading="lazy">
          <div class="jnav__body"><p class="jnav__step">Stand ${st.no} of ${stations.length}</p>
          <h4>${esc(st.name)}</h4><p class="jnav__d">${esc(st.does || "")}</p>
          <p class="jnav__coins">+${st.coins || 0} coins &middot; ${total.toLocaleString("en-NG")} so far</p></div>`;
      }
      card.classList.remove("is-in"); void card.offsetWidth; card.classList.add("is-in");
    }
    // camera: the viewBox eases toward its target every frame
    const cam = { x: VX, y: VY, w: VW, h: VH }, aspect = () => { const r = navEl.getBoundingClientRect(); return r.height / Math.max(1, r.width); };
    // the camera window (cam, in drawing units) becomes a translate + scale of the floor layer
    const setView = () => {
      const nw = navEl.clientWidth, k = nw / (cam.w * Z);
      svg.style.transform = `translate3d(${(-(cam.x - VX) * Z * k).toFixed(2)}px, ${(-(cam.y - VY) * Z * k).toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
    };
    addEventListener("resize", () => { sizeFloor(); setView(); });
    // the whole floor, fitted to the screen (wide screens: fit the height; tall ones: fit the width)
    // desktop: the card covers the left third, so the floor sits in the right two thirds; phones: the top part
    const whole = () => {
      const a = aspect() || 0.6, narrow = innerWidth <= 900;
      if (narrow) { const w = Math.max(VW, VH / 0.5 / a) * 1.04, h = w * a; return [VX + VW / 2 - w / 2, VY + VH / 2 - h * 0.32, w]; }
      const w = Math.max(VW / 0.62, VH / 0.8 / a), h = w * a; return [VX + VW / 2 - w * 0.66, VY + VH / 2 - h / 2, w];
    };
    { const [x, y, w] = whole(); cam.x = x; cam.y = y; cam.w = w; cam.h = w * (aspect() || 0.6); setView(); }
    show(0);
    // the people in the drawing pop in (each on its own delay) the first time the floor comes into view
    new IntersectionObserver(([e], ob) => { if (e.isIntersecting) { svg.classList.add("is-live"); ob.disconnect(); } }, { threshold: 0.2 }).observe(svg);
    let jp = -1;
    const SEEN = "brf-floor-seen", jsec = $("#journey");                // own key: finishing the old zone tour must not skip the floor
    let compact = false; try { compact = localStorage.getItem(SEEN) === "1"; } catch (e) {}
    // zone tiles: same three rows on every tile (icon, name, prize); TBA uses the same type as the amounts
    $("#jseenZones").innerHTML = J.map((z, i) => `<li><button class="jtile" type="button" data-z="${i}" aria-pressed="false" style="--zc:${z.color};--zt:${z.text}"><i class="ph-bold ${z.icon}" aria-hidden="true"></i><b>${esc(z.name)}</b><strong>${z.prize ? esc(z.prize) : "TBA"}<small>${z.prize ? "to be won" : "prize soon"}</small></strong></button></li>`).join("");
    // tap a zone: the camera glides to its stations (above the dock) and the other zones' pins fade; tap again for all
    let flyQ = 0, focusZ = -1;
    function flyTo(tx, ty, tw) {
      const a = aspect() || 0.6, th = tw * a; cancelAnimationFrame(flyQ);
      const step = () => {
        const e = reduce ? 1 : 0.14;
        cam.x += (tx - cam.x) * e; cam.y += (ty - cam.y) * e; cam.w += (tw - cam.w) * e; cam.h += (th - cam.h) * e; setView();
        if (Math.abs(tx - cam.x) + Math.abs(ty - cam.y) + Math.abs(tw - cam.w) > 1) flyQ = requestAnimationFrame(step);
      };
      step();
    }
    function focusZone(i) {
      focusZ = focusZ === i ? -1 : i;
      $$(".jtile").forEach((t) => { const on = +t.dataset.z === focusZ; t.classList.toggle("is-on", on); t.setAttribute("aria-pressed", on); });
      svg.classList.toggle("has-focus", focusZ >= 0);
      $$(".fpin", svg).forEach((g) => g.classList.toggle("is-zone", +g.dataset.z === focusZ));
      if (focusZ < 0) { const [x, y, w] = whole(); flyTo(x, y, w); return; }
      const list = zoneStations[focusZ]; if (!list.length) return;
      const xs = list.map((st) => st.x), ys = list.map((st) => st.y), a = aspect() || 0.6;
      const x1 = Math.min(...xs) - 150, x2 = Math.max(...xs) + 150, y1 = Math.min(...ys) - 110, y2 = Math.max(...ys) + 110;
      const tw = Math.max(x2 - x1, (y2 - y1) / 0.62 / a, 420);
      flyTo((x1 + x2) / 2 - tw / 2, y1 - 40, tw);                       // a little above centre: the dock covers the bottom
    }
    $("#jseenZones").addEventListener("click", (e) => { const t = e.target.closest(".jtile"); if (t) focusZone(+t.dataset.z); });
    function setCompact(on) {
      compact = on; jsec.classList.toggle("is-compact", on); $("#jseen").hidden = !on; if (on) placeTalk(null, false);
      if (on) { done.style.strokeDashoffset = 0; $$(".fpin", svg).forEach((g) => g.classList.add("is-done")); const [x, y, w] = whole(); cam.x = x; cam.y = y; cam.w = w; cam.h = w * (aspect() || 0.6); setView(); }
    }
    let walked = false; const seenStops = new Set();
    $("#jreplay").addEventListener("click", () => {
      seenStops.clear();
      try { localStorage.removeItem(SEEN); } catch (e) {}
      walked = false; if (focusZ >= 0) focusZone(focusZ); setCompact(false); jp = -1; cur = -1; show(0);
      jscroll.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
    if (compact) setCompact(true);
    // tapping a zone in the passport jumps the walk to that zone's first stand
    $$(".jpass__slot", $("#jpass")).forEach((slot) => {
      const zi = +slot.dataset.z;
      slot.setAttribute("role", "button"); slot.tabIndex = 0;
      slot.setAttribute("aria-label", `Go to the ${J[zi].name} zone`);
      const go = () => {
        if (compact) return focusZone(zi);
        const k = stops.findIndex((st) => st.kind === "st" && st.st.zone === zi); if (k < 0) return;
        const span = jscroll.offsetHeight - innerHeight, top = jscroll.getBoundingClientRect().top + scrollY;
        const p = 0.06 + 0.94 * (k / (stops.length - 1));
        window.scrollTo({ top: top + p * span + 2, behavior: reduce ? "auto" : "smooth" });
      };
      slot.addEventListener("click", go);
      slot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    journeyStep = () => {
      if (compact) return;
      const r = jscroll.getBoundingClientRect(), span = jscroll.offsetHeight - innerHeight;
      // finished the walk and scrolled past it: collapse now, holding the next section still on screen
      if (walked && r.bottom < 0) {
        const ref = jsec.nextElementSibling || jsec, t0 = ref.getBoundingClientRect().top;
        setCompact(true);
        const t1 = ref.getBoundingClientRect().top;
        if (Math.abs(t1 - t0) > 1) window.scrollBy({ top: t1 - t0, behavior: "instant" });
        return;
      }
      if (r.bottom < 0 || r.top > innerHeight || span <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / span));
      // count stands from where the reader has actually scrolled (not from the camera's catch-up glide, which sweeps
      // every stand when someone jumps past the section)
      seenStops.add(Math.round(Math.max(0, (p - 0.06) / 0.94) * (stops.length - 1)));
      jp = jp < 0 || reduce ? p : jp + (p - jp) * 0.14;
      // walked = reached the end having actually passed through most stands (a reload that lands further down the
      // page must not count as having walked it)
      if (!walked && p > 0.97 && seenStops.size >= Math.ceil(stops.length * 0.6)) { walked = true; try { localStorage.setItem(SEEN, "1"); } catch (e) {} }
      $("#jhint").classList.toggle("is-gone", jp > 0.02);
      // first 6% of the scroll: zoom from the whole floor to walking level. Then every step is: hold at a stand (60% of
      // its scroll, the callout talks), then walk to the next one (40%, eased, the callout hides)
      const intro = Math.min(1, jp / 0.06), walk = Math.max(0, (jp - 0.06) / 0.94) * (stops.length - 1);
      const i0 = Math.min(stops.length - 2, Math.floor(walk)), f = walk - i0, HOLD = 0.55;
      const t = f < HOLD ? 0 : (f - HOLD) / (1 - HOLD), ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      const atEnd = walk >= stops.length - 1.001, A = stops[i0], B = stops[Math.min(stops.length - 1, i0 + 1)];
      // the walker visits each stand itself: step off the trail to the stand, hold, step back on, walk the trail, step
      // off to the next stand. Even stands that share a spot on the trail (e.g. 04 and 05) get a real walk between them.
      const at = (stop) => (stop.kind === "st" ? { x: stop.st.x, y: stop.st.y } : trail.getPointAtLength(stop.L));
      const mix = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
      let q, L;
      if (atEnd) { q = at(stops[stops.length - 1]); L = len; }
      else if (t === 0) { q = at(A); L = A.L; }
      else if (t < 0.22) { const u = ease(t / 0.22); q = mix(at(A), trail.getPointAtLength(A.L), u); L = A.L; }
      else if (t < 0.78) { L = A.L + (B.L - A.L) * ease((t - 0.22) / 0.56); q = trail.getPointAtLength(L); }
      else { const u = ease((t - 0.78) / 0.22); q = mix(trail.getPointAtLength(B.L), at(B), u); L = B.L; }
      const k = atEnd ? stops.length - 1 : (t >= 0.9 ? i0 + 1 : i0);     // the card changes on arrival, not halfway
      done.style.strokeDashoffset = len - L;
      mark.setAttribute("transform", `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
      show(k);
      const a = aspect() || 0.6, narrow = innerWidth <= 900, [wx, wy, ww] = whole();
      const zw = narrow ? 400 : 560, tw = ww + (zw - ww) * intro, th = tw * a;      // close in on the stand, neighbours still in view
      // keep the walker right of centre on desktop (the card sits on the left); higher on phones (card below)
      const fx = narrow ? 0.5 : 0.64, fy = narrow ? 0.4 : 0.52;
      const tx = wx + (q.x - fx * tw - wx) * intro, ty = wy + (q.y - fy * th - wy) * intro;
      const e = reduce ? 1 : 0.18;
      cam.x += (tx - cam.x) * e; cam.y += (ty - cam.y) * e; cam.w += (tw - cam.w) * e; cam.h += (th - cam.h) * e;
      setView();
      placeTalk(stops[k], intro > 0.9 && (atEnd || t === 0 || t >= 0.95) && Math.abs(tx - cam.x) < 40);   // talk once the camera has arrived
    };
  }).catch(() => {});

  /* ===== 5c. Main stage talks: an agenda that grows. Day tabs appear when there is more than one day; each day is a
     list of rows (time, talk and speaker, topic). A long day scrolls inside its own frame (about six rows tall) with a
     "scroll for more" cue, so the section never grows past the screen. Data: BRF_DATA.stage.days (an older flat
     "talks" list still works as one day). ===== */
  const ST = BD.stage;
  if (ST && $("#stageTalks")) {
    const days = ST.days && ST.days.length ? ST.days : [{ label: "", talks: ST.talks || [] }];
    const tabs = $("#stageTabs"), list = $("#stageTalks"), frame = $("#stageFrame"), hint = $("#stageHint");
    let day = 0;
    $("#stageNote").textContent = ST.note || "";
    const row = (t) => `<li class="arow" style="--tc:${ST.topics[t.topic] || "#F3F0EB"}">
      <span class="arow__time">${esc(t.time)}${t.until ? `<small>to ${esc(t.until)}</small>` : ""}</span>
      <div class="arow__main"><h4>${esc(t.title)}</h4>${t.speaker
        ? `<p><span class="arow__mic" aria-hidden="true"><i class="ph-bold ph-microphone-stage"></i></span><b>${esc(t.speaker)}</b><span>${esc(t.role || "")}</span></p>`
        : t.note ? `<p class="arow__note">${esc(t.note)}</p>` : ""}</div>
      <div class="arow__meta">${t.topic ? `<span class="arow__tag">${esc(t.topic)}</span>` : ""}${t.where ? `<span class="arow__where">${esc(t.where)}</span>` : ""}</div></li>`;
    // the cue shows only while there is more below; the frame is a keyboard-scrollable region when it overflows
    const syncHint = () => {
      const more = frame.scrollHeight - frame.clientHeight > 4;
      frame.classList.toggle("is-scrolling", more); frame.tabIndex = more ? 0 : -1;
      if (more) frame.setAttribute("aria-label", "Talks list, scrollable"); else frame.removeAttribute("aria-label");
      hint.hidden = !more || frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 4;
    };
    function render() {
      list.innerHTML = (days[day].talks || []).map(row).join("");
      frame.scrollTop = 0; syncHint();
      $$(".agenda__tab", tabs).forEach((b, k) => { b.setAttribute("aria-selected", k === day); b.tabIndex = k === day ? 0 : -1; });
    }
    frame.addEventListener("scroll", syncHint, { passive: true }); addEventListener("resize", syncHint);
    if (days.length > 1) {
      tabs.hidden = false;
      tabs.innerHTML = days.map((dd, k) => `<button class="agenda__tab" role="tab" type="button" data-d="${k}"><b>${esc(dd.label)}</b>${dd.date ? `<span>${esc(dd.date)}</span>` : ""}</button>`).join("");
      tabs.addEventListener("click", (e) => { const b = e.target.closest(".agenda__tab"); if (b) { day = +b.dataset.d; render(); } });
      tabs.addEventListener("keydown", (e) => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; day = (day + (e.key === "ArrowRight" ? 1 : days.length - 1)) % days.length; render(); $$(".agenda__tab", tabs)[day].focus(); });
    }
    render();
  }

  /* ===== 6b. VIP concert experience: hall plan + tiers (Dave / Jetron style). Pointing at an area shows the view from
     there, its price and how fast it is going; the tier list and the plan highlight each other. Buying hands off to TIX. ===== */
  const V = BD.vip;
  if (V && $("#vtiers")) {
    $("#vipNote").textContent = V.note || "";
    const zoneOf = (t) => t.zone || t.id;
    const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
    // tickets are split into Individual and Group tabs (V.groups); the hall plan still shows every zone
    const groups = V.groups || [["all", "Tickets"]];
    let vGroup = groups[0][0];
    const tierHTML = (t) => `<li class="vtier" data-z="${zoneOf(t)}"><img src="${t.view}" alt="" loading="lazy"><div><b>${esc(t.name)}</b><span>${esc(t.line)}</span><span class="vtier__price">${esc(t.price)}${t.status ? ` <em>${esc(t.status)}</em>` : ""}</span></div><a class="btn btn--sm" href="${esc(cfg.tixUrl)}" target="_blank" rel="noopener" aria-label="Buy ${esc(t.name)} on TIX">TIX <i class="ph-bold ph-arrow-up-right" aria-hidden="true"></i></a></li>`;
    function showGroup(g) {
      vGroup = g;
      $("#vtabs").innerHTML = groups.map(([id, lab]) => `<button type="button" role="tab" class="vtab${id === g ? " is-on" : ""}" aria-selected="${id === g}" data-g="${id}">${esc(lab)} <small>${V.tiers.filter((t) => (t.group || "all") === id).length}</small></button>`).join("");
      $("#vtiers").innerHTML = V.tiers.filter((t) => (t.group || "all") === g).map(tierHTML).join("");
      $$(".vtier").forEach((t) => { t.addEventListener("pointerenter", () => hi(t.dataset.z)); t.addEventListener("pointerleave", () => hi(null)); });
    }
    $("#vtabs").addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b && b.dataset.g !== vGroup) showGroup(b.dataset.g); });
    // the hall: stage at the top, curved rows fanning out below it (Premium front row, VIP, then the concert floor),
    // round tables down both sides. No seats are shown as taken: sales happen on TIX, so the plan can't know.
    const vsvg = $("#vmapSvg"), CX = 300, CY = 44;
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const arcRows = (radii, a0, a1, takenP) => radii.map((r) => { const n = Math.floor((r * (a1 - a0) * Math.PI / 180) / 13); return Array.from({ length: n + 1 }, (_, i) => { const ang = (a0 + (a1 - a0) * (i / n)) * Math.PI / 180; return `<circle cx="${(CX + Math.cos(ang) * r).toFixed(1)}" cy="${(CY + Math.sin(ang) * r).toFixed(1)}" r="4.6"${rnd() < takenP ? ' class="taken"' : ""}/>`; }).join(""); }).join("");
    const tables = [[62, 150], [62, 230], [62, 310], [538, 150], [538, 230], [538, 310]].map(([x, y]) => `<circle class="tbl" cx="${x}" cy="${y}" r="15"/>` + Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<circle cx="${(x + Math.cos(a) * 26).toFixed(1)}" cy="${(y + Math.sin(a) * 26).toFixed(1)}" r="4.4"/>`; }).join("")).join("");
    vsvg.innerHTML = `<rect class="vstage" x="170" y="10" width="260" height="34" rx="8"/><text class="vlabel" x="300" y="33" text-anchor="middle">STAGE</text>
      <g class="vzone" data-z="front" tabindex="0" role="button" aria-label="Premium, front row">${arcRows([78, 94], 30, 150, 0)}</g>
      <g class="vzone" data-z="vip" tabindex="0" role="button" aria-label="VIP">${arcRows([112, 128], 29, 151, 0)}</g>
      <g class="vzone" data-z="floor" tabindex="0" role="button" aria-label="Concert floor">${arcRows([152, 168, 184, 200, 216, 232], 28, 152, 0)}${arcRows([254, 270, 286, 302, 318, 334, 350, 366, 382], 52, 128, 0)}</g>
      <g class="vzone" data-z="tables" tabindex="0" role="button" aria-label="Tables">${tables}</g>`;
    const pop = $("#vpop"), map = $(".vmap");
    const hi = (id) => { map.classList.toggle("is-focus", !!id); $$(".vzone", vsvg).forEach((z) => z.classList.toggle("is-on", z.dataset.z === id)); $$(".vtier").forEach((t) => t.classList.toggle("is-on", t.dataset.z === id)); };
    function showZone(z, px, py) {
      const zid = z.dataset.z, ts = V.tiers.filter((x) => zoneOf(x) === zid); if (!ts.length) return;
      if (V.groups && !ts.some((x) => x.group === vGroup)) showGroup(ts[0].group);
      hi(zid);
      if (pop.dataset.z !== zid) {
        pop.dataset.z = zid;
        const lo = Math.min(...ts.map((x) => x.amount || Infinity));
        const name = ts.length > 1 ? ((V.zones && V.zones[zid]) || ts[0].name) : ts[0].name;
        const meta = ts.length > 1 ? (ts.every((x) => x.amount === lo) ? `${naira(lo)} per table` : `From ${naira(lo)}`) : ts[0].price + (ts[0].status ? ` &middot; <b>${esc(ts[0].status)}</b>` : "");
        pop.innerHTML = `<img src="${ts[0].view}" alt="View from ${esc(name)}"><p class="vpop__name">${esc(name)}</p><p class="vpop__meta">${ts.length > 1 ? esc(meta) : meta}</p>`;
      }
      pop.hidden = false;
      const mr = map.getBoundingClientRect();
      if (px === undefined) { const zr = z.getBoundingClientRect(); px = zr.left + zr.width / 2; py = zr.top; }
      pop.style.left = `${Math.min(mr.width - pop.offsetWidth - 8, Math.max(8, px - mr.left + 18))}px`;
      pop.style.top = `${Math.min(mr.height - pop.offsetHeight - 8, Math.max(8, py - mr.top - pop.offsetHeight - 14))}px`;
    }
    $$(".vzone", vsvg).forEach((z) => {
      z.addEventListener("pointermove", (e) => showZone(z, e.clientX, e.clientY)); z.addEventListener("focus", () => showZone(z)); z.addEventListener("click", (e) => showZone(z, e.clientX, e.clientY));
      z.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showZone(z); } });
    });
    map.addEventListener("pointerleave", () => { pop.hidden = true; hi(null); });
    showGroup(vGroup);
  }

  /* ===== 8b. 1 Million Questions. Ticket holders play the real questions, marked on the server (js/store.js ->
     Supabase): one question at a time, options shuffled per person, 15 s each, every question answered once.
     Every right answer is a draw entry; every 10 right answers earns 5 BvndleCoins (pending until an admin approves).
     Anyone can play a practice round on the sample questions in js/trivia.js (no entries, no coins). ===== */
  const quiz = $("#quiz"), TV = window.BRF_TRIVIA;
  if (quiz && TV) {
    const ROUND = 10, SECS = 15, PRACTICE_ROUND = 5;
    const T = window.PassStore.trivia;
    const token = () => { try { return (JSON.parse(localStorage.getItem("brf-my-pass") || "null") || {}).token || null; } catch (e) { return null; } };
    const plural = (n, one, many) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;
    const sampleNote = TV.sample ? `<p class="quiz__note">Practice uses sample questions. The real round uses the 1 Million Questions set.</p>` : "";
    let timer = 0, answered = false, roundRight = 0, roundCoins = 0, roundN = 0, last = null;

    function stop() { clearInterval(timer); }
    // the ticket card and the "next step" nudges read the entry count from here
    const remember = (st) => { try { localStorage.setItem("brf-trivia-best", String(st.correct || 0)); } catch (e) {} };
    function bar(secs, onEnd) {
      const end = performance.now() + secs * 1000; stop();
      timer = setInterval(() => {
        const left = Math.max(0, end - performance.now()), el = $("#quizBar");
        if (el) el.style.transform = `scaleX(${left / (SECS * 1000)})`;
        if (!left) { stop(); onEnd(); }
      }, 100);
    }
    function oops(msg) {
      stop();
      quiz.innerHTML = `<div class="quiz__card quiz__card--start"><p class="quiz__big" aria-hidden="true">!</p><h3>${esc(msg)}</h3>
        <div class="quiz__ctas"><button class="btn" type="button" id="quizBack">Back <i class="ph-bold ph-arrow-left" aria-hidden="true"></i></button></div></div>`;
      $("#quizBack").addEventListener("click", qIdle);
    }

    async function qIdle() {
      stop();
      const tok = token();
      if (!tok) {                                                       // no ticket yet: same choices for everyone
        quiz.innerHTML = `<div class="quiz__card quiz__card--start">
          <p class="quiz__big" aria-hidden="true">?</p>
          <h3>Play for entries and coins</h3><p>${ROUND} questions &middot; ${SECS} seconds each &middot; every right answer is a draw entry, every 10 earn 5 BvndleCoins</p>
          <div class="quiz__ctas"><button class="btn" type="button" id="quizGo">Play for entries <i class="ph-bold ph-play" aria-hidden="true"></i></button><button class="btn btn--ghost" type="button" id="quizPractice">Practice first <i class="ph-bold ph-barbell" aria-hidden="true"></i></button></div>
          <p class="quiz__note">Practice is open to everyone and doesn't count.</p>${sampleNote}</div>`;
        $("#quizGo").addEventListener("click", needTicket);
        $("#quizPractice").addEventListener("click", practiceStart);
        return;
      }
      quiz.innerHTML = `<div class="quiz__card quiz__card--start"><p class="quiz__big" aria-hidden="true">?</p><h3>Loading your score...</h3></div>`;
      const r = await T.status(tok);
      if (!r.ok) return r.error === "invalid_token" ? forget() : oops("We couldn't load your score. Check your connection and try again.");
      const st = r.data; remember(st);
      if (st.questions_left <= 0) {
        quiz.innerHTML = `<div class="quiz__card quiz__card--end"><p class="quiz__big">${st.correct}<small> ${st.correct === 1 ? "entry" : "entries"}</small></p>
          <h3>You've answered every question.</h3><p class="quiz__best">${plural(st.coins_earned, "coin", "coins")} earned. Winners are announced live on ${esc(TV.drawDay || "the day")}.</p></div>`;
        return;
      }
      quiz.innerHTML = `<div class="quiz__card quiz__card--start">
        <p class="quiz__big" aria-hidden="true">?</p>
        <h3>Play for entries and coins</h3><p>${ROUND} questions &middot; ${SECS} seconds each &middot; every 10 right answers earns 5 BvndleCoins</p>
        <p class="quiz__best">You have <b>${plural(st.correct, "entry", "entries")}</b> and <b>${plural(st.coins_earned, "coin", "coins")}</b>. ${st.next_award_in} more right ${st.next_award_in === 1 ? "answer" : "answers"} for your next 5 coins.</p>
        <div class="quiz__ctas"><button class="btn" type="button" id="quizGo">Play ${ROUND} questions <i class="ph-bold ph-play" aria-hidden="true"></i></button><button class="btn btn--ghost" type="button" id="quizPractice">Practice <i class="ph-bold ph-barbell" aria-hidden="true"></i></button></div>
        <p class="quiz__note">Each question can only be answered once, and the clock is checked on our side. Coins are added to your Bvndle account after the festival team approves them.</p></div>`;
      $("#quizGo").addEventListener("click", liveStart);
      $("#quizPractice").addEventListener("click", practiceStart);
    }
    function forget() { try { localStorage.removeItem("brf-my-pass"); } catch (e) {} qIdle(); }
    // "Play for entries" without a ticket: ask for one, then bring them straight back to the game
    let wantsToPlay = false;
    function needTicket() {
      wantsToPlay = true; (window.brfTrack || (() => {}))("quiz_needs_ticket");
      quiz.innerHTML = `<div class="quiz__card quiz__card--start">
        <p class="quiz__big" aria-hidden="true"><i class="ph-bold ph-ticket"></i></p>
        <h3>Your entries need a free ticket</h3><p>It's free and takes a minute. Your entries, coins and draw prizes are tied to it.</p>
        <div class="quiz__ctas"><a class="btn" href="#ticket" id="quizClaim">Get my free ticket <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></a><button class="btn btn--ghost" type="button" id="quizPractice">Practice instead <i class="ph-bold ph-barbell" aria-hidden="true"></i></button></div></div>`;
      $("#quizPractice").addEventListener("click", practiceStart);
    }
    addEventListener("brf:claimed", () => {
      if (!wantsToPlay) return;
      wantsToPlay = false;
      setTimeout(() => $("#trivia").scrollIntoView({ behavior: "smooth", block: "start" }), 1600);
    });

    /* ---- the real round ---- */
    function liveStart() { (window.brfTrack || (() => {}))("quiz_play"); roundRight = 0; roundCoins = 0; roundN = 0; last = null; liveNext(); }
    async function liveNext() {
      if (roundN >= ROUND) return liveDone();
      quiz.innerHTML = `<div class="quiz__card"><div class="quiz__top"><span>Question ${roundN + 1} / ${ROUND}</span><span>Right ${roundRight}</span></div><h3 class="quiz__q">Loading...</h3></div>`;
      const r = await T.next(token());
      if (!r.ok) return oops("We couldn't load the next question. Check your connection and try again.");
      const q = r.data;
      if (q.done) { last = q.summary; return liveDone(true); }
      answered = false;
      quiz.innerHTML = `<div class="quiz__card">
        <div class="quiz__top"><span>Question ${roundN + 1} / ${ROUND}</span><span>Right ${roundRight}</span></div>
        <div class="quiz__time"><i id="quizBar"></i></div>
        <h3 class="quiz__q">${esc(q.question)}</h3>
        <div class="quiz__opts">${q.options.map((t, k) => `<button class="quiz__opt" type="button" data-k="${k}"><b>${"ABCD"[k]}</b><span>${esc(t)}</span></button>`).join("")}</div>
        <p class="quiz__say" id="quizSay"></p></div>`;
      $$(".quiz__opt", quiz).forEach((b) => b.addEventListener("click", () => liveAnswer(q, +b.dataset.k)));
      $(".quiz__opt", quiz).focus({ preventScroll: true });
      bar(Math.min(SECS, q.seconds_left ?? SECS), () => liveAnswer(q, -1));
    }
    async function liveAnswer(q, k) {
      if (answered) return; answered = true; stop();
      $$(".quiz__opt", quiz).forEach((b) => (b.disabled = true));
      const r = await T.answer(token(), q.id, k);
      if (!r.ok) return r.error === "already_answered" ? liveNext() : oops("We couldn't save that answer. Check your connection and try again.");
      const a = r.data; last = a.summary; roundN++; remember(a.summary);
      if (a.correct) roundRight++;
      roundCoins += a.coins_awarded || 0;
      $$(".quiz__opt", quiz).forEach((b, i) => { b.classList.toggle("is-ok", i === a.correct_choice); b.classList.toggle("is-no", i === k && !a.correct); });
      const say = $("#quizSay");
      say.textContent = a.correct ? (a.coins_awarded ? `Correct! +${a.coins_awarded} BvndleCoins` : "Correct!") : a.timed_out ? "Time's up." : "Not this time.";
      say.className = "quiz__say " + (a.correct ? "is-ok" : "is-no");
      setTimeout(liveNext, a.correct ? (a.coins_awarded ? 1800 : 1100) : 1700);
    }
    function liveDone(outOfQuestions) {
      stop(); (window.brfTrack || (() => {}))("quiz_round_done", null, roundRight);
      const st = last || { correct: 0, coins_earned: 0, next_award_in: 10 };
      const line = outOfQuestions ? "You've answered every question." : roundRight === ROUND ? "Perfect round." : roundRight === 0 ? "No right answers this round. Have another go." : `${roundRight} right this round.`;
      quiz.innerHTML = `<div class="quiz__card quiz__card--end">
        <div class="stubs" aria-hidden="true">${Array.from({ length: Math.max(roundN, 1) }, (_, i) => `<span class="rstub${i < roundRight ? " is-won" : ""}" style="--i:${i}">#${String(1000 + Math.floor(Math.random() * 9000))}</span>`).join("")}</div>
        <p class="quiz__big">${st.correct}<small> ${st.correct === 1 ? "entry" : "entries"}</small></p><h3>${line}</h3>
        <p class="quiz__best">${roundCoins ? `You earned <b>${roundCoins} BvndleCoins</b> this round. ` : ""}Total: <b>${plural(st.coins_earned, "coin", "coins")}</b>, pending approval. ${outOfQuestions ? "" : `${st.next_award_in} more right ${st.next_award_in === 1 ? "answer" : "answers"} for your next 5 coins.`} Winners are announced live on ${esc(TV.drawDay || "the day")}.</p>
        ${nudges(["guess", "concert"], "Next:")}
        <div class="quiz__ctas">${outOfQuestions ? "" : `<button class="btn" type="button" id="quizAgain">Play ${ROUND} more <i class="ph-bold ph-play" aria-hidden="true"></i></button>`}</div></div>`;
      if (!outOfQuestions) $("#quizAgain").addEventListener("click", liveStart);
    }

    /* ---- practice (sample questions, nothing saved) ---- */
    let pqs = [], pi = 0, pscore = 0;
    function practiceStart() { (window.brfTrack || (() => {}))("quiz_practice"); pqs = TV.questions.slice().sort(() => Math.random() - 0.5).slice(0, PRACTICE_ROUND); pi = 0; pscore = 0; practiceShow(); }
    function practiceShow() {
      const q = pqs[pi]; answered = false;
      quiz.innerHTML = `<div class="quiz__card">
        <div class="quiz__top"><span><b class="quiz__mode">Practice</b> Question ${pi + 1} / ${PRACTICE_ROUND}</span><span>Score ${pscore}</span></div>
        <div class="quiz__time"><i id="quizBar"></i></div>
        <h3 class="quiz__q">${esc(q.q)}</h3>
        <div class="quiz__opts">${q.a.map((t, k) => `<button class="quiz__opt" type="button" data-k="${k}"><b>${"ABCD"[k]}</b><span>${esc(t)}</span></button>`).join("")}</div>
        <p class="quiz__say" id="quizSay"></p></div>`;
      $$(".quiz__opt", quiz).forEach((b) => b.addEventListener("click", () => practiceAnswer(+b.dataset.k)));
      $(".quiz__opt", quiz).focus({ preventScroll: true });
      bar(SECS, () => practiceAnswer(-1));
    }
    function practiceAnswer(k) {
      if (answered) return; answered = true; stop();
      const q = pqs[pi], right = k === q.ok;
      if (right) pscore++;
      $$(".quiz__opt", quiz).forEach((b, i) => { b.disabled = true; b.classList.toggle("is-ok", i === q.ok); b.classList.toggle("is-no", i === k && !right); });
      $("#quizSay").textContent = right ? "Correct!" : k === -1 ? "Time's up." : k === q.near ? "So close! Not quite." : "Not this time.";
      $("#quizSay").className = "quiz__say " + (right ? "is-ok" : k === q.near ? "is-near" : "is-no");
      setTimeout(() => (++pi < PRACTICE_ROUND ? practiceShow() : practiceDone()), right ? 1100 : 1700);
    }
    function practiceDone() {
      const has = !!token();
      quiz.innerHTML = `<div class="quiz__card quiz__card--end">
        <p class="quiz__big">${pscore}<small> / ${PRACTICE_ROUND}</small></p><h3>${pscore >= 4 ? "You're ready." : pscore >= 2 ? "Warming up nicely." : "Good warm-up."}</h3>
        <p class="quiz__best">That was practice, so no entries or coins. Play for entries when you're ready.</p>
        <div class="quiz__ctas"><button class="btn" type="button" id="quizReal">Play for entries <i class="ph-bold ph-play" aria-hidden="true"></i></button><button class="btn btn--ghost" type="button" id="quizAgain">Practice again <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i></button></div>${sampleNote}</div>`;
      $("#quizReal").addEventListener("click", has ? liveStart : needTicket);
      $("#quizAgain").addEventListener("click", practiceStart);
    }

    if (TV.champion2025) $("#champName").textContent = TV.champion2025;
    addEventListener("brf:claimed", qIdle);
    qIdle();
  }

  /* ===== phone menu: a full-screen sheet; closes on a link, the close button, Escape or a tap outside ===== */
  const menu = $("#menu"), menuBtn = $("#menuBtn");
  if (menu && menuBtn) {
    const closeMenu = () => { if (menu.open) menu.close(); };
    menuBtn.addEventListener("click", () => { menu.showModal(); menuBtn.setAttribute("aria-expanded", "true"); });
    menu.addEventListener("close", () => menuBtn.setAttribute("aria-expanded", "false"));
    $("#menuClose").addEventListener("click", closeMenu);
    menu.addEventListener("click", (e) => { if (e.target === menu || e.target.closest("a")) closeMenu(); });
  }

  /* ===== nav: on phones it slides away while scrolling down and comes back on any scroll up; on desktop it stays ===== */
  const nav = $(".nav"); let navY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY, dy = y - navY; if (Math.abs(dy) < 6) return; navY = y;
    nav.classList.toggle("is-hidden", innerWidth <= 760 && dy > 0 && y > 160 && !nav.contains(document.activeElement));
  }, { passive: true });

  /* one loop for everything that moves */
  const t0 = performance.now();
  function loop(now) {
    const t = (now - t0) / 1000;
    stackStep(now);
    journeyStep();
    globeStep();
    chartsStep();
    storyStep();
    decStep();
    coinStep();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  // review helper: ?at=<selector> jumps there with animations settled (for screenshots)
  const at = new URLSearchParams(location.search).get("at");
  if (at) setTimeout(() => {
    document.documentElement.style.scrollBehavior = "auto";
    $$(".reveal").forEach((r) => r.classList.add("is-in"));
    const el = $(at); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 72);
    stackStep(0);
  }, 300);
  if (CAPTURE) {
    document.documentElement.classList.add("is-capture");
    $$(".reveal").forEach((r) => r.classList.add("is-in"));
    charts.forEach((c) => c.set(1));
    for (let i = 0; i < 400; i++) stackStep(i / 60);
    const sc = document.createElement("script"); sc.src = "https://mcp.figma.com/mcp/html-to-design/capture.js"; sc.async = true; document.head.appendChild(sc);
  }
  window.__v3 = { settle: (n = 120) => { for (let i = 0; i < n; i++) stackStep(i / 60); } };
})();
