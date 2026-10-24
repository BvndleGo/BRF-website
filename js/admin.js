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
      <button type="button" data-tab="coins" class="${on === "coins" ? "is-on" : ""}">Coins</button></nav>`;
  function bindTabs() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => (b.dataset.tab === "coins" ? renderCoins() : renderDashboard())));
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

  boot();
})();
