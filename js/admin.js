/* Free ticket admin: Supabase sign-in, sign-up list, search, check-in at the gate and CSV export.
   Only accounts listed in public.admins can read the list (enforced by the database, not this page). */
(() => {
  const root = document.getElementById("admin");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const sb = window.supabase.createClient(window.BRF_DB.url, window.BRF_DB.key);
  let all = [], me = null;
  const COLS = "id,created_at,pass_code,first_name,last_name,email,phone,has_bvndle_tag,bvndle_tag,source,checked_in_at,checked_in_by";
  const tabs = (on) => `<nav class="admin-tabs" aria-label="Admin sections">
      <button type="button" data-tab="tickets" class="${on === "tickets" ? "is-on" : ""}">Tickets</button>
      <button type="button" data-tab="coins" class="${on === "coins" ? "is-on" : ""}">Coins</button>
      <button type="button" data-tab="analytics" class="${on === "analytics" ? "is-on" : ""}">Analytics</button></nav>`;
  function bindTabs() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => (b.dataset.tab === "coins" ? renderCoins() : b.dataset.tab === "analytics" ? renderAnalytics() : renderDashboard())));
  }

  function renderLogin(msg) {
    root.innerHTML = `
      <form class="admin-login form" id="login" novalidate>
        <h1 class="display">Admin</h1>
        <p>Sign in to see free ticket sign-ups.</p>
        <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" placeholder="you@bvndle.com" required></div>
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn btn--pink btn--block" type="submit" id="loginBtn">Sign in <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></button>
        ${msg ? `<p class="proto-note" role="alert"><i class="ph-bold ph-warning" aria-hidden="true"></i><span>${esc(msg)}</span></p>` : ""}
      </form>`;
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("loginBtn"); btn.disabled = true; btn.textContent = "Signing in...";
      const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("email").value.trim(), password: document.getElementById("pw").value });
      if (error) return renderLogin(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      boot();
    });
  }

  function renderDenied() {
    root.innerHTML = `
      <div class="admin-login">
        <h1 class="display">No access</h1>
        <p>You're signed in as ${esc(me.email)}, but this account isn't a festival admin. Ask an existing admin to add you.</p>
        <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
      </div>`;
    document.getElementById("signOut").addEventListener("click", signOut);
  }

  async function signOut() { await sb.auth.signOut(); renderLogin(); }

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return renderLogin();
    me = session.user;
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (!isAdmin) return renderDenied();
    renderDashboard();
  }

  function renderDashboard() {
    root.innerHTML = `${tabs("tickets")}
      <div class="admin-head">
        <div><h1 class="display">Free ticket sign-ups</h1><p>Everyone who has claimed a free ticket. Signed in as ${esc(me.email)}.</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="exportBtn" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export CSV</button>
          <button class="btn btn--ghost" id="refreshBtn" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Total tickets</span><b id="t-total">0</b></div>
        <div class="atile"><span>Claimed today</span><b id="t-today">0</b></div>
        <div class="atile"><span>With a Bvndle tag</span><b id="t-tag">0</b></div>
        <div class="atile"><span>Checked in</span><b id="t-in">0</b></div>
      </div>
      <div class="admin-bar admin-bar--split">
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search sign-ups</span><input class="input" id="search" type="search" placeholder="Search name, email, phone, tag or ticket code"></label>
        <select class="input" id="filter" aria-label="Filter sign-ups">
          <option value="all">Everyone</option><option value="out">Not checked in</option><option value="in">Checked in</option><option value="tag">Has a Bvndle tag</option>
        </select>
      </div>
      <div class="table-wrap" id="tableWrap"><div class="empty"><p>Loading sign-ups...</p></div></div>`;
    document.getElementById("search").addEventListener("input", renderTable);
    document.getElementById("filter").addEventListener("change", renderTable);
    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    document.getElementById("refreshBtn").addEventListener("click", load);
    document.getElementById("signOut").addEventListener("click", signOut);
    document.getElementById("tableWrap").addEventListener("click", onTableClick);
    bindTabs();
    load();
  }

  async function load() {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("free_passes").select(COLS).order("created_at", { ascending: false }).range(from, from + page - 1);
      if (error) { document.getElementById("tableWrap").innerHTML = `<div class="empty"><p>Couldn't load sign-ups: ${esc(error.message)}</p></div>`; return; }
      out.push(...data);
      if (data.length < page) break;
    }
    all = out;
    renderTable();
  }

  function visible() {
    const q = document.getElementById("search").value.trim().toLowerCase(), f = document.getElementById("filter").value;
    return all.filter((p) => {
      if (f === "in" && !p.checked_in_at) return false;
      if (f === "out" && p.checked_in_at) return false;
      if (f === "tag" && !p.has_bvndle_tag) return false;
      return !q || [p.first_name, p.last_name, `${p.first_name} ${p.last_name}`, p.email, p.phone, p.bvndle_tag, p.pass_code].join(" ").toLowerCase().includes(q);
    });
  }

  function renderTable() {
    const today = new Date().toDateString();
    document.getElementById("t-total").textContent = all.length.toLocaleString("en-NG");
    document.getElementById("t-today").textContent = all.filter((p) => new Date(p.created_at).toDateString() === today).length.toLocaleString("en-NG");
    document.getElementById("t-tag").textContent = all.filter((p) => p.has_bvndle_tag).length.toLocaleString("en-NG");
    document.getElementById("t-in").textContent = all.filter((p) => p.checked_in_at).length.toLocaleString("en-NG");
    document.getElementById("exportBtn").disabled = all.length === 0;
    const wrap = document.getElementById("tableWrap");
    if (!all.length) {
      wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-coins" aria-hidden="true"></i><h2 class="display">No tickets yet</h2>
        <p>Sign-ups from the free ticket form appear here as soon as people submit it.</p>
        <a class="btn btn--pink btn--sm" href="index.html#ticket">Open the form</a></div>`;
      return;
    }
    const rows = visible();
    wrap.innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Bvndle tag</th><th>Ticket code</th><th>Claimed</th><th>At the gate</th></tr></thead><tbody>${
      rows.length ? rows.map((p) => `<tr>
        <td>${esc(p.first_name)} ${esc(p.last_name)}</td>
        <td>${esc(p.email)}</td>
        <td>${esc(window.formatNgPhone(p.phone))}</td>
        <td>${p.bvndle_tag ? "@" + esc(p.bvndle_tag) : '<span class="muted">None</span>'}</td>
        <td class="code">${esc(p.pass_code)}</td>
        <td class="muted">${fmt.format(new Date(p.created_at))}</td>
        <td>${p.checked_in_at
          ? `<span class="checkin is-in"><i class="ph-bold ph-check" aria-hidden="true"></i> ${fmt.format(new Date(p.checked_in_at))}</span> <button class="linkish" type="button" data-undo="${p.id}">Undo</button>`
          : `<button class="btn btn--sm btn--ghost" type="button" data-in="${p.id}">Check in</button>`}</td>
      </tr>`).join("")
      : `<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">No sign-ups match.</td></tr>`}</tbody></table>`;
  }

  async function onTableClick(e) {
    const b = e.target.closest("button[data-in], button[data-undo]");
    if (!b) return;
    const on = !!b.dataset.in, id = b.dataset.in || b.dataset.undo;
    b.disabled = true;
    const patch = on ? { checked_in_at: new Date().toISOString(), checked_in_by: me.id } : { checked_in_at: null, checked_in_by: null };
    const { data, error } = await sb.from("free_passes").update(patch).eq("id", id).select(COLS).single();
    if (error) { b.disabled = false; return alert("Couldn't update: " + error.message); }
    all = all.map((p) => (p.id === id ? data : p));
    renderTable();
  }

  function csvCell(v) {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) && !/^\+234\d+$/.test(s) ? "'" + s : s; // stop spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  function exportCsv() {
    const lines = [["First name", "Last name", "Email", "Phone", "Bvndle tag", "Ticket code", "Claimed at", "Checked in at", "Source"]]
      .concat(visible().map((p) => [p.first_name, p.last_name, p.email, p.phone, p.bvndle_tag, p.pass_code, p.created_at, p.checked_in_at, p.source]))
      .map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bvndle-free-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ===================== Coins: review and approve BvndleCoin awards ===================== */
  let awards = [], picked = new Set();
  const AW_COLS = "id,source,ref,coins,status,created_at,reviewed_at,note,pass:free_passes(first_name,last_name,email,phone,bvndle_tag,pass_code)";
  const label = (a) => a.source === "trivia" ? `1 Million Questions · ${a.ref.replace("correct-", "")} right` : `${a.source} · ${a.ref}`;

  function renderCoins() {
    picked = new Set();
    root.innerHTML = `${tabs("coins")}
      <div class="admin-head">
        <div><h1 class="display">BvndleCoins</h1><p>Coins earned on the site. Nothing is credited until it's approved here; then export the approved list for crediting in the Bvndle app.</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="coinExport" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export approved</button>
          <button class="btn btn--ghost" id="coinRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Coins waiting for approval</span><b id="c-pending">0</b></div>
        <div class="atile"><span>Coins approved</span><b id="c-approved">0</b></div>
        <div class="atile"><span>People earning coins</span><b id="c-people">0</b></div>
        <div class="atile"><span>Approved value (₦10 per coin)</span><b id="c-naira">₦0</b></div>
      </div>
      <div class="admin-bar admin-bar--split">
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search coins</span><input class="input" id="coinSearch" type="search" placeholder="Search name, email, phone, tag or ticket code"></label>
        <select class="input" id="coinFilter" aria-label="Filter by status">
          <option value="pending">Waiting for approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
        </select>
        <button class="btn btn--ghost" id="coinApprove" type="button" disabled><i class="ph-bold ph-check" aria-hidden="true"></i> Approve selected</button>
        <button class="btn btn--ghost" id="coinReject" type="button" disabled><i class="ph-bold ph-x" aria-hidden="true"></i> Reject selected</button>
      </div>
      <div class="table-wrap" id="coinWrap"><div class="empty"><p>Loading coins...</p></div></div>`;
    bindTabs();
    document.getElementById("signOut").addEventListener("click", signOut);
    document.getElementById("coinRefresh").addEventListener("click", loadCoins);
    document.getElementById("coinExport").addEventListener("click", exportCoins);
    document.getElementById("coinSearch").addEventListener("input", renderCoinTable);
    document.getElementById("coinFilter").addEventListener("change", () => { picked = new Set(); renderCoinTable(); });
    document.getElementById("coinApprove").addEventListener("click", () => review([...picked], "approved"));
    document.getElementById("coinReject").addEventListener("click", () => review([...picked], "rejected"));
    document.getElementById("coinWrap").addEventListener("click", onCoinClick);
    document.getElementById("coinWrap").addEventListener("change", onCoinPick);
    loadCoins();
  }

  async function loadCoins() {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("coin_awards").select(AW_COLS).order("created_at", { ascending: false }).range(from, from + page - 1);
      if (error) { document.getElementById("coinWrap").innerHTML = `<div class="empty"><p>Couldn't load coins: ${esc(error.message)}</p></div>`; return; }
      out.push(...data);
      if (data.length < page) break;
    }
    awards = out; picked = new Set();
    renderCoinTable();
  }

  function visibleCoins() {
    const q = document.getElementById("coinSearch").value.trim().toLowerCase(), f = document.getElementById("coinFilter").value;
    return awards.filter((a) => (f === "all" || a.status === f) &&
      (!q || [a.pass?.first_name, a.pass?.last_name, `${a.pass?.first_name} ${a.pass?.last_name}`, a.pass?.email, a.pass?.phone, a.pass?.bvndle_tag, a.pass?.pass_code].join(" ").toLowerCase().includes(q)));
  }

  function renderCoinTable() {
    const sum = (st) => awards.filter((a) => a.status === st).reduce((n, a) => n + a.coins, 0);
    document.getElementById("c-pending").textContent = sum("pending").toLocaleString("en-NG");
    document.getElementById("c-approved").textContent = sum("approved").toLocaleString("en-NG");
    document.getElementById("c-people").textContent = new Set(awards.filter((a) => a.status !== "rejected").map((a) => a.pass?.email)).size.toLocaleString("en-NG");
    document.getElementById("c-naira").textContent = "₦" + (sum("approved") * 10).toLocaleString("en-NG");
    document.getElementById("coinExport").disabled = !awards.some((a) => a.status === "approved");
    const rows = visibleCoins(), wrap = document.getElementById("coinWrap");
    if (!awards.length) { wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-coins" aria-hidden="true"></i><h2 class="display">No coins yet</h2><p>Coins appear here as people earn them on the site.</p></div>`; syncPicked(); return; }
    wrap.innerHTML = `<table><thead><tr><th><input type="checkbox" id="coinAll" aria-label="Select all shown"></th><th>Name</th><th>Email</th><th>Bvndle tag</th><th>Earned for</th><th>Coins</th><th>Earned</th><th>Status</th><th></th></tr></thead><tbody>${
      rows.length ? rows.map((a) => `<tr>
        <td><input type="checkbox" data-pick="${a.id}" ${picked.has(a.id) ? "checked" : ""} aria-label="Select"></td>
        <td>${esc(a.pass?.first_name)} ${esc(a.pass?.last_name)}</td>
        <td>${esc(a.pass?.email)}</td>
        <td>${a.pass?.bvndle_tag ? "@" + esc(a.pass.bvndle_tag) : '<span class="muted">None</span>'}</td>
        <td>${esc(label(a))}</td>
        <td class="code">${a.coins}</td>
        <td class="muted">${fmt.format(new Date(a.created_at))}</td>
        <td><span class="cstatus cstatus--${a.status}">${a.status === "pending" ? "Waiting" : a.status === "approved" ? "Approved" : "Rejected"}</span></td>
        <td>${a.status === "pending"
          ? `<button class="btn btn--sm btn--ghost" type="button" data-approve="${a.id}">Approve</button> <button class="linkish" type="button" data-reject="${a.id}">Reject</button>`
          : `<button class="linkish" type="button" data-undo="${a.id}">Undo</button>`}</td></tr>`).join("")
      : `<tr><td colspan="9" class="muted" style="text-align:center;padding:36px">Nothing here.</td></tr>`}</tbody></table>`;
    syncPicked();
  }

  function syncPicked() {
    const shown = new Set(visibleCoins().map((a) => a.id));
    picked = new Set([...picked].filter((id) => shown.has(id)));
    document.getElementById("coinApprove").disabled = document.getElementById("coinReject").disabled = picked.size === 0;
    const all = document.getElementById("coinAll");
    if (all) all.checked = shown.size > 0 && picked.size === shown.size;
  }
  function onCoinPick(e) {
    if (e.target.id === "coinAll") { picked = e.target.checked ? new Set(visibleCoins().map((a) => a.id)) : new Set(); renderCoinTable(); return; }
    const id = +e.target.dataset.pick; if (!id) return;
    e.target.checked ? picked.add(id) : picked.delete(id);
    syncPicked();
  }
  function onCoinClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.approve) review([+b.dataset.approve], "approved");
    if (b.dataset.reject) review([+b.dataset.reject], "rejected");
    if (b.dataset.undo) review([+b.dataset.undo], "pending");
  }
  async function review(ids, status) {
    if (!ids.length) return;
    if (ids.length > 1 && !confirm(`${status === "approved" ? "Approve" : "Reject"} ${ids.length} awards?`)) return;
    const { error } = await sb.rpc("admin_review_coins", { p_ids: ids, p_status: status });
    if (error) return alert("Couldn't update: " + error.message);
    const now = new Date().toISOString();
    awards = awards.map((a) => (ids.includes(a.id) ? { ...a, status, reviewed_at: status === "pending" ? null : now } : a));
    picked = new Set();
    renderCoinTable();
  }
  function exportCoins() {
    // one row per person: total approved coins, ready for crediting in the Bvndle app
    const by = new Map();
    awards.filter((a) => a.status === "approved").forEach((a) => {
      const k = a.pass?.email; const r = by.get(k) || { ...a.pass, coins: 0, awards: 0 };
      r.coins += a.coins; r.awards += 1; by.set(k, r);
    });
    const lines = [["First name", "Last name", "Email", "Phone", "Bvndle tag", "Ticket code", "Approved coins", "Naira value"]]
      .concat([...by.values()].map((r) => [r.first_name, r.last_name, r.email, r.phone, r.bvndle_tag, r.pass_code, r.coins, r.coins * 10]))
      .map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bvndle-approved-coins-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ===================== Analytics: visits, what people do, where they leave ===================== */
  const SECTIONS = [["hero", "Top of page"], ["journey", "Experience"], ["trivia", "1 Million Questions"], ["talks", "Main stage talks"], ["partners", "Partners"], ["numbers", "Last year in numbers"], ["concert", "Concert"], ["lineup", "Headliners"], ["vip", "Concert tickets"], ["voices", "Testimonials"], ["day", "Your day"], ["access", "Two tickets"], ["ticket", "Free ticket form"], ["why", "Why loyalty matters"], ["brands", "Become a partner"], ["faq", "FAQs"]];
  const SEC = Object.fromEntries(SECTIONS); SEC.top = "Top of page"; SEC.nav = "Menu"; SEC.footer = "Footer"; SEC["phone-bar"] = "Phone ticket bar";
  const ACTIONS = { ticket_claimed: "Claimed a free ticket", ticket_reopened: "Re-opened their ticket", ticket_error: "Ticket form error", quiz_play: "Started a trivia round (for entries)", quiz_practice: "Started a practice round", quiz_round_done: "Finished a trivia round", quiz_needs_ticket: "Tried to play without a ticket", headliner_guess: "Guessed a headliner" };
  const dur = (sec) => { sec = Math.round(sec || 0); if (sec < 60) return sec + "s"; const m = Math.floor(sec / 60), r = sec % 60; return m < 60 ? `${m}m ${String(r).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bars = (rows, max) => rows.map(([lab, n, sub]) => `<div class="abar"><span class="abar__lab">${esc(lab)}</span><span class="abar__track"><i style="width:${max ? Math.max(2, (n / max) * 100) : 0}%"></i></span><span class="abar__n">${esc(sub ?? n.toLocaleString("en-NG"))}</span></div>`).join("");

  function renderAnalytics() {
    root.innerHTML = `${tabs("analytics")}
      <div class="admin-head">
        <div><h1 class="display">Site analytics</h1><p>Anonymous visits to the festival site: where people come from, how far they get, what they do and where they leave. Times are Lagos time.</p></div>
        <div class="admin-actions">
          <select class="input" id="anRange" aria-label="Date range" style="width:auto"><option value="1">Today</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option><option value="3650">All time</option></select>
          <button class="btn btn--ghost" id="anRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div id="anBody"><div class="empty"><p>Loading analytics...</p></div></div>`;
    bindTabs();
    document.getElementById("signOut").addEventListener("click", signOut);
    document.getElementById("anRefresh").addEventListener("click", loadAnalytics);
    document.getElementById("anRange").addEventListener("change", loadAnalytics);
    loadAnalytics();
  }

  async function loadAnalytics() {
    const days = +document.getElementById("anRange").value;
    const from = new Date(); if (days === 1) from.setHours(0, 0, 0, 0); else from.setDate(from.getDate() - days);
    const { data: a, error } = await sb.rpc("admin_analytics", { p_from: from.toISOString(), p_to: new Date(Date.now() + 60000).toISOString() });
    const body = document.getElementById("anBody");
    if (error) { body.innerHTML = `<div class="empty"><p>Couldn't load analytics: ${esc(error.message)}</p></div>`; return; }
    if (!a.visits) { body.innerHTML = `<div class="empty"><i class="ph-duotone ph-chart-line" aria-hidden="true"></i><h2 class="display">No visits yet</h2><p>Visits show up here a few seconds after people open the site.</p></div>`; return; }
    const reach = Object.fromEntries(a.sections.map((x) => [x.section, x.n]));
    const exits = a.exits.reduce((m, x) => m + x.n, 0);
    const dayMax = Math.max(...a.by_day.map((d) => d.visits));
    const hours = Array.from({ length: 24 }, (_, h) => (a.by_hour.find((x) => x.hour === h) || { visits: 0 }).visits);
    const hourMax = Math.max(...hours);
    body.innerHTML = `
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Visits</span><b>${a.visits.toLocaleString("en-NG")}</b></div>
        <div class="atile"><span>Unique visitors</span><b>${a.visitors.toLocaleString("en-NG")}</b></div>
        <div class="atile"><span>Visits that claimed a ticket</span><b>${pct(a.claimed, a.visits)}%</b></div>
        <div class="atile"><span>Average active time</span><b>${dur(a.avg_active_s)}</b></div>
      </div>
      <div class="admin-tiles admin-tiles--4 an-small">
        <div class="atile"><span>Typical visit length</span><b>${dur(a.median_span_s)}</b></div>
        <div class="atile"><span>Average scroll depth</span><b>${a.avg_scroll}%</b></div>
        <div class="atile"><span>Left within 10 seconds</span><b>${pct(a.bounced, a.visits)}%</b></div>
        <div class="atile"><span>Came back more than once</span><b>${a.returning.toLocaleString("en-NG")}</b></div>
      </div>
      <div class="an-grid">
        <section class="an-card an-card--wide"><h2>Visits per day</h2>
          <div class="an-cols">${a.by_day.map((d) => `<div class="an-col" title="${esc(d.day)}: ${d.visits} visits, ${d.claims} tickets"><span class="an-col__n">${d.visits}</span><i style="height:${Math.max(3, (d.visits / dayMax) * 100)}%"></i><span class="an-col__lab">${esc(d.day.slice(5))}</span></div>`).join("")}</div></section>
        <section class="an-card"><h2>How far people get</h2><p class="muted">Share of visits that reached each part of the page</p>
          ${bars(SECTIONS.map(([id, lab]) => [lab, reach[id] || 0, pct(reach[id] || 0, a.visits) + "%"]), a.visits)}</section>
        <section class="an-card"><h2>Where people left</h2><p class="muted">The part of the page on screen when they closed or left</p>
          ${bars(a.exits.slice(0, 12).map((x) => [SEC[x.section] || x.section, x.n, pct(x.n, exits) + "%"]), Math.max(...a.exits.map((x) => x.n)))}</section>
        <section class="an-card"><h2>What people did</h2>
          ${a.actions.length ? bars(a.actions.map((x) => [ACTIONS[x.name] || x.name, x.people, `${x.people} ${x.people === 1 ? "visit" : "visits"}`]), Math.max(...a.actions.map((x) => x.people))) : '<p class="muted">No actions yet.</p>'}</section>
        <section class="an-card"><h2>Most clicked</h2>
          ${a.clicks.length ? bars(a.clicks.map((x) => [x.target, x.n]), a.clicks[0].n) : '<p class="muted">No clicks yet.</p>'}</section>
        <section class="an-card"><h2>Where visits come from</h2>
          ${bars(a.sources.map((x) => [x.source, x.n, `${x.n} · ${x.claims} tickets`]), a.sources[0]?.n || 0)}</section>
        <section class="an-card"><h2>Devices</h2>
          ${bars(a.devices.map((x) => [x.device, x.n, pct(x.n, a.visits) + "%"]), a.devices[0]?.n || 0)}</section>
        <section class="an-card an-card--wide"><h2>Busiest hours</h2>
          <div class="an-cols an-cols--hours">${hours.map((n, h) => `<div class="an-col" title="${h}:00 – ${n} visits"><span class="an-col__n">${n || ""}</span><i style="height:${hourMax ? Math.max(n ? 3 : 0, (n / hourMax) * 100) : 0}%"></i><span class="an-col__lab">${h}</span></div>`).join("")}</div></section>
      </div>
      <h2 class="an-h">Latest visits</h2>
      <div class="table-wrap"><table><thead><tr><th>Arrived</th><th>Left</th><th>From</th><th>Device</th><th>Active</th><th>Scrolled</th><th>Did</th><th>Left at</th><th>Ticket</th></tr></thead><tbody>${
        a.recent.map((r) => `<tr><td>${fmt.format(new Date(r.started_at))}</td><td class="muted">${fmt.format(new Date(r.left_at))}</td><td>${esc(r.source)}</td><td>${esc(r.device || "")}</td><td>${dur(r.active_seconds)}</td><td>${r.max_scroll}%</td>
          <td class="an-did">${esc((r.did || "").split(", ").map((x) => ACTIONS[x] || x).join(", ")) || '<span class="muted">Just looked</span>'}</td><td>${esc(SEC[r.exit_section] || r.exit_section || "")}</td><td>${r.claimed ? '<span class="cstatus cstatus--approved">Claimed</span>' : ""}</td></tr>`).join("")}</tbody></table></div>`;
  }

  boot();
})();
