/* Bvndle digital passport for admin-run events (passport.html).
   ?e=<passport key>  the passport QR: get a passport (name, email, phone, optional Bvndle tag), then see it.
   ?a=<activity key>  an activity QR: quiz, word puzzle or staff code. Coins land on the passport.
   The passport token lives in this browser (localStorage, one per event). Everything is checked on the server
   (Supabase functions in supabase/migrations/20261028000000_event_passport_activities.sql). */
(() => {
  const { url, key } = window.BRF_DB;
  const app = document.getElementById("app"), evName = document.getElementById("evName");
  const q = new URLSearchParams(location.search), EKEY = q.get("e"), AKEY = q.get("a");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const n = (x) => Number(x || 0).toLocaleString("en-NG");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tokKey = (pk) => "brf-pp-" + pk;
  const getTok = (pk) => { try { return localStorage.getItem(tokKey(pk)); } catch (e) { return null; } };
  const setTok = (pk, t) => { try { localStorage.setItem(tokKey(pk), t); } catch (e) {} };
  const dropTok = (pk) => { try { localStorage.removeItem(tokKey(pk)); } catch (e) {} };

  async function rpc(name, body) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: data && data.code === "P0001" ? data.message : "network" };
      return { ok: true, data };
    } catch (e) { return { ok: false, error: "network" }; }
  }
  const MSG = {
    network: "We couldn't reach the server. Check your connection and try again.",
    unknown_event: "This passport QR code isn't active.", unknown_activity: "This activity QR code isn't active.",
    missing_name: "Add your full name.", invalid_email: "Add a valid email address.", invalid_phone: "Add a valid phone number.",
    event_not_live: "This activity opens when the event is live. Check back soon.", activity_closed: "This activity is closed.",
    already_done: "You've already done this one.", already_paid: "Your coins have already been paid out, so this can't add more.",
    too_many_tries: "Too many wrong codes. Ask the booth staff for help.", no_passport: "Get your passport first.",
  };
  const fail = (msg) => { app.innerHTML = `<div class="card center"><i class="ph-bold ph-warning-circle" style="font-size:40px;color:#ff9a7d" aria-hidden="true"></i><p>${esc(msg)}</p></div>`; };
  // each event brings its own logo (uploaded in admin); with none, the header shows just the event name
  const evLogo = document.getElementById("evLogo");
  const setEvent = (ev) => {
    if (!ev) return;
    evName.innerHTML = `<b>${esc(ev.name)}</b>${esc(ev.location || "")}`;
    if (ev.logo && /^data:image\/(png|jpeg|webp);base64,/.test(ev.logo)) { evLogo.src = ev.logo; evLogo.alt = ev.name || ""; evLogo.hidden = false; }
    else evLogo.hidden = true;
    document.querySelector(".top").classList.toggle("top--nologo", evLogo.hidden);
  };

  /* ---------- passport form ---------- */
  function passportForm(pk, ev, after) {
    app.innerHTML = `
      <h1>Get your passport.</h1>
      <p class="lede">Your Bvndle digital passport for ${esc(ev.name)}. Scan the activity QR codes around the venue to earn coins, then collect them at the reward desk.</p>
      <form class="card" id="ppForm" novalidate>
        <div class="field"><label for="ppName">Full name</label><input class="input" id="ppName" autocomplete="name" maxlength="120" required></div>
        <div class="field"><label for="ppEmail">Email</label><input class="input" id="ppEmail" type="email" autocomplete="email" inputmode="email" maxlength="160" required></div>
        <div class="field"><label for="ppPhone">Phone number</label><input class="input" id="ppPhone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="080..." required></div>
        <div class="field"><label for="ppTag">Bvndle tag <small>(optional, needed to get paid)</small></label><div class="affix"><span>@</span><input class="input" id="ppTag" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40"></div></div>
        <p class="err" id="ppErr" role="alert"></p>
        <button class="btn" type="submit" id="ppGo">Issue my passport <i class="ph-bold ph-identification-card" aria-hidden="true"></i></button>
        <p class="fine">No Bvndle tag yet? You can add it at the reward desk when you collect your coins.</p>
      </form>`;
    const f = document.getElementById("ppForm"), err = document.getElementById("ppErr"), go = document.getElementById("ppGo");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = f.ppName.value.trim(), email = f.ppEmail.value.trim(), phoneRaw = f.ppPhone.value.trim();
      if (name.length < 2) return (err.textContent = MSG.missing_name);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return (err.textContent = MSG.invalid_email);
      const phone = window.normalizeNgPhone(phoneRaw) || phoneRaw;
      if (phone.replace(/\D/g, "").length < 10) return (err.textContent = MSG.invalid_phone);
      go.disabled = true; err.textContent = "";
      const r = await rpc("passport_issue", { p_key: pk, p_name: name, p_email: email, p_phone: phone, p_tag: f.ppTag.value.trim() || null });
      go.disabled = false;
      if (!r.ok) return (err.textContent = MSG[r.error] || MSG.network);
      setTok(pk, r.data.token);
      after(r.data);
    });
    document.getElementById("ppName").focus({ preventScroll: true });
  }

  /* ---------- the passport ---------- */
  function passportHTML(p, opts = {}) {
    const ev = p.event || {}, acts = p.activities || [], done = acts.filter((a) => a.done).length;
    const status = p.status === "paid" ? `<b>Paid.</b> Your coins have been sent to @${esc(p.tag || "your Bvndle account")}.`
      : p.status === "approved" ? `<b>Approved.</b> Your coins are on their way${p.tag ? ` to @${esc(p.tag)}` : ""}.`
      : !p.coins ? "Scan the activity QR codes around the venue to start earning."
      : p.tag ? `Collect your coins at the reward desk before you leave. They'll be sent to <b>@${esc(p.tag)}</b>.`
      : `Collect your coins at the reward desk before you leave. <b>You'll need a Bvndle tag</b> to get paid: download the Bvndle app and create one.`;
    return `
      ${opts.welcome ? `<h1>${opts.existing ? "Welcome back." : "You're a Bvndle citizen!"}</h1><p class="lede">${opts.existing ? "Here's your passport." : "Your passport is ready. Keep this page open, or come back to it from any activity QR code."}</p>` : ""}
      <article class="pp" aria-label="Your Bvndle passport">
        <span class="pp__glow" aria-hidden="true"></span>
        <div class="pp__row"><span>Bvndle passport</span><span>No. ${esc(p.number)}</span></div>
        <p class="pp__cit">Bvndle citizen</p>
        <p class="pp__name">${esc(p.name)}</p>
        <div class="pp__meta"><span>${esc(ev.name || "")}</span>${p.tag ? `<span>@${esc(p.tag)}</span>` : ""}</div>
        <div class="pp__coins"><b>${n(p.coins)}</b><span>Bvndle coins earned</span></div>
      </article>
      <p class="status">${status}</p>
      ${acts.length ? `<p class="h3">Activities &middot; ${done} of ${acts.length} done</p>
      <ul class="stamps">${acts.map((a) => `<li class="${a.done ? (a.earned ? "is-done" : "is-miss") : ""}"><i class="ph-${a.done ? "fill" : "bold"} ${a.done ? (a.earned ? "ph-seal-check" : "ph-x-circle") : "ph-qr-code"}" aria-hidden="true"></i>
        <span>${esc(a.title)}<br><small>${a.done ? (a.earned ? "Done" : "Not this time") : "Find its QR code"}</small></span><span class="c">${a.done ? `+${n(a.earned)}` : `${n(a.coins)} coins`}</span></li>`).join("")}</ul>` : ""}
      ${ev.live === false ? `<p class="fine">Activities open when the event goes live.</p>` : ""}`;
  }
  async function showPassport(pk, ev, data) {
    if (data) { app.innerHTML = passportHTML(data.passport, { welcome: true, existing: data.existing }); if (!data.existing) confetti(); return; }
    const tok = getTok(pk);
    if (!tok) return passportForm(pk, ev, (d) => showPassport(pk, ev, d));
    const r = await rpc("passport_me", { p_token: tok });
    if (!r.ok) { if (r.error === "invalid_token") { dropTok(pk); return passportForm(pk, ev, (d) => showPassport(pk, ev, d)); } return fail(MSG[r.error] || MSG.network); }
    app.innerHTML = passportHTML(r.data);
  }

  /* ---------- activities ---------- */
  async function openActivity() {
    const first = await rpc("activity_open", { p_key: AKEY, p_token: null });
    if (!first.ok) return fail(MSG[first.error] || MSG.network);
    const pk = first.data.event.passport_key; setEvent(first.data.event);
    const tok = getTok(pk);
    if (!tok) return passportForm(pk, first.data.event, () => openActivity());
    const r = await rpc("activity_open", { p_key: AKEY, p_token: tok });
    if (!r.ok) return fail(MSG[r.error] || MSG.network);
    const x = r.data;
    if (!x.has_passport) { dropTok(pk); return passportForm(pk, x.event, () => openActivity()); }
    const back = `<a class="btn btn--ghost" href="passport.html?e=${encodeURIComponent(pk)}" style="margin-top:14px">View my passport <i class="ph-bold ph-identification-card" aria-hidden="true"></i></a>`;
    const head = `<span class="act__coins"><i class="ph-fill ph-coins" aria-hidden="true"></i> ${n(x.coins)} coins</span><h2>${esc(x.title)}</h2>${x.prompt ? `<p class="lede">${esc(x.prompt)}</p>` : ""}`;
    if (x.done) return (app.innerHTML = `<div class="card">${head}<div class="result">${x.earned ? `<i class="ph-bold ph-seal-check" style="color:var(--green)" aria-hidden="true"></i><p>You earned <b>${n(x.earned)} coins</b> here.</p>` : `<i class="ph-bold ph-x-circle" style="color:#ff9a7d" aria-hidden="true"></i><p>You've already had your go at this one.</p>`}</div>${back}</div>`);
    if (!x.event.live) return (app.innerHTML = `<div class="card">${head}<p class="status">${MSG.event_not_live}</p>${back}</div>`);
    if (!x.active) return (app.innerHTML = `<div class="card">${head}<p class="status">${MSG.activity_closed}</p>${back}</div>`);

    const submit = async (answer) => {
      const s = await rpc("activity_submit", { p_key: AKEY, p_token: tok, p_answer: String(answer) });
      if (!s.ok) { const e = document.getElementById("actErr"); if (e) e.textContent = MSG[s.error] || MSG.network; return null; }
      return s.data;
    };
    const win = (res) => {
      app.innerHTML = `<div class="card"><div class="result"><p class="big">+${n(res.earned)}</p><h2>Coins earned!</h2>
        <p class="lede">${esc(x.title)} done. You now have <b>${n(res.passport.coins)} coins</b> on your passport.</p></div>${back}</div>`;
      confetti();
    };

    if (x.kind === "quiz") {
      app.innerHTML = `<div class="card">${head}<p class="fine" style="text-align:left;margin:0">One go only. Choose carefully.</p><div class="opts" id="opts">${x.options.map((o, i) => `<button class="opt" type="button" data-i="${i}">${esc(o)}</button>`).join("")}</div><p class="err" id="actErr"></p>${back}</div>`;
      document.getElementById("opts").addEventListener("click", async (e) => {
        const b = e.target.closest(".opt"); if (!b) return;
        document.querySelectorAll(".opt").forEach((o) => (o.disabled = true));
        const res = await submit(b.dataset.i);
        if (!res) return document.querySelectorAll(".opt").forEach((o) => (o.disabled = false));
        if (res.correct) return win(res);
        b.classList.add("is-wrong");
        app.querySelector(".card").insertAdjacentHTML("afterbegin", `<p class="status" style="margin:0 0 14px">Not this time. Keep scanning: there are more activities around the venue.</p>`);
      });
    } else if (x.kind === "puzzle") {
      const letters = x.letters || []; let picked = [];
      app.innerHTML = `<div class="card">${head}<div class="slots" id="slots"></div><div class="tiles" id="tiles">${letters.map((l, i) => `<button class="tile" type="button" data-i="${i}">${esc(l)}</button>`).join("")}</div>
        <div class="row2"><button class="btn btn--ghost" type="button" id="undo">Undo</button><button class="btn btn--ghost" type="button" id="clear">Clear</button></div><p class="err" id="actErr"></p>${back}</div>`;
      const slots = document.getElementById("slots"), tiles = document.getElementById("tiles");
      const draw = () => {
        slots.innerHTML = letters.map((_, k) => `<span class="slot${picked[k] != null ? " is-fill" : ""}">${picked[k] != null ? esc(letters[picked[k]]) : ""}</span>`).join("");
        tiles.querySelectorAll(".tile").forEach((t) => (t.disabled = picked.includes(+t.dataset.i)));
      };
      draw();
      tiles.addEventListener("click", async (e) => {
        const t = e.target.closest(".tile"); if (!t || t.disabled) return;
        picked.push(+t.dataset.i); draw();
        if (picked.length === letters.length) {
          const res = await submit(picked.map((k) => letters[k]).join(""));
          if (res && res.correct) return win(res);
          if (res) document.getElementById("actErr").textContent = "Not quite. Try again.";
          setTimeout(() => { picked = []; draw(); }, 600);
        }
      });
      document.getElementById("undo").addEventListener("click", () => { picked.pop(); draw(); });
      document.getElementById("clear").addEventListener("click", () => { picked = []; draw(); document.getElementById("actErr").textContent = ""; });
    } else {
      app.innerHTML = `<div class="card">${head}<p class="status" style="margin-top:0"><i class="ph-bold ph-hand-tap" aria-hidden="true"></i> Done the activity? Hand your phone to the booth staff to confirm.</p>
        <form id="pinForm" novalidate><div class="field" style="margin-top:16px"><label for="pin">Staff code</label><input class="input pin" id="pin" inputmode="numeric" autocomplete="one-time-code" maxlength="12"></div>
        <p class="err" id="actErr"></p><button class="btn" type="submit">Confirm <i class="ph-bold ph-check" aria-hidden="true"></i></button></form>${back}</div>`;
      document.getElementById("pinForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = document.getElementById("pin").value.trim(); if (!v) return;
        const res = await submit(v);
        if (res && res.correct) return win(res);
        if (res) { document.getElementById("actErr").textContent = "That code isn't right."; document.getElementById("pin").value = ""; }
      });
    }
  }

  /* ---------- confetti (no library) ---------- */
  function confetti() {
    if (reduce) return;
    const c = document.getElementById("fx"), ctx = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const cols = ["#FF3E8E", "#FFD23F", "#8B80F9", "#69E392", "#F3F0EB", "#2e4bff"];
    const bits = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: cols[(Math.random() * cols.length) | 0] }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach((b) => { b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); });
      if (t - t0 < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  /* ---------- start ---------- */
  (async () => {
    if (AKEY) return openActivity();
    if (!EKEY) return fail("Scan a passport or activity QR code to get started.");
    const r = await rpc("passport_event", { p_key: EKEY });
    if (!r.ok) return fail(MSG.network);
    if (!r.data) return fail(MSG.unknown_event);
    setEvent(r.data);
    showPassport(EKEY, r.data);
  })();
})();
