/* Mini analytics for the BRF site, stored in our own Supabase (public.track). Anonymous: a random visitor id in
   this browser, a session per visit (30 minutes of inactivity starts a new one). No names, emails or phone numbers.
   Tracks: visits, which sections people reach, clicks on buttons and links, scroll depth, active time, key actions
   (window.brfTrack) and where they were when they left. Respects Do Not Track. */
(() => {
  const DB = window.BRF_DB;
  if (!DB || navigator.doNotTrack === "1" || window.doNotTrack === "1") { window.brfTrack = () => {}; return; }

  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  let visitor = ls("brf-vid"); if (!visitor) { visitor = uuid(); ls("brf-vid", visitor); }
  const now = Date.now(), lastAt = +ss("brf-sid-at") || 0;
  let session = ss("brf-sid");
  if (!session || now - lastAt > 30 * 60 * 1000) { session = uuid(); ss("brf-sid", session); ss("brf-seen", "[]"); }
  ss("brf-sid-at", String(now));

  const q = new URLSearchParams(location.search);
  const ua = navigator.userAgent;
  const meta = {
    path: location.pathname,
    ref: (() => { try { const h = document.referrer ? new URL(document.referrer).hostname : ""; return h === location.hostname ? "" : h; } catch (e) { return ""; } })(),
    utm_source: q.get("utm_source") || "", utm_medium: q.get("utm_medium") || "", utm_campaign: q.get("utm_campaign") || "",
    device: innerWidth < 768 ? "mobile" : innerWidth < 1100 ? "tablet" : "desktop",
    browser: /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Other",
    w: screen.width,
  };

  let queue = [], current = "", lastActive = Date.now();
  const push = (n, t, s, v) => { queue.push({ n, t: t || undefined, s: s || current || undefined, v }); if (queue.length >= 40) flush(); };
  window.brfTrack = (name, target, value) => push(String(name).toLowerCase().replace(/[^a-z_]/g, "_"), target, null, value);

  function flush(leaving) {
    if (!queue.length) return;
    const body = JSON.stringify({ p_session: session, p_visitor: visitor, p_meta: meta, p_events: queue.splice(0, 60) });
    try {
      fetch(`${DB.url}/rest/v1/rpc/track`, { method: "POST", keepalive: !!leaving, headers: { apikey: DB.key, "Content-Type": "application/json" }, body }).catch(() => {});
    } catch (e) {}
    ss("brf-sid-at", String(Date.now()));
  }

  push("page_view", location.hash || null);

  // sections reached (each counted once per visit) and the one on screen now
  const seen = new Set(JSON.parse(ss("brf-seen") || "[]"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      current = en.target.id;
      if (!seen.has(current)) { seen.add(current); ss("brf-seen", JSON.stringify([...seen])); push("section", null, current); }
      else push("section", null, current);   // keeps "last section" fresh for where-they-left
    });
  }, { threshold: 0.35 });
  document.querySelectorAll("main section[id], #top > section[id]").forEach((el) => io.observe(el));

  // scroll depth milestones
  let maxPct = 0;
  addEventListener("scroll", () => {
    lastActive = Date.now();
    const h = document.documentElement, pct = Math.min(100, Math.round(((scrollY + innerHeight) / h.scrollHeight) * 100));
    for (const m of [25, 50, 75, 100]) if (pct >= m && maxPct < m) { maxPct = m; push("scroll", null, null, m); }
  }, { passive: true });

  // clicks on buttons and links (label only, never form contents)
  document.addEventListener("click", (e) => {
    lastActive = Date.now();
    const el = e.target.closest("a, button, [role=button], summary");
    if (!el || el.closest("[data-no-track]")) return;
    const label = (el.dataset.track || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!label || el.matches(".quiz__opt")) return;
    const where = el.closest("section[id]")?.id || (el.closest(".nav, header") ? "nav" : el.closest("footer") ? "footer" : el.closest(".mobile-cta") ? "phone-bar" : current);
    push("click", label, where);
  }, true);
  ["keydown", "pointermove", "touchstart"].forEach((t) => addEventListener(t, () => (lastActive = Date.now()), { passive: true }));

  // active time: 15 s ticks while the tab is visible and someone moved in the last minute
  setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActive < 60000) push("heartbeat", null, null, 15);
  }, 15000);
  setInterval(() => flush(), 10000);

  // leaving: record where they were, send what's left
  let left = false;
  const leave = () => { if (left) return; left = true; push("leave", null, current || "top"); flush(true); };
  addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { push("hidden", null, current); flush(true); }
    else { left = false; ss("brf-sid-at", String(Date.now())); }
  });
  setTimeout(() => flush(), 1500);
})();
