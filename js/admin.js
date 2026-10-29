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
      <button type="button" data-tab="coins" class="${on === "coins" ? "is-on" : ""}">Rewards</button>
      <button type="button" data-tab="partners" class="${on === "partners" ? "is-on" : ""}">Partners</button>
      <button type="button" data-tab="events" class="${on === "events" ? "is-on" : ""}">Events</button>
      <button type="button" data-tab="ptickets" class="${on === "ptickets" ? "is-on" : ""}">Partner tickets</button>
      <button type="button" data-tab="analytics" class="${on === "analytics" ? "is-on" : ""}">Analytics</button></nav>`;
  function bindTabs() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => (b.dataset.tab === "coins" ? renderCoins() : b.dataset.tab === "partners" ? renderPartners() : b.dataset.tab === "events" ? renderEvents() : b.dataset.tab === "ptickets" ? renderPartnerTickets() : b.dataset.tab === "analytics" ? renderAnalytics() : renderDashboard())));
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
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search sign-ups</span><input class="input" id="search" type="search" placeholder="Search name, email, phone, tag or pass code"></label>
        <select class="input" id="filter" aria-label="Filter sign-ups">
          <option value="all">Everyone</option><option value="out">Not checked in</option><option value="in">Checked in</option><option value="tag">Has a Bvndle tag</option><option value="rewards">Has rewards</option>
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
    await loadPassRewards();
    renderTable();
  }
  // coins per ticket, shown beside each person so the gate team sees them at check-in
  let passRewards = new Map();
  async function loadPassRewards() {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("coin_awards").select("id,pass_id,source,coins,status").neq("status", "rejected").range(from, from + page - 1);
      if (error) return;
      out.push(...data);
      if (data.length < page) break;
    }
    passRewards = new Map();
    out.forEach((a) => { const r = passRewards.get(a.pass_id) || []; r.push(a); passRewards.set(a.pass_id, r); });
  }
  const rewardCell = (p) => {
    const list = passRewards.get(p.id) || [];
    if (!list.length) return '<span class="muted">None</span>';
    const sum = (st) => list.filter((a) => a.status === st).reduce((n, a) => n + a.coins, 0);
    const total = list.reduce((n, a) => n + a.coins, 0), w = sum("pending"), ap = sum("approved"), c = sum("collected");
    return `<span class="rwd"><b>${total}</b> coins</span>${w ? `<span class="cstatus cstatus--pending">${w} waiting</span>` : ""}${ap ? `<span class="cstatus cstatus--approved">${ap} approved</span>` : ""}${c ? `<span class="cstatus cstatus--collected">${c} collected</span>` : ""}`;
  };

  function visible() {
    const q = document.getElementById("search").value.trim().toLowerCase(), f = document.getElementById("filter").value;
    return all.filter((p) => {
      if (f === "in" && !p.checked_in_at) return false;
      if (f === "out" && p.checked_in_at) return false;
      if (f === "tag" && !p.has_bvndle_tag) return false;
      if (f === "rewards" && !(passRewards.get(p.id) || []).length) return false;
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
    wrap.innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Bvndle tag</th><th>Ticket code</th><th>Rewards</th><th>Claimed</th><th>At the gate</th></tr></thead><tbody>${
      rows.length ? rows.map((p) => `<tr>
        <td>${esc(p.first_name)} ${esc(p.last_name)}</td>
        <td>${esc(p.email)}</td>
        <td>${esc(window.formatNgPhone(p.phone))}</td>
        <td>${p.bvndle_tag ? "@" + esc(p.bvndle_tag) : '<span class="muted">None</span>'}</td>
        <td class="code">${esc(p.pass_code)}</td>
        <td class="rwdcell">${rewardCell(p)}</td>
        <td class="muted">${fmt.format(new Date(p.created_at))}</td>
        <td>${p.checked_in_at
          ? `<span class="checkin is-in"><i class="ph-bold ph-check" aria-hidden="true"></i> ${fmt.format(new Date(p.checked_in_at))}</span> <button class="linkish" type="button" data-undo="${p.id}">Undo</button>`
          : `<button class="btn btn--sm btn--ghost" type="button" data-in="${p.id}">Check in</button>`}</td>
      </tr>`).join("")
      : `<tr><td colspan="8" class="muted" style="text-align:center;padding:36px">No sign-ups match.</td></tr>`}</tbody></table>`;
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
    // checking someone in approves the coins they earned on the site (ready to hand over at the reward desk)
    if (on) {
      const pend = (passRewards.get(id) || []).filter((a) => a.status === "pending");
      if (pend.length) {
        const r = await sb.rpc("admin_review_coins", { p_ids: pend.map((a) => a.id), p_status: "approved" });
        if (r.error) alert("Checked in, but their coins couldn't be approved: " + r.error.message + ". Approve them in the Rewards tab.");
        else { pend.forEach((a) => (a.status = "approved")); awards = awards.map((a) => (pend.some((x) => x.id === a.id) ? { ...a, status: "approved" } : a)); }
      }
    }
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

  /* ===================== Rewards: every BvndleCoin earned on the site, per person and per award =====================
     One award per person per activity (trivia: first 10 right answers = 5; Wealth zone walk = 2). Coins are handed
     over at the festival reward desk: approve them here, then mark them collected at the desk (search the pass code). */
  let awards = [], picked = new Set(), view = "people";
  const AW_COLS = "id,source,ref,coins,status,created_at,reviewed_at,collected_at,note,pass:free_passes(id,first_name,last_name,email,phone,bvndle_tag,pass_code)";
  const ACT = { trivia: "1 Million Questions", wealth_zone: "Wealth zone walk" };
  const label = (a) => ACT[a.source] || a.source;
  const STATUS = { pending: "Waiting", approved: "Approved", rejected: "Rejected", collected: "Collected" };
  const NAIRA = 10;   // ₦ per coin

  function renderCoins() {
    picked = new Set();
    root.innerHTML = `${tabs("coins")}
      <div class="admin-head">
        <div><h1 class="display">Rewards</h1><p>Every BvndleCoin earned on the site. Each activity pays once per person. Approve coins here, then mark them collected at the festival reward desk (search the pass code).</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="coinExcel" type="button"><i class="ph-bold ph-microsoft-excel-logo" aria-hidden="true"></i> Approved rewards (Excel)</button>
          <button class="btn btn--ghost" id="coinExport" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export per person</button>
          <button class="btn btn--ghost" id="coinExportAll" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export all awards</button>
          <button class="btn btn--ghost" id="coinRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Coins earned</span><b id="c-earned">0</b><small id="c-naira"></small></div>
        <div class="atile"><span>Waiting for approval</span><b id="c-pending">0</b></div>
        <div class="atile"><span>Approved, to hand out</span><b id="c-approved">0</b></div>
        <div class="atile"><span>Collected at the festival</span><b id="c-collected">0</b><small id="c-people"></small></div>
      </div>
      <div class="admin-bar admin-bar--split">
        <div class="admin-tabs admin-tabs--sub" role="tablist"><button type="button" data-view="people" class="${view === "people" ? "is-on" : ""}">By person</button><button type="button" data-view="awards" class="${view === "awards" ? "is-on" : ""}">All awards</button></div>
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search rewards</span><input class="input" id="coinSearch" type="search" placeholder="Search name, email, phone, tag or pass code"></label>
        <select class="input" id="coinFilter" aria-label="Filter by status">
          <option value="all">All statuses</option><option value="pending">Waiting for approval</option><option value="approved">Approved, not collected</option><option value="collected">Collected</option><option value="rejected">Rejected</option>
        </select>
        <button class="btn btn--ghost" id="coinApprove" type="button" disabled><i class="ph-bold ph-check" aria-hidden="true"></i> Approve selected</button>
        <button class="btn btn--ghost" id="coinCollect" type="button" disabled><i class="ph-bold ph-hand-coins" aria-hidden="true"></i> Mark collected</button>
        <button class="btn btn--ghost" id="coinReject" type="button" disabled><i class="ph-bold ph-x" aria-hidden="true"></i> Reject selected</button>
      </div>
      <div class="table-wrap" id="coinWrap"><div class="empty"><p>Loading rewards...</p></div></div>`;
    bindTabs();
    const $id = (i) => document.getElementById(i);
    $id("signOut").addEventListener("click", signOut);
    $id("coinRefresh").addEventListener("click", loadCoins);
    $id("coinExport").addEventListener("click", exportPeople);
    $id("coinExportAll").addEventListener("click", exportAwards);
    $id("coinExcel").addEventListener("click", exportApprovedExcel);
    $id("coinSearch").addEventListener("input", renderCoinTable);
    $id("coinFilter").addEventListener("change", () => { picked = new Set(); renderCoinTable(); });
    $id("coinApprove").addEventListener("click", () => review(pickedAwards("pending"), "approved"));
    $id("coinCollect").addEventListener("click", () => review(pickedAwards("approved"), "collected"));
    $id("coinReject").addEventListener("click", () => review(pickedAwards("pending", "approved"), "rejected"));
    $id("coinWrap").addEventListener("click", onCoinClick);
    $id("coinWrap").addEventListener("change", onCoinPick);
    root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; renderCoins(); renderCoinTable(); }));
    if (!awards.length) loadCoins();
  }

  async function loadCoins() {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("coin_awards").select(AW_COLS).order("created_at", { ascending: false }).range(from, from + page - 1);
      if (error) { document.getElementById("coinWrap").innerHTML = `<div class="empty"><p>Couldn't load rewards: ${esc(error.message)}</p></div>`; return; }
      out.push(...data);
      if (data.length < page) break;
    }
    awards = out.map((a) => (a.status === "paid" ? { ...a, status: "collected" } : a)); picked = new Set();
    renderCoinTable();
  }

  const matches = (p, q) => !q || [p?.first_name, p?.last_name, `${p?.first_name} ${p?.last_name}`, p?.email, p?.phone, p?.bvndle_tag, p?.pass_code].join(" ").toLowerCase().includes(q);
  function visibleCoins() {
    const q = document.getElementById("coinSearch").value.trim().toLowerCase(), f = document.getElementById("coinFilter").value;
    return awards.filter((a) => (f === "all" || a.status === f) && matches(a.pass, q));
  }
  // one row per ticket holder: coins per activity and by status
  function people(list) {
    const by = new Map();
    list.forEach((a) => {
      const k = a.pass?.id || a.pass?.email;
      const r = by.get(k) || { pass: a.pass, ids: [], acts: {}, earned: 0, pending: 0, approved: 0, collected: 0, rejected: 0, last: a.created_at };
      r.ids.push(a.id); r[a.status] += a.coins;
      if (a.status !== "rejected") { r.earned += a.coins; r.acts[a.source] = (r.acts[a.source] || 0) + a.coins; }
      if (a.created_at > r.last) r.last = a.created_at;
      by.set(k, r);
    });
    return [...by.values()].sort((x, y) => y.earned - x.earned || (y.last > x.last ? 1 : -1));
  }

  function renderCoinTable() {
    const sum = (st) => awards.filter((a) => a.status === st).reduce((n, a) => n + a.coins, 0);
    const n = (x) => Number(x || 0).toLocaleString("en-NG");
    const earned = awards.filter((a) => a.status !== "rejected").reduce((t, a) => t + a.coins, 0);
    const set = (i, v) => { const el = document.getElementById(i); if (el) el.textContent = v; };
    set("c-earned", n(earned)); set("c-naira", `₦${n(earned * NAIRA)} at ₦${NAIRA} per coin`);
    set("c-pending", n(sum("pending"))); set("c-approved", n(sum("approved"))); set("c-collected", n(sum("collected")));
    set("c-people", `${n(new Set(awards.filter((a) => a.status !== "rejected").map((a) => a.pass?.email)).size)} people earning`);
    document.getElementById("coinExport").disabled = document.getElementById("coinExportAll").disabled = !awards.length;
    document.getElementById("coinExcel").disabled = !awards.some((a) => a.status === "approved");
    const wrap = document.getElementById("coinWrap");
    if (!awards.length) { wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-coins" aria-hidden="true"></i><h2 class="display">No rewards yet</h2><p>Coins appear here as people earn them on the site: 1 Million Questions and the Wealth zone walk.</p></div>`; syncPicked(); return; }
    const acts = Object.keys(ACT);
    if (view === "people") {
      const rows = people(visibleCoins());
      wrap.innerHTML = `<table><thead><tr><th><input type="checkbox" id="coinAll" aria-label="Select all shown"></th><th>Name</th><th>Ticket code</th><th>Email</th><th>Phone</th><th>Bvndle tag</th>${acts.map((k) => `<th>${esc(ACT[k])}</th>`).join("")}<th>Total</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>${
        rows.length ? rows.map((r) => {
          const state = r.pending ? `<span class="cstatus cstatus--pending">${n(r.pending)} waiting</span>` : r.approved ? `<span class="cstatus cstatus--approved">${n(r.approved)} to collect</span>` : r.collected ? `<span class="cstatus cstatus--collected">Collected</span>` : `<span class="cstatus cstatus--rejected">Rejected</span>`;
          const ids = r.ids.join(",");
          return `<tr>
          <td><input type="checkbox" data-pickmany="${ids}" ${r.ids.every((i) => picked.has(i)) ? "checked" : ""} aria-label="Select"></td>
          <td>${esc(r.pass?.first_name)} ${esc(r.pass?.last_name)}</td>
          <td class="code">${esc(r.pass?.pass_code)}</td>
          <td>${esc(r.pass?.email)}</td>
          <td class="muted">${esc(r.pass?.phone)}</td>
          <td>${r.pass?.bvndle_tag ? "@" + esc(r.pass.bvndle_tag) : '<span class="muted">None</span>'}</td>
          ${acts.map((k) => `<td class="code">${r.acts[k] ? n(r.acts[k]) : '<span class="muted">–</span>'}</td>`).join("")}
          <td class="code"><b>${n(r.earned)}</b></td>
          <td class="muted">₦${n(r.earned * NAIRA)}</td>
          <td>${state}</td>
          <td>${r.pending ? `<button class="btn btn--sm btn--ghost" type="button" data-approvemany="${ids}">Approve</button>` : ""}${r.approved ? ` <button class="btn btn--sm btn--ghost" type="button" data-collectmany="${ids}">Mark collected</button>` : ""}</td></tr>`;
        }).join("")
        : `<tr><td colspan="${9 + acts.length}" class="muted" style="text-align:center;padding:36px">Nothing here.</td></tr>`}</tbody></table>`;
    } else {
      const rows = visibleCoins();
      wrap.innerHTML = `<table><thead><tr><th><input type="checkbox" id="coinAll" aria-label="Select all shown"></th><th>Name</th><th>Ticket code</th><th>Email</th><th>Earned for</th><th>Coins</th><th>Earned</th><th>Status</th><th></th></tr></thead><tbody>${
        rows.length ? rows.map((a) => `<tr>
          <td><input type="checkbox" data-pick="${a.id}" ${picked.has(a.id) ? "checked" : ""} aria-label="Select"></td>
          <td>${esc(a.pass?.first_name)} ${esc(a.pass?.last_name)}</td>
          <td class="code">${esc(a.pass?.pass_code)}</td>
          <td>${esc(a.pass?.email)}</td>
          <td>${esc(label(a))}</td>
          <td class="code">${a.coins}</td>
          <td class="muted">${fmt.format(new Date(a.created_at))}</td>
          <td><span class="cstatus cstatus--${a.status}">${STATUS[a.status] || a.status}</span></td>
          <td>${a.status === "pending"
            ? `<button class="btn btn--sm btn--ghost" type="button" data-approve="${a.id}">Approve</button> <button class="linkish" type="button" data-reject="${a.id}">Reject</button>`
            : a.status === "approved" ? `<button class="btn btn--sm btn--ghost" type="button" data-collect="${a.id}">Mark collected</button> <button class="linkish" type="button" data-undo="${a.id}">Undo</button>`
            : `<button class="linkish" type="button" data-undo="${a.id}">Undo</button>`}</td></tr>`).join("")
        : `<tr><td colspan="9" class="muted" style="text-align:center;padding:36px">Nothing here.</td></tr>`}</tbody></table>`;
    }
    syncPicked();
  }

  const pickedAwards = (...st) => awards.filter((a) => picked.has(a.id) && st.includes(a.status)).map((a) => a.id);
  function syncPicked() {
    const shown = new Set(visibleCoins().map((a) => a.id));
    picked = new Set([...picked].filter((id) => shown.has(id)));
    const d = (id, st) => { const el = document.getElementById(id); if (el) el.disabled = !pickedAwards(...st).length; };
    d("coinApprove", ["pending"]); d("coinCollect", ["approved"]); d("coinReject", ["pending", "approved"]);
    const all = document.getElementById("coinAll");
    if (all) all.checked = shown.size > 0 && picked.size === shown.size;
  }
  function onCoinPick(e) {
    if (e.target.id === "coinAll") { picked = e.target.checked ? new Set(visibleCoins().map((a) => a.id)) : new Set(); renderCoinTable(); return; }
    const ids = e.target.dataset.pickmany ? e.target.dataset.pickmany.split(",").map(Number) : e.target.dataset.pick ? [+e.target.dataset.pick] : [];
    if (!ids.length) return;
    ids.forEach((id) => (e.target.checked ? picked.add(id) : picked.delete(id)));
    syncPicked();
  }
  function onCoinClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const many = (s) => s.split(",").map(Number);
    if (b.dataset.approve) review([+b.dataset.approve], "approved");
    if (b.dataset.reject) review([+b.dataset.reject], "rejected");
    if (b.dataset.collect) review([+b.dataset.collect], "collected");
    if (b.dataset.undo) review([+b.dataset.undo], "pending");
    if (b.dataset.approvemany) review(awards.filter((a) => many(b.dataset.approvemany).includes(a.id) && a.status === "pending").map((a) => a.id), "approved", true);
    if (b.dataset.collectmany) review(awards.filter((a) => many(b.dataset.collectmany).includes(a.id) && a.status === "approved").map((a) => a.id), "collected", true);
  }
  async function review(ids, status, quiet) {
    if (!ids.length) return;
    const verb = { approved: "Approve", rejected: "Reject", collected: "Mark as collected", pending: "Undo" }[status];
    if (!quiet && ids.length > 1 && !confirm(`${verb}: ${ids.length} awards?`)) return;
    const { error } = await sb.rpc("admin_review_coins", { p_ids: ids, p_status: status });
    if (error) return alert("Couldn't update: " + error.message);
    const now = new Date().toISOString();
    awards = awards.map((a) => (ids.includes(a.id) ? { ...a, status, reviewed_at: status === "pending" ? null : now, collected_at: status === "collected" ? now : null } : a));
    picked = new Set();
    renderCoinTable();
  }
  function download(name, rows) {
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportPeople() {
    // one row per person, everything they've earned (rejected awards left out), for the reward desk
    const acts = Object.keys(ACT);
    download("brf-rewards-per-person", [["First name", "Last name", "Ticket code", "Email", "Phone", "Bvndle tag", ...acts.map((k) => ACT[k] + " coins"), "Total coins", "Naira value", "Waiting approval", "Approved, to collect", "Collected"]]
      .concat(people(awards).filter((r) => r.earned).map((r) => [r.pass?.first_name, r.pass?.last_name, r.pass?.pass_code, r.pass?.email, r.pass?.phone, r.pass?.bvndle_tag,
        ...acts.map((k) => r.acts[k] || 0), r.earned, r.earned * NAIRA, r.pending, r.approved, r.collected])));
  }
  // Excel of approved coins still to hand over: sheet 1 one row per person, sheet 2 every approved award
  let xlsxLib = null;
  async function exportApprovedExcel() {
    const btn = document.getElementById("coinExcel"); btn.disabled = true;
    try {
      if (!xlsxLib) await new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
      xlsxLib = window.XLSX;
      const approved = awards.filter((a) => a.status === "approved"), acts = Object.keys(ACT);
      const per = people(approved).map((r) => ({ "First name": r.pass?.first_name, "Last name": r.pass?.last_name, "Ticket code": r.pass?.pass_code, Email: r.pass?.email, Phone: r.pass?.phone, "Bvndle tag": r.pass?.bvndle_tag || "",
        ...Object.fromEntries(acts.map((k) => [ACT[k] + " coins", r.acts[k] || 0])), "Approved coins": r.approved, "Naira value": r.approved * NAIRA }));
      const rows = approved.map((a) => ({ "First name": a.pass?.first_name, "Last name": a.pass?.last_name, "Ticket code": a.pass?.pass_code, Email: a.pass?.email, "Earned for": label(a), Coins: a.coins, "Naira value": a.coins * NAIRA, "Earned at": a.created_at ? new Date(a.created_at) : "", "Approved at": a.reviewed_at ? new Date(a.reviewed_at) : "" }));
      const wb = xlsxLib.utils.book_new();
      const s1 = xlsxLib.utils.json_to_sheet(per), s2 = xlsxLib.utils.json_to_sheet(rows, { cellDates: true });
      s1["!cols"] = Object.keys(per[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
      s2["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
      xlsxLib.utils.book_append_sheet(wb, s1, "Per person");
      xlsxLib.utils.book_append_sheet(wb, s2, "All approved awards");
      xlsxLib.writeFile(wb, `brf-approved-rewards-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { alert("Couldn't build the Excel file. Check your connection and try again."); }
    btn.disabled = false;
  }
  function exportAwards() {
    download("brf-rewards-all-awards", [["First name", "Last name", "Ticket code", "Email", "Phone", "Bvndle tag", "Earned for", "Coins", "Naira value", "Status", "Earned at", "Approved at", "Collected at"]]
      .concat(awards.map((a) => [a.pass?.first_name, a.pass?.last_name, a.pass?.pass_code, a.pass?.email, a.pass?.phone, a.pass?.bvndle_tag, label(a), a.coins, a.coins * NAIRA, STATUS[a.status] || a.status, a.created_at, a.reviewed_at || "", a.collected_at || ""])));
  }

  /* ===================== Partners: Become a Partner enquiries from the site ===================== */
  let enquiries = [];
  const P_STATUS = { new: "New", contacted: "Contacted", in_talks: "In talks", confirmed: "Confirmed", declined: "Declined" };
  const P_COLS = "id,created_at,organisation,industry,contact_name,contact_role,email,phone,website,partnership_types,partnership_other,objectives,objectives_other,budget,contribution,source,status,admin_note,updated_at";

  function renderPartners() {
    root.innerHTML = `${tabs("partners")}
      <div class="admin-head">
        <div><h1 class="display">Partners</h1><p>Become a Partner enquiries from the site. Each new one is also emailed to temitope@bvndle.com and rewardsfestival@bvndle.com.</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="pExport" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export CSV</button>
          <button class="btn btn--ghost" id="pRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Enquiries</span><b id="p-total">0</b></div>
        <div class="atile"><span>New, not yet contacted</span><b id="p-new">0</b></div>
        <div class="atile"><span>In talks</span><b id="p-talks">0</b></div>
        <div class="atile"><span>Confirmed partners</span><b id="p-conf">0</b></div>
      </div>
      <div class="admin-bar admin-bar--split">
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search enquiries</span><input class="input" id="pSearch" type="search" placeholder="Search organisation, name, email or industry"></label>
        <select class="input" id="pFilter" aria-label="Filter by status"><option value="all">All statuses</option>${Object.entries(P_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      </div>
      <div class="table-wrap" id="pWrap"><div class="empty"><p>Loading enquiries...</p></div></div>`;
    bindTabs();
    document.getElementById("signOut").addEventListener("click", signOut);
    document.getElementById("pRefresh").addEventListener("click", loadPartners);
    document.getElementById("pExport").addEventListener("click", exportPartners);
    document.getElementById("pSearch").addEventListener("input", renderPartnerTable);
    document.getElementById("pFilter").addEventListener("change", renderPartnerTable);
    document.getElementById("pWrap").addEventListener("change", onPartnerChange);
    document.getElementById("pWrap").addEventListener("click", (e) => { const b = e.target.closest("[data-pmore]"); if (b) { const row = document.getElementById("pm-" + b.dataset.pmore); row.hidden = !row.hidden; b.textContent = row.hidden ? "Details" : "Hide"; } });
    loadPartners();
  }
  async function loadPartners() {
    const { data, error } = await sb.from("partner_enquiries").select(P_COLS).order("created_at", { ascending: false }).limit(2000);
    if (error) { document.getElementById("pWrap").innerHTML = `<div class="empty"><p>Couldn't load enquiries: ${esc(error.message)}</p></div>`; return; }
    enquiries = data; renderPartnerTable();
  }
  const pTypes = (r) => (r.partnership_types || []).map((t) => (t === "Other" && r.partnership_other ? `Other: ${r.partnership_other}` : t));
  const pObjs = (r) => (r.objectives || []).map((t) => (t === "Other" && r.objectives_other ? `Other: ${r.objectives_other}` : t));
  function renderPartnerTable() {
    const n = (st) => enquiries.filter((r) => r.status === st).length;
    document.getElementById("p-total").textContent = enquiries.length;
    document.getElementById("p-new").textContent = n("new");
    document.getElementById("p-talks").textContent = n("in_talks") + n("contacted");
    document.getElementById("p-conf").textContent = n("confirmed");
    document.getElementById("pExport").disabled = !enquiries.length;
    const q = document.getElementById("pSearch").value.trim().toLowerCase(), f = document.getElementById("pFilter").value;
    const rows = enquiries.filter((r) => (f === "all" || r.status === f) && (!q || [r.organisation, r.contact_name, r.email, r.industry].join(" ").toLowerCase().includes(q)));
    const wrap = document.getElementById("pWrap");
    if (!enquiries.length) { wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-handshake" aria-hidden="true"></i><h2 class="display">No enquiries yet</h2><p>They appear here when brands send the Become a Partner form.</p></div>`; return; }
    wrap.innerHTML = `<table><thead><tr><th>Organisation</th><th>Contact</th><th>Interested in</th><th>Budget</th><th>Received</th><th>Status</th><th></th></tr></thead><tbody>${
      rows.length ? rows.map((r) => `<tr>
        <td><b>${esc(r.organisation)}</b><br><span class="muted">${esc(r.industry)}</span></td>
        <td>${esc(r.contact_name)}${r.contact_role ? `<br><span class="muted">${esc(r.contact_role)}</span>` : ""}<br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone ? `<br><span class="muted">${esc(r.phone)}</span>` : ""}</td>
        <td>${esc(pTypes(r).join(", "))}</td>
        <td>${r.budget ? esc(r.budget) : '<span class="muted">Not given</span>'}</td>
        <td class="muted">${fmt.format(new Date(r.created_at))}</td>
        <td><select class="input input--sm" data-pstatus="${r.id}" aria-label="Status">${Object.entries(P_STATUS).map(([k, v]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><button class="linkish" type="button" data-pmore="${r.id}">Details</button></td></tr>
        <tr id="pm-${r.id}" hidden class="pmore"><td colspan="7"><dl class="pdl">
          <div><dt>Objectives</dt><dd>${esc(pObjs(r).join(", ")) || "–"}</dd></div>
          <div><dt>What they'd bring</dt><dd>${esc(r.contribution || "–")}</dd></div>
          <div><dt>Website</dt><dd>${r.website ? esc(r.website) : "–"}</dd></div>
          <div><dt>Came from</dt><dd>${esc(r.source || "–")}</dd></div>
          <div><dt>Team note</dt><dd><textarea class="input pnote" data-pnote="${r.id}" rows="2" placeholder="Add a note for the team">${esc(r.admin_note || "")}</textarea></dd></div>
        </dl></td></tr>`).join("")
      : `<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">Nothing here.</td></tr>`}</tbody></table>`;
  }
  async function onPartnerChange(e) {
    const id = e.target.dataset.pstatus || e.target.dataset.pnote; if (!id) return;
    const patch = e.target.dataset.pstatus ? { status: e.target.value } : { admin_note: e.target.value.trim() || null };
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from("partner_enquiries").update(patch).eq("id", id);
    if (error) return alert("Couldn't save: " + error.message);
    enquiries = enquiries.map((r) => (r.id === id ? { ...r, ...patch } : r));
    if (patch.status) renderPartnerTable();
  }
  function exportPartners() {
    const rows = [["Received", "Organisation", "Industry", "Contact name", "Role", "Email", "Phone", "Website", "Partnership type", "Objectives", "Investment range", "What they'd bring", "Came from", "Status", "Team note"]]
      .concat(enquiries.map((r) => [r.created_at, r.organisation, r.industry, r.contact_name, r.contact_role, r.email, r.phone, r.website, pTypes(r).join("; "), pObjs(r).join("; "), r.budget, r.contribution, r.source, P_STATUS[r.status] || r.status, r.admin_note]));
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `brf-partner-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ===================== Events: attendance, check-in and booklet rewards at events we run =====================
     Create an event, register attendees (name, email, phone; Bvndle tag now or later), check them in, then key in the
     total coins stamped in their booklet. Approve, export the approved sheet (Excel) for the Bvndle reward upload and
     mark it paid. Rules live in the database (brf_event_attendees trigger): changing an amount needs approval again,
     paid rewards are locked. */
  let evList = [], evCur = null, evPeople = [];
  // explicit columns: the passport token is not readable by admins (column grants in the database)
  const ATT_COLS = "id,event_id,full_name,email,phone,bvndle_tag,checked_in_at,reward_coins,reward_status,reward_updated_at,reward_approved_at,reward_approved_by,reward_paid_at,note,created_at,source";
  const EV_STATUS = { none: "No reward", pending: "To approve", approved: "Approved", paid: "Paid" };
  const evErr = (e) => ({ reward_already_paid: "This reward has already been paid, so it can't be changed.", approve_first: "Approve the reward before marking it paid.", nothing_to_approve: "Enter a reward amount first." }[e?.message] || e?.message || "Something went wrong.");

  async function renderEvents() {
    evCur = null;
    root.innerHTML = `${tabs("events")}
      <div class="admin-head">
        <div><h1 class="display">Events</h1><p>Run attendance at an event: register and check people in, then key in the coins stamped in their booklet, approve and export for payout.</p></div>
        <div class="admin-actions"><button class="btn btn--ghost" id="signOut" type="button">Sign out</button></div>
      </div>
      <form class="evnew" id="evNew" novalidate>
        <h2>New event</h2>
        <div class="evnew__row">
          <label class="field"><span>Event name</span><input class="input" name="name" required maxlength="120" placeholder="e.g. Lagos Fintech Week"></label>
          <label class="field"><span>Location</span><input class="input" name="location" maxlength="160" placeholder="Venue, city"></label>
          <label class="field"><span>Date</span><input class="input" name="event_date" type="date"></label>
          <button class="btn btn--pink" type="submit"><i class="ph-bold ph-plus" aria-hidden="true"></i> Create event</button>
        </div>
        <p class="evmsg" id="evNewMsg" role="status"></p>
      </form>
      <div id="evListWrap"><div class="empty"><p>Loading events...</p></div></div>`;
    bindTabs();
    document.getElementById("signOut").addEventListener("click", signOut);
    document.getElementById("evNew").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), name = String(f.get("name") || "").trim(), msg = document.getElementById("evNewMsg");
      if (name.length < 2) { msg.textContent = "Give the event a name."; return; }
      const row = { name, location: String(f.get("location") || "").trim() || null, event_date: f.get("event_date") || null };
      const { data, error } = await sb.from("brf_events").insert(row).select().single();
      if (error) { msg.textContent = "Couldn't create the event: " + error.message; return; }
      openEvent(data.id);
    });
    await loadEvents();
  }

  async function loadEvents() {
    const [{ data: evs, error }, { data: att }] = await Promise.all([
      sb.from("brf_events").select("*").eq("archived", false).order("created_at", { ascending: false }),
      sb.from("brf_event_attendees").select("event_id,checked_in_at,reward_coins,reward_status"),
    ]);
    const wrap = document.getElementById("evListWrap");
    if (error) { wrap.innerHTML = `<div class="empty"><p>Couldn't load events: ${esc(error.message)}</p></div>`; return; }
    evList = evs || [];
    if (!evList.length) { wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-calendar-plus" aria-hidden="true"></i><h2 class="display">No events yet</h2><p>Create one above to start registering attendees.</p></div>`; return; }
    const st = (id) => { const a = (att || []).filter((x) => x.event_id === id); return { n: a.length, in: a.filter((x) => x.checked_in_at).length, coins: a.reduce((s, x) => s + (x.reward_coins || 0), 0), todo: a.filter((x) => x.reward_status === "pending").length }; };
    wrap.innerHTML = `<div class="evgrid">${evList.map((ev) => { const s = st(ev.id); return `<button class="evcard" type="button" data-ev="${ev.id}">
      <b>${esc(ev.name)}</b><span class="muted">${esc([ev.location, ev.event_date ? new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ") || "No location or date")}</span>
      <span class="evcard__stats"><span><b>${s.n}</b> attendees</span><span><b>${s.in}</b> checked in</span><span><b>${s.coins.toLocaleString("en-NG")}</b> coins</span></span>
      ${s.todo ? `<span class="cstatus cstatus--pending">${s.todo} to approve</span>` : ""}</button>`; }).join("")}</div>`;
    wrap.querySelectorAll("[data-ev]").forEach((b) => b.addEventListener("click", () => openEvent(b.dataset.ev)));
  }

  async function openEvent(id) {
    const { data: ev, error } = await sb.from("brf_events").select("*").eq("id", id).single();
    if (error) return alert("Couldn't open the event: " + error.message);
    evCur = ev;
    root.innerHTML = `${tabs("events")}
      <div class="admin-head">
        <div><button class="linkish" type="button" id="evBack"><i class="ph-bold ph-arrow-left" aria-hidden="true"></i> All events</button>
          <h1 class="display">${esc(ev.name)}</h1><p>${esc([ev.location, ev.event_date ? new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""].filter(Boolean).join(" · "))}</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="evExcel" type="button"><i class="ph-bold ph-microsoft-excel-logo" aria-hidden="true"></i> Approved rewards (Excel)</button>
          <button class="btn btn--ghost" id="evPaid" type="button"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Mark approved as paid</button>
          <button class="btn btn--ghost" id="evRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button>
        </div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Attendees</span><b id="ev-n">0</b><small id="ev-in"></small></div>
        <div class="atile"><span>Coins to approve</span><b id="ev-pend">0</b></div>
        <div class="atile"><span>Coins approved, not paid</span><b id="ev-appr">0</b><small id="ev-notag"></small></div>
        <div class="atile"><span>Coins paid</span><b id="ev-paid">0</b></div>
      </div>
      ${actsShell()}
      <form class="evnew" id="evAdd" novalidate>
        <h2>Register an attendee</h2>
        <div class="evnew__row evnew__row--5">
          <label class="field"><span>Full name</span><input class="input" name="full_name" required maxlength="120" autocomplete="off"></label>
          <label class="field"><span>Email</span><input class="input" name="email" type="email" required maxlength="160" autocomplete="off"></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" required maxlength="20" placeholder="080..." autocomplete="off"></label>
          <label class="field"><span>Bvndle tag <small>(optional)</small></span><div class="affix affix--at"><span>@</span><input class="input" name="bvndle_tag" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false"></div></label>
          <div class="evadd__go"><label class="evcheck"><input type="checkbox" name="checkin" checked> Check in now</label><button class="btn btn--pink" type="submit"><i class="ph-bold ph-user-plus" aria-hidden="true"></i> Add</button></div>
        </div>
        <p class="evmsg" id="evAddMsg" role="status"></p>
      </form>
      <div class="admin-bar admin-bar--split">
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search attendees</span><input class="input" id="evSearch" type="search" placeholder="Search name, email, phone or tag"></label>
        <select class="input" id="evFilter" aria-label="Filter attendees">
          <option value="all">Everyone</option><option value="out">Not checked in</option><option value="pending">Reward to approve</option><option value="approved">Approved, not paid</option><option value="paid">Paid</option><option value="notag">No Bvndle tag</option>
        </select>
        <button class="btn btn--ghost" id="evApproveAll" type="button"><i class="ph-bold ph-checks" aria-hidden="true"></i> Approve all shown</button>
      </div>
      <div class="table-wrap" id="evWrap"><div class="empty"><p>Loading attendees...</p></div></div>`;
    bindTabs();
    const $i = (x) => document.getElementById(x);
    $i("evBack").addEventListener("click", renderEvents);
    $i("evRefresh").addEventListener("click", loadPeople);
    $i("evSearch").addEventListener("input", renderPeople);
    $i("evFilter").addEventListener("change", renderPeople);
    $i("evExcel").addEventListener("click", exportEventExcel);
    $i("evPaid").addEventListener("click", markEventPaid);
    $i("evApproveAll").addEventListener("click", approveShown);
    $i("evWrap").addEventListener("click", onPeopleClick);
    $i("evWrap").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-coins]")) { e.preventDefault(); saveCoins(e.target.dataset.coins); } });
    $i("evAdd").addEventListener("submit", addAttendee);
    bindActs();
    await loadPeople();
  }

  /* ---------- Passport and QR activities for an event (passport.html on the site) ---------- */
  let evActs = [], evDone = [];
  const KIND = { quiz: "Quiz question", puzzle: "Word puzzle", staff: "Staff code" };
  const siteBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");   // folder of the admin page, whether opened as /admin or /admin.html
  const ppUrl = () => `${siteBase()}passport.html?e=${evCur.passport_key}`;
  const actUrl = (a) => `${siteBase()}passport.html?a=${a.key}`;
  async function qrLib() {
    if (window.qrcode) return window.qrcode;
    await new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
    return window.qrcode;
  }
  async function qrSvg(text, px = 168) {
    const q = (await qrLib())(0, "M"); q.addData(text); q.make();
    const cell = Math.max(2, Math.floor(px / (q.getModuleCount() + 8)));
    return q.createSvgTag({ cellSize: cell, margin: cell * 4, scalable: true });
  }
  // a print-ready PNG: QR code, then the title and what it's worth underneath
  async function qrPng(text, title, sub) {
    const q = (await qrLib())(0, "M"); q.addData(text); q.make();
    const m = q.getModuleCount(), cell = 20, quiet = 4, W = (m + quiet * 2) * cell, H = W + 230;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.fillStyle = "#111";
    for (let r = 0; r < m; r++) for (let k = 0; k < m; k++) if (q.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    x.textAlign = "center"; x.fillStyle = "#111";
    x.font = "800 64px Inter Tight, Arial, sans-serif"; x.fillText(title.length > 30 ? title.slice(0, 29) + "…" : title, W / 2, W + 70);
    x.font = "600 44px Inter Tight, Arial, sans-serif"; x.fillStyle = "#5b4bd6"; x.fillText(sub, W / 2, W + 140);
    x.font = "500 30px Inter Tight, Arial, sans-serif"; x.fillStyle = "#666"; x.fillText("Scan with your phone camera", W / 2, W + 195);
    return c.toDataURL("image/png");
  }
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "qr";
  async function downloadQr(text, title, sub) {
    const a = document.createElement("a"); a.href = await qrPng(text, title, sub); a.download = `qr-${slugify(title)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function actsShell() {
    return `<section class="evacts" id="evActs">
      <div class="evacts__head"><div><h2>Passport and QR activities</h2><p class="muted">People scan the passport QR to get a digital passport, then scan activity QR codes to earn coins. Coins land in the attendee list below.</p></div>
        <div class="evacts__live"><span id="evLiveState"></span><button class="btn btn--sm" type="button" id="evLive"></button></div></div>
      <div class="evacts__grid">
        <div class="evpp"><div class="evpp__qr" id="evPpQr"></div><div><b>Passport QR</b><p class="muted">Print this at the entrance.</p>
          <div class="evpp__btns"><button class="btn btn--sm btn--ghost" type="button" id="evPpPng"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Download</button><button class="btn btn--sm btn--ghost" type="button" id="evPpCopy"><i class="ph-bold ph-link" aria-hidden="true"></i> Copy link</button><button class="btn btn--sm btn--ghost" type="button" id="evPrint"><i class="ph-bold ph-printer" aria-hidden="true"></i> Print all QR codes</button></div>
          <div class="evlogo"><b>Event logo</b><p class="muted">Shown at the top of the passport and activity pages (the BRF logo isn't shown there). PNG, JPG or WebP.</p>
            <div class="evlogo__prev" id="evLogoPrev"></div>
            <div class="evpp__btns"><label class="btn btn--sm btn--ghost"><input type="file" id="evLogoFile" accept="image/png,image/jpeg,image/webp" hidden><i class="ph-bold ph-upload-simple" aria-hidden="true"></i> <span id="evLogoBtn">Upload logo</span></label><button class="btn btn--sm btn--ghost" type="button" id="evLogoDel" hidden><i class="ph-bold ph-trash" aria-hidden="true"></i> Remove</button></div>
            <p class="evmsg" id="evLogoMsg" role="status"></p></div></div></div>
        <form class="evact" id="evActForm" novalidate>
          <b>New activity</b>
          <div class="evact__row">
            <label class="field"><span>Type</span><select class="input" name="kind"><option value="quiz">Quiz question</option><option value="puzzle">Word puzzle</option><option value="staff">Staff code</option></select></label>
            <label class="field"><span>Coins</span><input class="input" name="coins" type="number" min="1" step="1" value="2" required></label>
          </div>
          <label class="field"><span>Title (on the QR and the passport)</span><input class="input" name="title" maxlength="80" required placeholder="e.g. Money trivia"></label>
          <label class="field"><span data-k="prompt">Question</span><input class="input" name="prompt" maxlength="240"></label>
          <div data-for="quiz" class="evact__opts">
            ${[0, 1, 2, 3].map((i) => `<label class="evopt"><input type="radio" name="correct" value="${i}" ${i === 0 ? "checked" : ""} aria-label="Correct answer"><input class="input" name="opt${i}" maxlength="120" placeholder="Answer ${i + 1}${i > 1 ? " (optional)" : ""}"></label>`).join("")}
            <p class="muted">Tick the correct answer. One attempt per person.</p>
          </div>
          <label class="field" data-for="puzzle" hidden><span>Word to spell (2 to 16 letters)</span><input class="input" name="word" maxlength="16" placeholder="BVNDLE" autocapitalize="characters"></label>
          <label class="field" data-for="staff" hidden><span>Staff code (3 to 12 characters, give it to the booth staff)</span><input class="input" name="pin" maxlength="12" placeholder="e.g. 4821"></label>
          <p class="evmsg" id="evActMsg" role="status"></p>
          <button class="btn btn--pink btn--sm" type="submit"><i class="ph-bold ph-plus" aria-hidden="true"></i> Add activity</button>
        </form>
      </div>
      <div class="table-wrap" id="evActList"></div>
    </section>`;
  }
  function bindActs() {
    const f = document.getElementById("evActForm");
    const syncKind = () => {
      const k = f.kind.value;
      f.querySelectorAll("[data-for]").forEach((el) => (el.hidden = el.dataset.for !== k));
      f.querySelector("[data-k=prompt]").textContent = k === "quiz" ? "Question" : k === "puzzle" ? "Hint (optional)" : "What to do (optional)";
    };
    f.kind.addEventListener("change", syncKind); syncKind();
    f.addEventListener("submit", addActivity);
    document.getElementById("evLive").addEventListener("click", toggleLive);
    document.getElementById("evPpPng").addEventListener("click", () => downloadQr(ppUrl(), `${evCur.name}`, "Get your Bvndle passport"));
    document.getElementById("evPpCopy").addEventListener("click", async (e) => { try { await navigator.clipboard.writeText(ppUrl()); e.currentTarget.textContent = "Copied"; } catch (err) { prompt("Passport link", ppUrl()); } });
    document.getElementById("evPrint").addEventListener("click", printSheet);
    document.getElementById("evLogoFile").addEventListener("change", uploadLogo);
    document.getElementById("evLogoDel").addEventListener("click", () => { if (confirm("Remove this event's logo?")) saveLogo(null); });
    paintLogo();
    document.getElementById("evActList").addEventListener("click", onActClick);
    paintLive();
    qrSvg(ppUrl(), 150).then((svg) => (document.getElementById("evPpQr").innerHTML = svg)).catch(() => {});
    loadActs();
  }
  function paintLogo() {
    const has = !!evCur.logo;
    document.getElementById("evLogoPrev").innerHTML = has ? `<img src="${esc(evCur.logo)}" alt="${esc(evCur.name)} logo">` : `<span class="muted">No logo yet: the pages show the event name only.</span>`;
    document.getElementById("evLogoBtn").textContent = has ? "Replace logo" : "Upload logo";
    document.getElementById("evLogoDel").hidden = !has;
  }
  // shrink the logo to fit 480x240 in the browser (it's saved with the event, so it must stay small), then save
  async function uploadLogo(e) {
    const file = e.target.files[0], msg = document.getElementById("evLogoMsg"); e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return (msg.textContent = "Use a PNG, JPG or WebP image.");
    msg.textContent = "Preparing the logo...";
    try {
      const img = await new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = URL.createObjectURL(file); });
      const k = Math.min(1, 480 / img.naturalWidth, 240 / img.naturalHeight), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
      let data = c.toDataURL("image/png");
      if (data.length > 380000) data = c.toDataURL("image/webp", 0.9);
      if (data.length > 380000 || !/^data:image\/(png|webp)/.test(data)) data = c.toDataURL("image/jpeg", 0.85);
      if (data.length > 380000) return (msg.textContent = "That image is too detailed. Try a simpler or smaller logo.");
      await saveLogo(data);
    } catch (err) { msg.textContent = "Couldn't read that image. Try another file."; }
  }
  async function saveLogo(data) {
    const msg = document.getElementById("evLogoMsg");
    const { data: ev, error } = await sb.from("brf_events").update({ logo: data }).eq("id", evCur.id).select().single();
    if (error) return (msg.textContent = "Couldn't save: " + error.message);
    evCur = ev; paintLogo(); msg.textContent = data ? "Logo saved. It shows on the passport and activity pages." : "Logo removed.";
  }
  function paintLive() {
    document.getElementById("evLiveState").innerHTML = evCur.live ? `<span class="cstatus cstatus--approved">Live: activities accept scans</span>` : `<span class="cstatus cstatus--none">Not live: activities are closed</span>`;
    const b = document.getElementById("evLive"); b.textContent = evCur.live ? "Close activities" : "Go live"; b.classList.toggle("btn--pink", !evCur.live); b.classList.toggle("btn--ghost", evCur.live);
  }
  async function toggleLive() {
    if (evCur.live && !confirm("Close activities? Nobody will be able to earn coins until you go live again.")) return;
    const { data, error } = await sb.from("brf_events").update({ live: !evCur.live }).eq("id", evCur.id).select().single();
    if (error) return alert("Couldn't update: " + error.message);
    evCur = data; paintLive();
  }
  async function loadActs() {
    const { data, error } = await sb.from("brf_event_activities").select("*").eq("event_id", evCur.id).order("sort").order("created_at");
    if (error) { document.getElementById("evActList").innerHTML = `<div class="empty"><p>Couldn't load activities: ${esc(error.message)}</p></div>`; return; }
    evActs = data;
    const ids = evActs.map((a) => a.id);
    evDone = ids.length ? ((await sb.from("brf_activity_done").select("activity_id,correct,coins").in("activity_id", ids)).data || []) : [];
    renderActs();
  }
  function renderActs() {
    const wrap = document.getElementById("evActList");
    if (!evActs.length) { wrap.innerHTML = `<div class="empty"><p>No activities yet. Add one above; each gets its own QR code.</p></div>`; return; }
    wrap.innerHTML = `<table><thead><tr><th>Activity</th><th>Type</th><th>Coins</th><th>Answer</th><th>Done</th><th>Status</th><th></th></tr></thead><tbody>${evActs.map((a) => {
      const d = evDone.filter((x) => x.activity_id === a.id), won = d.filter((x) => x.correct).length;
      const ans = a.kind === "quiz" ? esc((a.options || [])[a.correct] || "") : a.kind === "puzzle" ? esc(a.word) : `PIN ${esc(a.pin)}`;
      return `<tr><td data-l="Activity"><b>${esc(a.title)}</b>${a.prompt ? `<br><span class="muted">${esc(a.prompt)}</span>` : ""}</td><td data-l="Type">${KIND[a.kind]}</td><td data-l="Coins" class="code">${a.coins}</td><td data-l="Answer">${ans}</td>
        <td data-l="Done">${d.length}${a.kind === "quiz" ? ` <span class="muted">(${won} right)</span>` : ""}</td>
        <td data-l="Status"><button class="linkish" type="button" data-act-toggle="${a.id}">${a.active ? "Open" : "Closed"}</button></td>
        <td><button class="btn btn--sm btn--ghost" type="button" data-act-qr="${a.id}"><i class="ph-bold ph-qr-code" aria-hidden="true"></i> QR</button> <button class="linkish" type="button" data-act-del="${a.id}">Delete</button></td></tr>`;
    }).join("")}</tbody></table>`;
  }
  async function addActivity(e) {
    e.preventDefault();
    const f = e.target, msg = document.getElementById("evActMsg"), kind = f.kind.value;
    const row = { event_id: evCur.id, kind, title: f.title.value.trim(), prompt: f.prompt.value.trim() || null, coins: Math.floor(Number(f.coins.value)), sort: evActs.length };
    if (row.title.length < 2) return (msg.textContent = "Give the activity a title.");
    if (!(row.coins > 0)) return (msg.textContent = "Coins must be 1 or more.");
    if (kind === "quiz") {
      if (!row.prompt) return (msg.textContent = "Add the question.");
      const opts = [0, 1, 2, 3].map((i) => f["opt" + i].value.trim()), c = +f.querySelector("[name=correct]:checked").value;
      if (!opts[c]) return (msg.textContent = "The ticked correct answer is empty.");
      const kept = opts.map((o, i) => ({ o, i })).filter((x) => x.o);
      if (kept.length < 2) return (msg.textContent = "Add at least two answers.");
      row.options = kept.map((x) => x.o); row.correct = kept.findIndex((x) => x.i === c);
    }
    if (kind === "puzzle") { row.word = f.word.value.replace(/\s/g, "").toUpperCase(); if (row.word.length < 2 || row.word.length > 16) return (msg.textContent = "The word needs 2 to 16 letters."); }
    if (kind === "staff") { row.pin = f.pin.value.trim(); if (row.pin.length < 3) return (msg.textContent = "The staff code needs at least 3 characters."); }
    const { data, error } = await sb.from("brf_event_activities").insert(row).select().single();
    if (error) return (msg.textContent = "Couldn't add: " + error.message);
    evActs.push(data); renderActs();
    msg.textContent = `"${data.title}" added. Download its QR code from the list.`;
    const k = f.kind.value; f.reset(); f.kind.value = k; f.coins.value = row.coins; f.dispatchEvent(new Event("change")); f.kind.dispatchEvent(new Event("change"));
  }
  async function onActClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const a = evActs.find((x) => x.id === (b.dataset.actQr || b.dataset.actToggle || b.dataset.actDel)); if (!a) return;
    if (b.dataset.actQr) downloadQr(actUrl(a), a.title, `Earn ${a.coins} Bvndle coins`);
    if (b.dataset.actToggle) {
      const { data, error } = await sb.from("brf_event_activities").update({ active: !a.active }).eq("id", a.id).select().single();
      if (error) return alert("Couldn't update: " + error.message);
      evActs = evActs.map((x) => (x.id === a.id ? data : x)); renderActs();
    }
    if (b.dataset.actDel) {
      const used = evDone.some((x) => x.activity_id === a.id);
      if (!confirm(used ? `People have already done "${a.title}". Deleting it removes it from their passports, but coins they earned stay. Close it instead?\n\nOK deletes, Cancel keeps it.` : `Delete "${a.title}"? Its printed QR code will stop working.`)) return;
      const { error } = await sb.from("brf_event_activities").delete().eq("id", a.id);
      if (error) return alert("Couldn't delete: " + error.message);
      evActs = evActs.filter((x) => x.id !== a.id); renderActs();
    }
  }
  // one printable page: the passport QR and every open activity, two per row
  async function printSheet() {
    const items = [{ t: evCur.name, s: "Get your Bvndle passport", u: ppUrl() }].concat(evActs.filter((a) => a.active).map((a) => ({ t: a.title, s: `Earn ${a.coins} Bvndle coins`, u: actUrl(a) })));
    const imgs = await Promise.all(items.map((it) => qrPng(it.u, it.t, it.s)));
    const w = open("", "_blank"); if (!w) return alert("Allow pop-ups to print the QR sheet.");
    w.document.write(`<!doctype html><title>QR codes: ${esc(evCur.name)}</title><style>body{margin:0;font-family:Arial,sans-serif}.g{display:grid;grid-template-columns:1fr 1fr;gap:10mm;padding:10mm}.g img{width:100%;border:1px solid #ddd;break-inside:avoid}@media print{.p{display:none}}</style><p class="p" style="padding:10px 10mm">Print this page (Ctrl/Cmd + P). Each code opens on the person's phone.</p><div class="g">${imgs.map((src) => `<img src="${src}" alt="">`).join("")}</div>`);
    w.document.close();
  }

  async function loadPeople() {
    const { data, error } = await sb.from("brf_event_attendees").select(ATT_COLS).eq("event_id", evCur.id).order("created_at", { ascending: false });
    if (error) { document.getElementById("evWrap").innerHTML = `<div class="empty"><p>Couldn't load attendees: ${esc(error.message)}</p></div>`; return; }
    evPeople = data; renderPeople();
  }
  function shownPeople() {
    const q = document.getElementById("evSearch").value.trim().toLowerCase().replace(/^@/, ""), f = document.getElementById("evFilter").value;
    return evPeople.filter((p) => {
      if (f === "out" && p.checked_in_at) return false;
      if (["pending", "approved", "paid"].includes(f) && p.reward_status !== f) return false;
      if (f === "notag" && p.bvndle_tag) return false;
      return !q || [p.full_name, p.email, p.phone, p.bvndle_tag].join(" ").toLowerCase().includes(q);
    });
  }
  function renderPeople() {
    const sum = (st) => evPeople.filter((p) => p.reward_status === st).reduce((n, p) => n + p.reward_coins, 0), n = (x) => x.toLocaleString("en-NG");
    const set = (i, v) => (document.getElementById(i).textContent = v);
    set("ev-n", n(evPeople.length)); set("ev-in", `${n(evPeople.filter((p) => p.checked_in_at).length)} checked in`);
    set("ev-pend", n(sum("pending"))); set("ev-appr", n(sum("approved"))); set("ev-paid", n(sum("paid")));
    const noTag = evPeople.filter((p) => p.reward_status === "approved" && !p.bvndle_tag).length;
    set("ev-notag", noTag ? `${noTag} without a Bvndle tag` : "");
    document.getElementById("evExcel").disabled = document.getElementById("evPaid").disabled = !evPeople.some((p) => p.reward_status === "approved");
    const rows = shownPeople(), wrap = document.getElementById("evWrap");
    document.getElementById("evApproveAll").disabled = !rows.some((p) => p.reward_status === "pending");
    if (!evPeople.length) { wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-users-three" aria-hidden="true"></i><h2 class="display">No attendees yet</h2><p>Register people above as they arrive.</p></div>`; return; }
    wrap.innerHTML = `<table class="evtable"><thead><tr><th>Name</th><th>Contact</th><th>Bvndle tag</th><th>Check-in</th><th>Booklet coins</th><th>Reward</th></tr></thead><tbody>${rows.length ? rows.map((p) => `<tr data-row="${p.id}">
      <td data-l="Name"><b>${esc(p.full_name)}</b>${p.source === "passport" ? ` <span class="cstatus cstatus--none" title="Signed up with the passport QR">Passport</span>` : ""}</td>
      <td data-l="Contact">${esc(p.email || "")}<br><span class="muted">${esc(p.phone ? window.formatNgPhone(p.phone) : "")}</span></td>
      <td data-l="Bvndle tag">${p.bvndle_tag ? `@${esc(p.bvndle_tag)} <button class="linkish" type="button" data-tag="${p.id}">Edit</button>` : `<button class="btn btn--sm btn--ghost" type="button" data-tag="${p.id}"><i class="ph-bold ph-plus" aria-hidden="true"></i> Add tag</button>`}</td>
      <td data-l="Check-in">${p.checked_in_at ? `<span class="checkin is-in"><i class="ph-bold ph-check" aria-hidden="true"></i> ${fmt.format(new Date(p.checked_in_at))}</span> <button class="linkish" type="button" data-out="${p.id}">Undo</button>` : `<button class="btn btn--sm btn--ghost" type="button" data-in="${p.id}">Check in</button>`}</td>
      <td data-l="Booklet coins"><div class="evcoins"><input class="input input--sm" type="number" min="0" step="1" inputmode="numeric" value="${p.reward_coins || ""}" placeholder="0" data-coins="${p.id}" aria-label="Coins for ${esc(p.full_name)}" ${p.reward_status === "paid" ? "disabled" : ""}><button class="btn btn--sm btn--ghost" type="button" data-save="${p.id}" ${p.reward_status === "paid" ? "hidden" : ""}>Save</button></div></td>
      <td data-l="Reward"><span class="cstatus cstatus--${p.reward_status === "pending" ? "pending" : p.reward_status === "approved" ? "approved" : p.reward_status === "paid" ? "collected" : "none"}">${EV_STATUS[p.reward_status]}</span>
        ${p.reward_status === "pending" ? `<button class="btn btn--sm btn--ghost" type="button" data-approve="${p.id}">Approve</button>` : p.reward_status === "approved" ? `<button class="linkish" type="button" data-unapprove="${p.id}">Undo</button>` : ""}</td>
    </tr>`).join("") : `<tr><td colspan="6" class="muted" style="text-align:center;padding:36px">Nobody matches.</td></tr>`}</tbody></table>`;
  }

  const normPhone = (v) => window.normalizeNgPhone(v) || String(v || "").replace(/[^\d+]/g, "");
  async function addAttendee(e) {
    e.preventDefault();
    const form = e.target, f = new FormData(form), msg = document.getElementById("evAddMsg");
    const row = { event_id: evCur.id, full_name: String(f.get("full_name") || "").trim(), email: String(f.get("email") || "").trim().toLowerCase(), phone: normPhone(f.get("phone")), bvndle_tag: String(f.get("bvndle_tag") || "").trim().replace(/^@/, "") || null, checked_in_at: f.get("checkin") ? new Date().toISOString() : null };
    if (row.full_name.length < 2) return (msg.textContent = "Add the attendee's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return (msg.textContent = "Add a valid email address.");
    if (row.phone.replace(/\D/g, "").length < 10) return (msg.textContent = "Add a valid phone number.");
    const dup = evPeople.find((p) => (p.email && p.email === row.email) || (p.phone && p.phone === row.phone));
    if (dup && !confirm(`${dup.full_name} is already registered with this email or phone. Add anyway?`)) return;
    const { data, error } = await sb.from("brf_event_attendees").insert(row).select(ATT_COLS).single();
    if (error) return (msg.textContent = "Couldn't add: " + evErr(error));
    evPeople.unshift(data); form.reset(); form.querySelector("[name=checkin]").checked = true; form.querySelector("[name=full_name]").focus();
    msg.textContent = `${data.full_name} added${data.checked_in_at ? " and checked in" : ""}.`;
    renderPeople();
  }
  async function patchPerson(id, patch) {
    const { data, error } = await sb.from("brf_event_attendees").update(patch).eq("id", id).select(ATT_COLS).single();
    if (error) { alert(evErr(error)); return null; }
    evPeople = evPeople.map((p) => (p.id === id ? data : p)); renderPeople(); return data;
  }
  async function saveCoins(id) {
    const el = document.querySelector(`[data-coins="${id}"]`), v = Math.max(0, Math.floor(Number(el.value) || 0)), p = evPeople.find((x) => x.id === id);
    if (p.reward_coins === v) return;
    if (p.reward_status === "approved" && !confirm(`${p.full_name}'s reward is already approved. Changing it means it needs approval again. Continue?`)) { el.value = p.reward_coins || ""; return; }
    await patchPerson(id, { reward_coins: v });
  }
  async function onPeopleClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.in) patchPerson(d.in, { checked_in_at: new Date().toISOString() });
    if (d.out) patchPerson(d.out, { checked_in_at: null });
    if (d.save) saveCoins(d.save);
    if (d.approve) patchPerson(d.approve, { reward_status: "approved" });
    if (d.unapprove) patchPerson(d.unapprove, { reward_status: "pending" });
    if (d.tag) {
      const p = evPeople.find((x) => x.id === d.tag), v = prompt(`Bvndle tag for ${p.full_name}`, p.bvndle_tag || "");
      if (v !== null) patchPerson(d.tag, { bvndle_tag: v.trim().replace(/^@/, "") || null });
    }
  }
  async function approveShown() {
    const ids = shownPeople().filter((p) => p.reward_status === "pending").map((p) => p.id);
    if (!ids.length || !confirm(`Approve ${ids.length} reward${ids.length === 1 ? "" : "s"}?`)) return;
    const { error } = await sb.from("brf_event_attendees").update({ reward_status: "approved" }).in("id", ids);
    if (error) alert(evErr(error));
    loadPeople();
  }
  async function markEventPaid() {
    const list = evPeople.filter((p) => p.reward_status === "approved"), noTag = list.filter((p) => !p.bvndle_tag).length;
    if (!list.length) return;
    if (!confirm(`Mark ${list.length} approved reward${list.length === 1 ? "" : "s"} as paid? Do this after the Bvndle upload has gone through.${noTag ? `\n\n${noTag} of them have no Bvndle tag.` : ""}`)) return;
    const { error } = await sb.from("brf_event_attendees").update({ reward_status: "paid" }).in("id", list.map((p) => p.id));
    if (error) alert(evErr(error));
    loadPeople();
  }
  async function exportEventExcel() {
    const btn = document.getElementById("evExcel"); btn.disabled = true;
    try {
      if (!window.XLSX) await new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
      const X = window.XLSX, list = evPeople.filter((p) => p.reward_status === "approved");
      const rows = list.map((p) => ({ "Bvndle tag": p.bvndle_tag ? "@" + p.bvndle_tag : "", Coins: p.reward_coins, "Full name": p.full_name, Email: p.email || "", Phone: p.phone || "", "Tag present": p.bvndle_tag ? "Yes" : "No", "Naira value": p.reward_coins * NAIRA, "Checked in": p.checked_in_at ? new Date(p.checked_in_at) : "", "Approved at": p.reward_approved_at ? new Date(p.reward_approved_at) : "" }));
      const ws = X.utils.json_to_sheet(rows, { cellDates: true });
      ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 4) }));
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Approved rewards");
      const slug = evCur.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
      X.writeFile(wb, `${slug}-approved-rewards-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { alert("Couldn't build the Excel file. Check your connection and try again."); }
    btn.disabled = false;
  }

  /* ===================== Partner tickets: numbered ticket blocks issued to partners (e.g. Vbank, BRFV-20025 …) =====================
     Create a partner with its code start (BRF + letter + dash), then allocate a block of serial numbers and a ticket type.
     Serials are unique across all partners (the database refuses overlaps). Check codes in at the gate; export per partner. */
  let tpPartners = [], tpTickets = [];
  // a Day Pass code becomes a real Day Pass when the customer claims it online (pass = that free_passes row)
  const TP_SEL = "*, pass:free_passes(id, pass_code, first_name, last_name, email, phone, checked_in_at)";
  const isDP = (t) => t.ticket_type === "Day Pass";
  const tpIn = (t) => (isDP(t) ? !!(t.pass && t.pass.checked_in_at) : !!t.checked_in_at);
  const tpLink = (t) => `${siteBase()}?code=${encodeURIComponent(t.code)}`;
  const TP_TYPES = ["Day Pass", "Concert · Early Bird", "Concert · Regular", "Concert · Individual VIP", "Concert · Individual Premium", "Concert · VIP Table for 10", "Concert · Premium Table for 5", "Concert · Premium Table for 10"];
  const tpErr = (e) => { const m = e?.message || ""; if (m.startsWith("serials_taken:")) return m.slice(14) + ". Pick a different range."; return ({ bad_range: "The end number must be the same as or higher than the start.", range_too_big: "Generate at most 5,000 tickets at a time.", bad_count: "Enter how many tickets to generate.", missing_type: "Choose a ticket type." }[m]) || (/duplicate key.*prefix/.test(m) ? "Another partner already uses that code start." : m || "Something went wrong."); };
  async function renderPartnerTickets() {
    root.innerHTML = `${tabs("ptickets")}
      <div class="admin-head">
        <div><h1 class="display">Partner tickets</h1><p>Issue tickets to partners. Each partner has its own code start (e.g. <b>BRFV-</b> for Vbank). Enter how many tickets they get and the codes are made for you: the next free numbers, each with a random ending (e.g. BRFV-20061-K7QXM) so codes can't be guessed.</p></div>
        <div class="admin-actions"><button class="btn btn--ghost" id="tpRefresh" type="button"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button><button class="btn btn--ghost" id="signOut" type="button">Sign out</button></div>
      </div>
      <div class="admin-tiles admin-tiles--4">
        <div class="atile atile--glare"><span>Tickets issued</span><b id="tp-n">0</b></div>
        <div class="atile"><span>Day Passes claimed</span><b id="tp-p">0</b><small id="tp-pc"></small></div>
        <div class="atile"><span>Checked in</span><b id="tp-in">0</b></div>
        <div class="atile"><span>Next free number</span><b id="tp-next">–</b></div>
      </div>
      <div class="tpforms">
        <form class="evnew" id="tpNew" novalidate><h2>New partner</h2>
          <div class="evnew__row evnew__row--tp">
            <label class="field"><span>Partner name</span><input class="input" name="name" maxlength="80" required placeholder="e.g. Vbank"></label>
            <label class="field"><span>Code start</span><input class="input" name="prefix" maxlength="13" required placeholder="BRFV-" autocapitalize="characters"></label>
            <label class="field"><span>Contact <small>(optional)</small></span><input class="input" name="contact" maxlength="120" placeholder="Name, email or phone"></label>
            <button class="btn btn--pink" type="submit"><i class="ph-bold ph-plus" aria-hidden="true"></i> Add partner</button>
          </div><p class="evmsg" id="tpNewMsg" role="status"></p></form>
        <form class="evnew" id="tpAlloc" novalidate><h2>Allocate tickets</h2>
          <div class="evnew__row evnew__row--tp2">
            <label class="field"><span>Partner</span><select class="input" name="partner" required></select></label>
            <label class="field"><span>Ticket type</span><select class="input" name="type">${TP_TYPES.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
            <label class="field"><span>How many tickets</span><input class="input" name="count" type="number" min="1" max="5000" step="1" required placeholder="e.g. 20"></label>
            <button class="btn btn--pink" type="submit"><i class="ph-bold ph-ticket" aria-hidden="true"></i> Generate codes</button>
          </div><p class="evmsg" id="tpAllocMsg" role="status"></p></form>
      </div>
      <div id="tpList"><div class="empty"><p>Loading...</p></div></div>
      <div class="admin-bar admin-bar--split">
        <label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search ticket codes</span><input class="input" id="tpSearch" type="search" placeholder="Search a ticket code (e.g. BRFV-20031), partner, name or pass code"></label>
        <select class="input" id="tpFilter" aria-label="Filter"><option value="">All partners</option></select>
      </div>
      <div class="table-wrap" id="tpWrap"></div>`;
    bindTabs();
    const $i = (x) => document.getElementById(x);
    $i("signOut").addEventListener("click", signOut);
    $i("tpRefresh").addEventListener("click", loadPT);
    $i("tpSearch").addEventListener("input", renderTP);
    $i("tpFilter").addEventListener("change", renderTP);
    $i("tpWrap").addEventListener("click", onTPClick);
    $i("tpList").addEventListener("click", (e) => { const b = e.target.closest("[data-tp-export]"); if (b) exportPartnerTickets(b.dataset.tpExport); });
    const nf = $i("tpNew");
    nf.name.addEventListener("input", () => { if (!nf.prefix.dataset.touched) nf.prefix.value = nf.name.value.trim() ? "BRF" + nf.name.value.trim()[0].toUpperCase() + "-" : ""; });
    nf.prefix.addEventListener("input", () => (nf.prefix.dataset.touched = "1"));
    nf.addEventListener("submit", async (e) => {
      e.preventDefault(); const msg = $i("tpNewMsg");
      let prefix = nf.prefix.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); if (prefix && !prefix.endsWith("-")) prefix += "-";
      if (nf.name.value.trim().length < 2) return (msg.textContent = "Add the partner's name.");
      if (!/^[A-Z0-9]{2,12}-$/.test(prefix)) return (msg.textContent = "Code start must be 2 to 12 letters or numbers followed by a dash, e.g. BRFV-.");
      const { error } = await sb.from("brf_ticket_partners").insert({ name: nf.name.value.trim(), prefix, contact: nf.contact.value.trim() || null });
      if (error) return (msg.textContent = "Couldn't add: " + tpErr(error));
      msg.textContent = `${nf.name.value.trim()} added with code start ${prefix}`; nf.reset(); delete nf.prefix.dataset.touched; loadPT();
    });
    const af = $i("tpAlloc");
    const tpNext = () => (tpTickets.length ? Math.max(...tpTickets.map((t) => t.serial)) + 1 : 1);
    const syncCount = () => { const k = Math.floor(+af.count.value), a = tpNext(), p = tpPartners.find((x) => x.id === af.partner.value); $i("tpAllocMsg").textContent = k > 0 && p ? `${k.toLocaleString("en-NG")} tickets: ${p.prefix}${a} to ${p.prefix}${a + k - 1}` : ""; };
    ["input", "change"].forEach((ev) => af.addEventListener(ev, syncCount));
    af.addEventListener("submit", async (e) => {
      e.preventDefault(); const msg = $i("tpAllocMsg"), k = Math.floor(+af.count.value);
      if (!af.partner.value) return (msg.textContent = "Add a partner first.");
      if (!(k > 0)) return (msg.textContent = "Enter how many tickets to generate.");
      const p = tpPartners.find((x) => x.id === af.partner.value);
      if (!confirm(`Generate ${k} ${af.type.value} ticket code${k === 1 ? "" : "s"} for ${p.name}?`)) return;
      const { data, error } = await sb.rpc("admin_issue_partner_tickets", { p_partner: p.id, p_count: k, p_type: af.type.value });
      if (error) return (msg.textContent = tpErr(error));
      msg.textContent = `Done: ${data.allocated} codes, ${data.from}-… to ${data.to}-…. Download the Excel list from ${p.name}'s card to send them.`; af.count.value = ""; loadPT();
    });
    loadPT();
  }
  async function loadPT() {
    const [{ data: ps, error }, tk] = await Promise.all([sb.from("brf_ticket_partners").select("*").order("created_at"), (async () => { const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from("brf_partner_tickets").select(TP_SEL).order("serial").range(f, f + 999); if (error || !data) break; out.push(...data); if (data.length < 1000) break; } return out; })()]);
    if (error) { document.getElementById("tpList").innerHTML = `<div class="empty"><p>Couldn't load partners: ${esc(error.message)}</p></div>`; return; }
    tpPartners = ps; tpTickets = tk;
    const af = document.getElementById("tpAlloc"), keep = af.partner.value;
    af.partner.innerHTML = tpPartners.length ? tpPartners.map((p) => `<option value="${p.id}">${esc(p.name)} (${esc(p.prefix)})</option>`).join("") : `<option value="">Add a partner first</option>`;
    if (keep) af.partner.value = keep;
    const fl = document.getElementById("tpFilter"), fk = fl.value;
    fl.innerHTML = `<option value="">All partners</option>` + tpPartners.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(""); fl.value = fk;
    renderTP();
  }
  // contiguous blocks of serials, e.g. 20025–20045, for the partner cards
  const tpRanges = (list) => { const r = []; list.forEach((t) => { const l = r[r.length - 1]; if (l && t.serial === l.to + 1 && t.ticket_type === l.type) l.to = t.serial; else r.push({ from: t.serial, to: t.serial, type: t.ticket_type }); }); return r; };
  function renderTP() {
    const n = (x) => x.toLocaleString("en-NG"), set = (i, v) => (document.getElementById(i).textContent = v);
    const dps = tpTickets.filter(isDP);
    set("tp-n", n(tpTickets.length)); set("tp-p", n(dps.filter((t) => t.pass).length)); set("tp-pc", `of ${n(dps.length)} Day Pass codes`); set("tp-in", n(tpTickets.filter(tpIn).length));
    set("tp-next", tpTickets.length ? String(Math.max(...tpTickets.map((t) => t.serial)) + 1) : "–");
    document.getElementById("tpList").innerHTML = tpPartners.length ? `<div class="evgrid">${tpPartners.map((p) => {
      const mine = tpTickets.filter((t) => t.partner_id === p.id), rs = tpRanges(mine);
      return `<div class="evcard tpcard"><b>${esc(p.name)} <span class="tag">${esc(p.prefix)}</span></b>${p.contact ? `<span class="muted">${esc(p.contact)}</span>` : ""}
        <span class="evcard__stats"><span><b>${n(mine.length)}</b> tickets</span><span><b>${n(mine.filter((t) => t.pass).length)}</b> claimed</span><span><b>${n(mine.filter(tpIn).length)}</b> checked in</span></span>
        ${rs.length ? `<ul class="tpranges">${rs.map((r) => `<li><span class="code">${esc(p.prefix)}${r.from}${r.to !== r.from ? ` – ${esc(p.prefix)}${r.to}` : ""}</span> <span class="muted">${n(r.to - r.from + 1)} · ${esc(r.type)}</span></li>`).join("")}</ul>` : `<span class="muted">No tickets allocated yet.</span>`}
        ${mine.length ? `<button class="btn btn--sm btn--ghost" type="button" data-tp-export="${p.id}"><i class="ph-bold ph-microsoft-excel-logo" aria-hidden="true"></i> Ticket list (Excel)</button>` : ""}</div>`;
    }).join("")}</div>` : `<div class="empty"><i class="ph-duotone ph-handshake" aria-hidden="true"></i><h2 class="display">No partners yet</h2><p>Add a partner above, then allocate their ticket numbers.</p></div>`;
    const q = document.getElementById("tpSearch").value.trim().toUpperCase(), f = document.getElementById("tpFilter").value, wrap = document.getElementById("tpWrap");
    if (!q && !f) { wrap.innerHTML = tpTickets.length ? `<div class="empty"><p>Search a ticket code or pick a partner to see and check in tickets.</p></div>` : ""; return; }
    const pn = (id) => tpPartners.find((p) => p.id === id) || {};
    const rows = tpTickets.filter((t) => (!f || t.partner_id === f) && (!q || t.code.includes(q) || String(t.serial).includes(q) || (pn(t.partner_id).name || "").toUpperCase().includes(q) || (t.issued_to || "").toUpperCase().includes(q) || (t.pass && [t.pass.pass_code, t.pass.email, t.pass.phone].join(" ").toUpperCase().includes(q)))).slice(0, 300);
    const inCell = (at, undo) => `<span class="checkin is-in"><i class="ph-bold ph-check" aria-hidden="true"></i> ${fmt.format(new Date(at))}</span> <button class="linkish" type="button" ${undo}>Undo</button>`;
    const row = (t) => {
      if (isDP(t)) {
        const p = t.pass;
        return `<td>${p ? `${esc(p.first_name)} ${esc(p.last_name)} <span class="muted code">${esc(p.pass_code)}</span>` : `<span class="muted">Not claimed yet</span> <button class="linkish" type="button" data-tp-link="${t.id}">Copy claim link</button>`}</td>
          <td>${!p ? `<span class="muted">Can't enter until claimed</span>` : p.checked_in_at ? inCell(p.checked_in_at, `data-pass-out="${p.id}"`) : `<button class="btn btn--sm btn--ghost" type="button" data-pass-in="${p.id}">Check in</button>`}</td>`;
      }
      return `<td>${t.issued_to ? esc(t.issued_to) + " " : ""}<button class="linkish" type="button" data-tp-name="${t.id}">${t.issued_to ? "Edit" : "Add name"}</button></td>
        <td>${t.checked_in_at ? inCell(t.checked_in_at, `data-tp-out="${t.id}"`) : `<button class="btn btn--sm btn--ghost" type="button" data-tp-in="${t.id}">Check in</button>`}</td>`;
    };
    wrap.innerHTML = `<table><thead><tr><th>Ticket code</th><th>Partner</th><th>Type</th><th>Claimed by / issued to</th><th>At the gate</th></tr></thead><tbody>${rows.length ? rows.map((t) => `<tr>
      <td class="code">${esc(t.code)}</td><td>${esc(pn(t.partner_id).name || "")}</td><td>${esc(t.ticket_type)}</td>${row(t)}</tr>`).join("") : `<tr><td colspan="5" class="muted" style="text-align:center;padding:36px">No ticket matches.</td></tr>`}</tbody></table>${rows.length === 300 ? `<p class="muted">Showing the first 300. Search to narrow down.</p>` : ""}`;
  }
  async function onTPClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tpLink) { const t = tpTickets.find((x) => x.id === b.dataset.tpLink), l = tpLink(t); try { await navigator.clipboard.writeText(l); b.textContent = "Link copied"; } catch (err) { prompt("Claim link", l); } return; }
    const pid = b.dataset.passIn || b.dataset.passOut;
    if (pid) {      // a claimed Day Pass code: check in the Day Pass it became
      const patch = b.dataset.passIn ? { checked_in_at: new Date().toISOString(), checked_in_by: me.id } : { checked_in_at: null, checked_in_by: null };
      const { error } = await sb.from("free_passes").update(patch).eq("id", pid);
      if (error) return alert("Couldn't update: " + error.message);
      tpTickets = tpTickets.map((t) => (t.pass && t.pass.id === pid ? { ...t, pass: { ...t.pass, checked_in_at: patch.checked_in_at } } : t)); return renderTP();
    }
    const id = b.dataset.tpIn || b.dataset.tpOut || b.dataset.tpName; if (!id) return;
    let patch;
    if (b.dataset.tpIn) patch = { checked_in_at: new Date().toISOString(), checked_in_by: me.id };
    if (b.dataset.tpOut) patch = { checked_in_at: null, checked_in_by: null };
    if (b.dataset.tpName) { const t = tpTickets.find((x) => x.id === id), v = prompt(`Who is ${t.code} for?`, t.issued_to || ""); if (v === null) return; patch = { issued_to: v.trim() || null }; }
    const { data, error } = await sb.from("brf_partner_tickets").update(patch).eq("id", id).select(TP_SEL).single();
    if (error) return alert("Couldn't update: " + error.message);
    tpTickets = tpTickets.map((t) => (t.id === id ? data : t)); renderTP();
  }
  async function exportPartnerTickets(pid) {
    const p = tpPartners.find((x) => x.id === pid), list = tpTickets.filter((t) => t.partner_id === pid);
    try {
      if (!window.XLSX) await new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc); });
      const X = window.XLSX, rows = list.map((t) => {
        const p = t.pass, ci = isDP(t) ? p && p.checked_in_at : t.checked_in_at;
        return { "Ticket code": t.code, "Ticket number": t.serial, Type: t.ticket_type, "Claim link (send this)": isDP(t) ? tpLink(t) : "",
          "Claimed by": p ? `${p.first_name} ${p.last_name}` : t.issued_to || "", Email: p ? p.email : "", Phone: p ? p.phone : "", "Pass code": p ? p.pass_code : "",
          Claimed: t.claimed_at ? new Date(t.claimed_at) : "", "Checked in": ci ? new Date(ci) : "" };
      });
      const ws = X.utils.json_to_sheet(rows, { cellDates: true }); ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 62 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Tickets");
      X.writeFile(wb, `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-brf-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { alert("Couldn't build the Excel file. Check your connection and try again."); }
  }

  /* ===================== Analytics: visits, what people do, where they leave ===================== */
  const SECTIONS = [["hero", "Top of page"], ["journey", "Experience"], ["trivia", "1 Million Questions"], ["talks", "Main stage talks"], ["partners", "Partners"], ["numbers", "Last year in numbers"], ["concert", "Concert"], ["lineup", "Headliners"], ["vip", "Concert tickets"], ["voices", "Testimonials"], ["day", "Your day"], ["access", "Two tickets"], ["ticket", "Free ticket form"], ["why", "Why loyalty matters"], ["brands", "Become a partner"], ["faq", "FAQs"]];
  const SEC = Object.fromEntries(SECTIONS); SEC.top = "Top of page"; SEC.nav = "Menu"; SEC.footer = "Footer"; SEC["phone-bar"] = "Phone ticket bar";
  const ACTIONS = { ticket_claimed: "Claimed a free ticket", ticket_reopened: "Re-opened their ticket", ticket_error: "Ticket form error", quiz_play: "Started a trivia round (for entries)", quiz_practice: "Started a practice round", quiz_round_done: "Finished a trivia round", quiz_needs_ticket: "Tried to play without a ticket", zone_tab: "Opened a zone plan", wealth_walked: "Walked all Wealth stations", wealth_complete: "Earned the Wealth zone coins", partner_form_open: "Opened the Become a Partner form", partner_enquiry: "Sent a partner enquiry", headliner_guess: "Guessed a headliner" };
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
