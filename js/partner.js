/* Partner claim page: rewardfest.bvndle.com/p/<slug>
   One link per partner and ticket type. A customer fills in their details (or a partner app opens it with them
   pre-filled: ?first=&last=&email=&phone=&tag=) and gets the next ticket from the partner's allocation straight away.
   /p/<slug>?stats=<key> shows the partner their numbers (no customer details). */
(() => {
  const { url, key } = window.BRF_DB;
  const app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const slug = ((location.pathname.match(/^\/p\/([^/?#]+)/) || [])[1] || q.get("l") || "").toLowerCase();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  async function rpc(name, body) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: data && data.code === "P0001" ? data.message : "network" };
      return { ok: true, data };
    } catch (e) { return { ok: false, error: "network" }; }
  }

  const MSG = {
    network: "We couldn't reach the ticket desk. Check your connection and try again.",
    missing_name: "Add your first and last name.",
    invalid_email: "That email doesn't look right. Check it and try again.",
    invalid_phone: "Enter a valid Nigerian number, like 0803 123 4567.",
    details_mismatch: "This email or phone number already has a ticket from this link, with different details. Use the same email and phone number you used before.",
    already_has_pass: "This email or phone number already has a Day Pass with different details. Use the same email and phone number as your Day Pass.",
    link_paused: "This link is paused for now. Check back with the partner who sent it.",
    link_expired: "This link has expired.",
    link_full: "All the tickets on this link have been claimed.",
    claims_closed: "Day Pass claims are closed for now. If you already claimed one, use the same email and phone to see it.",
  };
  const CLOSED = {
    paused: ["Paused for now", "The partner has paused this link. Check back with them."],
    expired: ["This link has expired", "The tickets on this link are no longer available."],
    full: ["All claimed", "Every ticket on this link has been claimed."],
    dayclosed: ["Day Pass claims are closed", "Free Day Pass claims have closed for now. The new festival date is coming soon."],
  };
  const isDay = (t) => t === "Day Pass";
  const isVip = (t) => /vip|premium|table|executive/i.test(t || "");
  const isFest = (t) => /day pass/i.test(t || "");   // Day Pass and Executive Day Pass are for the festival days
  const kind = (t) => String(t || "").replace(/^Concert\s*·\s*/, "");
  const when = (t) => (isFest(t) ? "Festival days" : "Concert night, 9pm") + " &middot; date coming soon";   // 12 Nov: date being moved
  const what = (t) => isFest(t) ? "Bvndle Rewards Festival" : "Bvndle Rewards Concert";

  function qrSvg(text) {
    if (typeof window.qrcode !== "function") return "";
    const qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  // tells a partner app hosting this page in a webview that the ticket is ready
  function notifyHost(r) {
    const msg = { type: "brf_ticket_claimed", code: r.code, ticket_type: r.ticket_type, pass_code: r.pass_code || null, existing: !!r.existing };
    try { window.parent !== window && window.parent.postMessage(msg, "*"); } catch (e) {}
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    try { window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.brf && window.webkit.messageHandlers.brf.postMessage(msg); } catch (e) {}
    try { window.BRFAndroid && window.BRFAndroid.ticketClaimed(JSON.stringify(msg)); } catch (e) {}
  }

  function head(info) {
    const pct = info.cap ? Math.round((info.claimed / info.cap) * 100) : 0;
    return `<div class="from">From ${esc(info.partner)}</div>
      <h1>Your ticket is waiting</h1>
      <p class="lede">${esc(info.partner)} has a <b style="color:var(--fg)">${esc(kind(info.ticket_type))}</b> ticket to the ${what(info.ticket_type)} for you. Add your details and it's yours straight away.</p>
      <p style="margin:0 0 14px"><span class="type${isVip(info.ticket_type) ? " type--vip" : ""}">${esc(kind(info.ticket_type))}</span></p>
      ${info.status === "open" && info.remaining <= Math.max(10, info.cap * 0.2) ? `<div class="left"><span>${info.remaining} left</span><span class="bar"><i style="width:${pct}%"></i></span></div>` : ""}`;
  }

  function closed(info) {
    const [t, d] = CLOSED[info.status];
    app.innerHTML = `<div class="from">From ${esc(info.partner)}</div><h1>${t}</h1><p class="lede">${d}</p>
      <a class="btn" href="/">Visit the festival site</a>
      <button class="linkish" type="button" id="haveOne">Already claimed from this link? Get your ticket again</button>`;
    document.getElementById("haveOne").onclick = () => form(info, true);
  }

  const pre = {
    first: (q.get("first") || (q.get("name") || "").split(" ")[0] || "").trim(),
    last: (q.get("last") || (q.get("name") || "").split(" ").slice(1).join(" ") || "").trim(),
    email: (q.get("email") || "").trim(), phone: (q.get("phone") || "").trim(), tag: (q.get("tag") || "").replace(/^@/, "").trim(),
  };
  const valid = (v) => v.first && v.last && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) && window.normalizeNgPhone(v.phone);

  // pre-filled by the partner's app: one tap
  function quick(info) {
    app.innerHTML = head(info) + `<div class="card">
      <div class="who"><b>${esc(pre.first)} ${esc(pre.last)}</b><span>${esc(pre.email)}</span><span>${esc(window.formatNgPhone(window.normalizeNgPhone(pre.phone)))}</span></div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn" id="go" type="button">Claim my ticket</button>
      <button class="linkish" type="button" id="edit">Not you, or details wrong? Edit</button>
      <p class="fine">We'll email your ticket to ${esc(pre.email)}. By claiming you agree to the <a href="/event-terms.html" target="_blank" rel="noopener">event terms</a>.</p></div>`;
    document.getElementById("edit").onclick = () => form(info);
    document.getElementById("go").onclick = (e) => submit(info, pre, e.currentTarget, document.getElementById("err"));
  }

  function form(info, again) {
    app.innerHTML = (again ? `<div class="from">From ${esc(info.partner)}</div><h1>Get your ticket again</h1><p class="lede">Use the same email and phone number you claimed with.</p>` : head(info)) + `
      <form class="card" id="f" novalidate>
        <div class="row2">
          <div class="field"><label for="first">First name</label><input class="input" id="first" name="first" autocomplete="given-name" required value="${esc(pre.first)}"></div>
          <div class="field"><label for="last">Last name</label><input class="input" id="last" name="last" autocomplete="family-name" required value="${esc(pre.last)}"></div>
        </div>
        <div class="field"><label for="email">Email <small>(we send your ticket here)</small></label><input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(pre.email)}"></div>
        <div class="field"><label for="phone">Phone number</label><input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" required value="${esc(pre.phone)}"></div>
        ${again ? "" : `<div class="field"><label for="tag">Bvndle tag <small>(optional)</small></label><div class="affix"><span>@</span><input class="input" id="tag" name="tag" autocomplete="off" autocapitalize="off" value="${esc(pre.tag)}"></div></div>`}
        <p class="err" id="err" role="alert"></p>
        <button class="btn" type="submit">${again ? "Show my ticket" : "Claim my ticket"}</button>
        <p class="fine">By claiming you agree to the <a href="/event-terms.html" target="_blank" rel="noopener">event terms</a>.</p>
      </form>`;
    const f = document.getElementById("f"), err = document.getElementById("err");
    if (!pre.first) f.first.focus();
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = { first: f.first.value.trim(), last: f.last.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), tag: f.tag ? f.tag.value.replace(/^@/, "").trim() : "" };
      if (!v.first || !v.last) { err.textContent = MSG.missing_name; return (v.first ? f.last : f.first).focus(); }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { err.textContent = MSG.invalid_email; return f.email.focus(); }
      if (!window.normalizeNgPhone(v.phone)) { err.textContent = MSG.invalid_phone; return f.phone.focus(); }
      submit(info, v, f.querySelector('button[type="submit"]'), err);
    };
  }

  async function submit(info, v, btn, err) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Getting your ticket..."; err.textContent = "";
    const { ok, data, error } = await rpc("claim_partner_link", { p_slug: slug, p_first_name: v.first, p_last_name: v.last, p_email: v.email, p_phone: window.normalizeNgPhone(v.phone), p_tag: v.tag || null });
    if (!ok) { btn.disabled = false; btn.textContent = label; err.textContent = MSG[error] || MSG.network; return; }
    const r = Object.assign({}, data, { email: v.email.toLowerCase() });
    ls.set("brf-p-" + slug, JSON.stringify(r));
    if (r.pass_code && !ls.get("brf-my-pass")) {
      ls.set("brf-my-pass", JSON.stringify({ code: r.pass_code, name: `${v.first} ${v.last}`, first: v.first, last: v.last, email: v.email, phone: window.normalizeNgPhone(v.phone), tag: v.tag || "", token: r.token }));
    }
    notifyHost(r);
    ticket(r, true);
  }

  function ticket(r, fresh) {
    const day = isDay(r.ticket_type), gate = day ? r.pass_code : r.code;
    app.innerHTML = `<h1 style="margin-bottom:8px">${!fresh ? "Your ticket" : r.existing ? "Here's your ticket again" : "You're in!"}</h1>
      <p class="lede">${r.already_had_pass ? "You already had a Day Pass, so you're all set. The partner's ticket stays free for someone else." : day ? "Your Day Pass is confirmed. We've emailed it to you too." : `Your ticket is confirmed. We've emailed it${r.email ? " to " + esc(r.email) : ""} too.`}</p>
      <article class="tk${isVip(r.ticket_type) ? " tk--vip" : ""}" aria-label="Ticket">
        <div class="tk__top">
          <div class="tk__row"><span>${what(r.ticket_type)}</span><span>Admits 1</span></div>
          <div class="tk__kind">${esc(kind(r.ticket_type))}</div>
          <p class="tk__name">${esc(r.name)}</p>
          <div class="tk__meta">${when(r.ticket_type)}<br>Landmark Event Centre, Lagos${r.partner ? `<br>Courtesy of ${esc(r.partner)}` : ""}</div>
        </div>
        <div class="tk__cut"></div>
        <div class="tk__bot">
          <div><div class="tk__lab">${day ? "Day Pass code" : "Ticket ID"}</div><div class="tk__code">${esc(gate)}</div></div>
          <div class="tk__qr">${qrSvg(gate)}</div>
        </div>
      </article>
      <div class="note"><b>At the gate:</b> show this screen, the email, or a screenshot. ${day ? "Your Day Pass works on both days." : isFest(r.ticket_type) ? "It admits one person." : "This ticket works once, for one person."}</div>
      ${day ? `<a class="btn" style="margin-top:20px" href="/">Explore the festival and earn coins</a>` : `<a class="btn btn--ghost" href="/">See what's on at the festival</a>`}`;
    if (fresh && !r.existing) confetti();
  }

  function confetti() {
    const c = document.getElementById("fx"); if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = c.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; x.scale(dpr, dpr);
    const cols = ["#FF3E8E", "#FFD23F", "#69E392", "#5b4bd6", "#F3F0EB"];
    const ps = Array.from({ length: 110 }, () => ({ x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
    let t = 0;
    (function frame() {
      x.clearRect(0, 0, W, H);
      ps.forEach((p) => { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += 0.1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (++t < 140) requestAnimationFrame(frame); else x.clearRect(0, 0, W, H);
    })();
  }

  async function stats(k) {
    const { ok, data, error } = await rpc("partner_link_stats", { p_slug: slug, p_key: k });
    if (!ok) { app.innerHTML = `<h1>Can't show these numbers</h1><p class="lede">${error === "not_allowed" ? "This stats link isn't right. Ask the Bvndle team for the link again." : MSG.network}</p>`; return; }
    const d = data, max = Math.max(1, ...d.by_day.map((x) => x.n));
    const share = `${location.origin}/p/${slug}`;
    app.innerHTML = `<div class="from">${esc(d.partner)} &middot; partner view</div><h1>${esc(kind(d.ticket_type))} link</h1>
      <p class="lede">${d.active ? "Live" : "Paused"}${d.expires_at ? ` &middot; closes ${new Date(d.expires_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Updates every time you open this page.</p>
      <div class="stats"><div class="stat"><span>Claimed</span><b>${d.claimed}</b></div><div class="stat"><span>Left</span><b>${Math.max(d.cap - d.claimed, 0)}</b></div><div class="stat"><span>At the gate</span><b>${d.checked_in}</b></div></div>
      <div class="left"><span>${d.claimed} of ${d.cap}</span><span class="bar"><i style="width:${Math.round((d.claimed / d.cap) * 100)}%"></i></span></div>
      ${d.by_day.length ? `<div class="card"><h2 style="font-size:22px;margin-bottom:12px">Claims by day</h2><ul class="days">${d.by_day.map((x) => `<li><span>${new Date(x.day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span><span class="bar"><i style="width:${Math.round((x.n / max) * 100)}%"></i></span><b>${x.n}</b></li>`).join("")}</ul></div>` : ""}
      <div class="card" style="margin-top:14px"><div class="tk__lab" style="color:var(--dim)">Your link to share</div><p style="margin:6px 0 12px;word-break:break-all;font-weight:700">${esc(share)}</p>
        <button class="btn" id="cp" type="button">Copy link</button>
        <p class="fine" style="text-align:left">In your app you can pre-fill the customer's details so it's one tap:<br><code style="word-break:break-all;color:var(--fg)">${esc(share)}?first=Ada&amp;last=Obi&amp;email=ada@example.com&amp;phone=08031234567</code></p></div>`;
    document.getElementById("cp").onclick = (e) => { navigator.clipboard && navigator.clipboard.writeText(share).then(() => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy link"), 1600); }); };
  }

  async function start() {
    if (!slug) { app.innerHTML = `<h1>Link not found</h1><p class="lede">Check the link the partner sent you.</p><a class="btn" href="/">Visit the festival site</a>`; return; }
    if (q.get("stats")) return stats(q.get("stats"));
    const { ok, data, error } = await rpc("partner_link_info", { p_slug: slug });
    if (!ok) {
      app.innerHTML = error === "unknown_link"
        ? `<h1>Link not found</h1><p class="lede">We can't find this ticket link. Check the link the partner sent you.</p><a class="btn" href="/">Visit the festival site</a>`
        : `<h1>Can't load your ticket</h1><p class="lede">${MSG.network}</p><button class="btn" onclick="location.reload()">Try again</button>`;
      return;
    }
    document.title = `Your ${kind(data.ticket_type)} ticket from ${data.partner} · Bvndle Rewards Festival`;
    // already claimed on this phone: show it (unless the partner's app is opening it for someone else)
    let saved = null; try { saved = JSON.parse(ls.get("brf-p-" + slug) || "null"); } catch (e) {}
    if (saved && (saved.code || saved.pass_code) && (!pre.email || pre.email.toLowerCase() === saved.email)) {
      ticket(saved, false);
      app.insertAdjacentHTML("beforeend", `<button class="linkish" type="button" id="other">Claim one for someone else</button>`);
      document.getElementById("other").onclick = () => (data.status === "open" ? form(data) : closed(data));
      return;
    }
    if (data.status !== "open") return closed(data);
    // 12 Nov: free Day Pass claims are closed everywhere (the database refuses them); only re-showing an existing one works
    if (isDay(data.ticket_type)) { const f = await rpc("brf_flag", { p_key: "day_pass_claims" }); if (f.ok && f.data === false) return closed(Object.assign({}, data, { status: "dayclosed" })); }
    valid(pre) ? quick(data) : form(data);
  }
  start();
})();
