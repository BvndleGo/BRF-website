(() => {
  const root = document.getElementById("admin");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const SESSION = "brf_admin_session";
  const signedIn = () => { try { return sessionStorage.getItem(SESSION) === "1"; } catch { return false; } };

  /* Login (placeholder UI only: real auth arrives with the backend) */
  function renderLogin() {
    root.innerHTML = `
      <form class="admin-login form" id="login" novalidate>
        <h1 class="display">Admin</h1>
        <p>Sign in to see free ticket sign-ups.</p>
        <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" placeholder="you@bvndle.com" required></div>
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn btn--pink btn--block" type="submit">Sign in <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></button>
        <p class="proto-note"><i class="ph-bold ph-warning" aria-hidden="true"></i><span>Prototype screen. Any details open the dashboard. Real sign-in is added with the backend.</span></p>
      </form>`;
    document.getElementById("login").addEventListener("submit", (e) => {
      e.preventDefault();
      try { sessionStorage.setItem(SESSION, "1"); } catch {}
      renderDashboard();
    });
  }

  function sorted() { return window.PassStore.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

  function renderDashboard() {
    root.innerHTML = `
      <div class="admin-head">
        <div><h1 class="display">Free ticket sign-ups</h1><p>Everyone who has claimed a free ticket.</p></div>
        <div class="admin-actions">
          <button class="btn btn--pink" id="exportBtn" type="button"><i class="ph-bold ph-download-simple" aria-hidden="true"></i> Export CSV</button>
          <button class="btn btn--ghost" id="signOut" type="button">Sign out</button>
        </div>
      </div>
      <div class="admin-tiles">
        <div class="atile atile--glare"><span>Total tickets (coins)</span><b id="t-total">0</b></div>
        <div class="atile"><span>Claimed today</span><b id="t-today">0</b></div>
        <div class="atile"><span>With a Bvndle tag</span><b id="t-tag">0</b></div>
      </div>
      <div class="admin-bar"><label class="affix"><span><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i></span><span class="sr-only">Search sign-ups</span><input class="input" id="search" type="search" placeholder="Search name, phone, tag or pass code"></label></div>
      <div class="table-wrap" id="tableWrap"></div>
      <p class="proto-note"><i class="ph-bold ph-info" aria-hidden="true"></i><span>Prototype: sign-ups are stored in this browser only. Connect a backend before launch so every sign-up appears here.</span></p>`;
    document.getElementById("search").addEventListener("input", renderTable);
    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    document.getElementById("signOut").addEventListener("click", () => { try { sessionStorage.removeItem(SESSION); } catch {} renderLogin(); });
    renderTable();
  }

  function renderTable() {
    const all = sorted();
    const today = new Date().toDateString();
    document.getElementById("t-total").textContent = all.length.toLocaleString("en-NG");
    document.getElementById("t-today").textContent = all.filter((p) => new Date(p.createdAt).toDateString() === today).length.toLocaleString("en-NG");
    document.getElementById("t-tag").textContent = all.filter((p) => p.tag).length.toLocaleString("en-NG");
    document.getElementById("exportBtn").disabled = all.length === 0;
    const wrap = document.getElementById("tableWrap");
    if (!all.length) {
      wrap.innerHTML = `<div class="empty"><i class="ph-duotone ph-coins" aria-hidden="true"></i><h2 class="display">No tickets yet</h2>
        <p>No coins yet. Sign-ups from the free ticket form appear here as soon as people submit it.</p>
        <a class="btn btn--pink btn--sm" href="index.html#ticket">Open the form</a>
        <button class="linkish" type="button" id="seed">Fill with test data</button></div>`;
      document.getElementById("seed").addEventListener("click", seed);
      return;
    }
    const q = document.getElementById("search").value.trim().toLowerCase();
    const rows = q ? all.filter((p) => [p.name, p.phone, p.tag, p.code].join(" ").toLowerCase().includes(q)) : all;
    wrap.innerHTML = `<table><thead><tr><th>Name</th><th>Phone</th><th>Bvndle tag</th><th>Ticket code</th><th>Claimed</th></tr></thead><tbody>${
      rows.length ? rows.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(window.formatNgPhone(p.phone))}</td><td>${p.tag ? "@" + esc(p.tag) : '<span class="muted">None</span>'}</td><td class="code">${esc(p.code)}</td><td class="muted">${fmt.format(new Date(p.createdAt))}</td></tr>`).join("")
      : `<tr><td colspan="5" class="muted" style="text-align:center;padding:36px">No sign-ups match "${esc(q)}".</td></tr>`}</tbody></table>`;
  }

  function csvCell(v) {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) && !/^\+234\d+$/.test(s) ? "'" + s : s; // stop spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  function exportCsv() {
    const lines = [["Name", "Phone", "Bvndle tag", "Ticket code", "Claimed at"]]
      .concat(sorted().map((p) => [p.name, p.phone, p.tag, p.code, p.createdAt]))
      .map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bvndle-free-passes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function seed() {
    const people = [["Adaeze Okafor", "+2348031234567", "adaeze"], ["Tunde Bakare", "+2348129876543", ""], ["Halima Yusuf", "+2347065512398", "halimay"],
      ["Kelechi Nwosu", "+2349018834421", ""], ["Bisola Adeyemi", "+2348024417730", "bisolaa"], ["Emeka Obi", "+2348167702215", "emekaobi"]];
    window.PassStore.replaceAll(people.map(([name, phone, tag], i) => ({ code: "BRF-TEST" + (i + 1), name, phone, tag, createdAt: new Date(Date.now() - i * 5.3e6).toISOString() })));
    renderTable();
  }

  window.addEventListener("storage", () => { if (document.getElementById("tableWrap")) renderTable(); });
  signedIn() ? renderDashboard() : renderLogin();
})();
