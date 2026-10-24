/* Free ticket admin: Supabase sign-in, sign-up list, search, check-in at the gate and CSV export.
   Only accounts listed in public.admins can read the list (enforced by the database, not this page). */
(() => {
  const root = document.getElementById("admin");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const sb = window.supabase.createClient(window.BRF_DB.url, window.BRF_DB.key);
  let all = [], me = null;

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
    root.innerHTML = `
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
    load();
  }

  async function load() {
    const out = [], page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("free_passes").select("*").order("created_at", { ascending: false }).range(from, from + page - 1);
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
    const { data, error } = await sb.from("free_passes").update(patch).eq("id", id).select().single();
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

  boot();
})();
