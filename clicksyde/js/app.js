/* Clicksyde: site shell + page behaviour.
   Every page sets <body data-page="home|wall|work|insights|about|talk">.
   The shell (header, story menu, dock, next-chapter link, footer) is built here so the
   chapters always link to each other in the same order. */
(function () {
  const D = window.CS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const page = document.body.dataset.page;
  const chapters = D.chapters;
  const idx = chapters.findIndex((c) => c.id === page);
  const current = chapters[idx];

  /* ---------- Brand mark (approximation of the logo: segmented ring + cursor) ---------- */
  const mark = (fg = "#FF4306", cursor = "currentColor") => `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="${fg}" stroke-width="15">
        <path d="M33.5 15.7A38 38 0 0 1 45 12.3"/><path d="M55 12.3A38 38 0 0 1 66.5 15.7"/>
        <path d="M74 21A38 38 0 0 1 74 79"/><path d="M66.5 84.3A38 38 0 0 1 55 87.7"/>
        <path d="M45 87.7A38 38 0 0 1 33.5 84.3"/><path d="M26 79A38 38 0 0 1 14 60"/>
        <path d="M14 40A38 38 0 0 1 26 21"/>
      </g>
      <path d="M38 44l23-3-13 20-2-11z" fill="${cursor}"/>
      <g stroke="${cursor}" stroke-width="2.6" stroke-linecap="round"><path d="M57 33l-1-4M63 35l2-4M66 40l4-1M64 46l3 2"/></g>
    </svg>`;
  window.CSmark = mark;

  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/></svg>',
    wall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>',
    work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4-4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
  };

  /* ---------- Header ---------- */
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html" aria-label="Clicksyde home">${mark()}<span>Clicksyde</span></a>
      ${current ? `<span class="chapter-tag">Chapter ${current.n} · <b>${esc(current.title)}</b></span>` : ""}
      ${page !== "talk" ? `<a class="btn btn-dark header-cta" href="start.html"><span class="dot"></span>Let's talk</a>` : `<span class="header-cta"></span>`}
      <button class="menu-btn" aria-label="Open the story menu" aria-expanded="false" aria-controls="story-menu"><span></span></button>
    </div>
    <div class="progress" aria-hidden="true"></div>`;
  document.body.prepend(header);

  /* ---------- Story menu: the table of contents of the storybook ---------- */
  const menu = document.createElement("nav");
  menu.className = "story-menu"; menu.id = "story-menu"; menu.setAttribute("aria-label", "Chapters");
  menu.innerHTML = `
    <div class="top"><a class="brand" href="index.html" style="color:#fff">${mark("#FF4306", "#fff")}<span>Clicksyde</span></a>
      <button class="close" aria-label="Close menu">✕</button></div>
    <ol>${chapters.map((c) => `
      <li><a href="${c.href}" ${c.id === page ? 'aria-current="page"' : ""}>
        <span class="num">${c.n}</span><span class="t">${esc(c.title)}</span><span class="num">${esc(c.stage)}</span>
        <span class="q">${esc(c.q)}</span></a></li>`).join("")}
    </ol>
    <div class="menu-foot">
      <a class="btn btn-brand" href="start.html">Book a discovery call <span class="arr">→</span></a>
      <a class="btn btn-ghost" href="mailto:${D.contact.email}">${D.contact.email}</a>
    </div>`;
  document.body.appendChild(menu);
  const menuBtn = $(".menu-btn", header);
  const setMenu = (open) => {
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $(".close", menu).focus(); else menuBtn.focus();
  };
  menuBtn.addEventListener("click", () => setMenu(true));
  $(".close", menu).addEventListener("click", () => setMenu(false));

  /* ---------- Dock ---------- */
  const dock = document.createElement("nav");
  dock.className = "dock"; dock.setAttribute("aria-label", "Main");
  dock.innerHTML = chapters.map((c) => `
    <a href="${c.href}" class="${c.id === "talk" ? "go" : ""}" ${c.id === page ? 'aria-current="page"' : ""} aria-label="${esc(c.label)}" title="${esc(c.label)}">
      ${icons[c.id]}<span class="lbl">${esc(c.label)}</span></a>`).join("");
  document.body.appendChild(dock);

  /* ---------- Turn the page: every chapter ends by pointing to the next one ---------- */
  const main = $("main");
  if (current && current.id !== "talk") {
    const next = chapters[idx + 1];
    const custom = $("[data-next-line]");
    const line = custom ? custom.dataset.nextLine : next.q;
    const turn = document.createElement("section");
    turn.className = "turn";
    turn.innerHTML = `<div class="wrap"><a href="${next.href}">
      <div><div class="k">Turn the page · Chapter ${next.n}</div>
      <div class="t">${esc(next.title)}</div><p class="s">${esc(line)}</p></div>
      <span class="circle" aria-hidden="true">→</span></a></div>`;
    main.appendChild(turn);
  }

  /* ---------- Footer ---------- */
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap">
    <div class="cols">
      <div><a class="brand" href="index.html">${mark()}<span>Clicksyde</span></a>
        <p class="muted" style="max-width:32ch;margin-top:14px">We make brands impossible to overlook.</p></div>
      <div><h4>The story</h4><ul>${chapters.map((c) => `<li><a href="${c.href}">${c.n} ${esc(c.title)}</a></li>`).join("")}</ul></div>
      <div><h4>Start</h4><ul>
        <li><a href="start.html#call">Book a discovery call</a></li>
        <li><a href="start.html">Request a proposal</a></li>
        <li><a href="mailto:${D.contact.email}">${D.contact.email}</a></li></ul></div>
      <div><h4>Follow</h4><ul>
        <li><a href="${D.contact.instagram}">Instagram</a></li><li><a href="${D.contact.linkedin}">LinkedIn</a></li>
        <li><a href="${D.contact.x}">X</a></li><li><a href="${D.contact.tiktok}">TikTok</a></li></ul></div>
    </div>
    <div class="legal"><span>© ${new Date().getFullYear()} Clicksyde. All rights reserved.</span><span>Made with too much coffee in Lagos.</span></div>
  </div>`;
  document.body.appendChild(footer);

  /* ---------- Global: Escape closes overlays, scroll progress, reveal on scroll ---------- */
  const overlays = [];
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (menu.classList.contains("open")) return setMenu(false);
    overlays.forEach((close) => close());
  });

  const bar = $(".progress", header);
  const darkHero = $(".hero");
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
    if (darkHero) header.classList.toggle("on-dark", scrollY < darkHero.offsetHeight - 80);
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  const observe = () => $$(".rv:not(.in)").forEach((el) => io.observe(el));

  /* count-up for numbers marked data-count */
  const countIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, raw = el.textContent, m = raw.match(/[\d.]+/);
    if (!m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = parseFloat(m[0]), dec = (m[0].split(".")[1] || "").length, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1200), v = (end * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      el.textContent = raw.replace(m[0], v);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });

  /* =====================================================
     Page renderers
     ===================================================== */
  const R = {};

  /* ----- 01 HOME ----- */
  R.home = () => {
    // Reel: use assets/reel.mp4 if present, otherwise the drifting frame wall
    const reel = $(".hero-reel");
    const cols = window.innerWidth >= 900 ? 5 : 3;
    let wall = '<div class="reel-wall" aria-hidden="true">';
    for (let c = 0; c < cols; c++) {
      const frames = D.reel.slice(c * 2).concat(D.reel.slice(0, c * 2)).slice(0, 5);
      const list = frames.concat(frames); // doubled for a seamless loop
      wall += `<div class="reel-col" style="animation-delay:${-c * 7}s">${list.map(([col, cap]) =>
        `<div class="frame" style="background:linear-gradient(160deg, ${col}, ${col}cc 60%, #161616)"><span>${esc(cap)}</span></div>`).join("")}</div>`;
    }
    reel.insertAdjacentHTML("afterbegin", wall + "</div>");
    const v = $("video", reel);
    if (v) {
      v.addEventListener("loadeddata", () => { $(".reel-wall", reel).remove(); }, { once: true });
      v.addEventListener("error", () => v.remove(), true);
      $$("source", v).forEach((s) => s.addEventListener("error", () => v.remove()));
    }

    // Logo slideshow
    const names = D.clients.map((n) => `<span>${esc(n)}</span>`).join("");
    $(".marquee-track").innerHTML = names + names;

    // One-liner lights up word by word as you scroll past it
    const ol = $(".oneliner p");
    ol.innerHTML = ol.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    const words = $$(".w", ol);
    const lightUp = () => {
      const r = ol.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      words.forEach((w, i) => w.classList.toggle("lit", i < p * words.length));
    };
    addEventListener("scroll", lightUp, { passive: true }); lightUp();

    // "Is this for me?" check
    const checks = $$(".check");
    const verdict = $(".fit-verdict");
    checks.forEach((b) => b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
      const n = checks.filter((c) => c.getAttribute("aria-pressed") === "true").length;
      verdict.classList.toggle("on", n > 0);
      $(".fit-text", verdict).textContent = n === 0 ? "Tick what sounds like you." : n === 1 ? "One is enough. We should talk." : `${n} out of ${checks.length}. We should definitely talk.`;
    }));
  };

  /* ----- 02 THE WALL ----- */
  R.wall = () => {
    const wall = $(".wall");
    wall.innerHTML = D.services.map((s, i) => `
      <button class="note rv rv-d${i % 3}" style="--c:${s.c};--rot:${s.rot}deg" data-id="${s.id}" data-cat="${s.cat}" aria-haspopup="dialog">
        <span class="no">${String(i + 1).padStart(2, "0")}</span><span class="tap" aria-hidden="true">+</span>
        <span class="nt">${esc(s.t)}</span><span class="ns">${esc(s.s)}</span>
      </button>`).join("");

    // the open note
    const wrap = $(".sheet-wrap");
    const sheet = $(".sheet", wrap);
    let open = -1, opener = null;
    const show = (i) => {
      open = (i + D.services.length) % D.services.length;
      const s = D.services[open];
      sheet.style.setProperty("--c", s.c);
      sheet.innerHTML = `<button class="x" aria-label="Close">✕</button>
        <span class="no" style="font-weight:700;opacity:.55">${String(open + 1).padStart(2, "0")} / ${String(D.services.length).padStart(2, "0")}</span>
        <h3 id="sheet-title">${esc(s.t)}</h3><div class="ns">${esc(s.s)}</div>
        <p class="body">${esc(s.body)}</p>
        <h4>What you get</h4><ul>${s.get.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
        <h4>Great for</h4><div class="tags">${s.for.map((g) => `<span>${esc(g)}</span>`).join("")}</div>
        <div class="acts"><a class="btn btn-dark" href="start.html?service=${s.id}">I need this <span class="arr">→</span></a>
          <a class="btn btn-ghost" href="work.html">See it in action</a></div>
        <div class="nav"><button data-go="-1">← Previous note</button><button data-go="1">Next note →</button></div>`;
      $(".x", sheet).onclick = hide;
      $$("[data-go]", sheet).forEach((b) => (b.onclick = () => show(open + Number(b.dataset.go))));
      wrap.classList.add("open"); document.body.style.overflow = "hidden";
      history.replaceState(null, "", "#" + s.id);
      $(".x", sheet).focus();
    };
    const hide = () => {
      if (!wrap.classList.contains("open")) return;
      wrap.classList.remove("open"); document.body.style.overflow = "";
      history.replaceState(null, "", location.pathname + location.search);
      if (opener) opener.focus();
    };
    overlays.push(hide);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) hide(); });
    wall.addEventListener("click", (e) => {
      const n = e.target.closest(".note"); if (!n) return;
      opener = n; show(D.services.findIndex((s) => s.id === n.dataset.id));
    });
    const fromHash = D.services.findIndex((s) => "#" + s.id === location.hash);
    if (fromHash > -1) setTimeout(() => show(fromHash), 400);

    // problem finder highlights the notes that solve it
    const finder = $(".finder");
    finder.innerHTML = D.problems.map((p, i) => `<button class="prob" data-i="${i}"><span>${esc(p.p)}<small>${esc(p.h)}</small></span><span aria-hidden="true">↗</span></button>`).join("");
    const chips = $(".filters");
    chips.innerHTML = `<button class="chip" aria-pressed="true" data-f="all">Everything</button>` +
      D.problems.map((p, i) => `<button class="chip" aria-pressed="false" data-f="${i}">${esc(p.h)}</button>`).join("");
    const filter = (f) => {
      $$(".chip", chips).forEach((c) => c.setAttribute("aria-pressed", c.dataset.f === String(f)));
      const ids = f === "all" ? null : D.problems[f].ids;
      $$(".note", wall).forEach((n) => n.classList.toggle("dim", !!ids && !ids.includes(n.dataset.id)));
    };
    chips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) filter(c.dataset.f); });
    finder.addEventListener("click", (e) => {
      const b = e.target.closest(".prob"); if (!b) return;
      filter(Number(b.dataset.i));
      $(".wall-sec").scrollIntoView({ behavior: "smooth" });
    });
  };

  /* ----- 03 WORK: feed of case studies, each followed by the client's comments ----- */
  R.work = () => {
    const liked = new Set(JSON.parse(safeGet("cs-likes") || "[]"));
    $(".jump").innerHTML = D.cases.map((c) => `
      <a href="#${c.id}"><span class="th" style="background:linear-gradient(135deg, ${c.slides[0][0]}, ${c.color})"></span>
      <span><b>${esc(c.client)}</b><small>${esc(c.sub)}</small></span><span aria-hidden="true">↓</span></a>`).join("");

    const cats = [["all", "All work"], ["feedback", "Customer feedback"], ["ads", "Performance"], ["show", "Content & activations"]];
    $(".feed-filters").innerHTML = cats.map(([k, l], i) => `<button class="chip" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join("");

    $(".feed").innerHTML = D.cases.map((c, ci) => `
      <article class="case rv" id="${c.id}" data-cat="${c.cat}">
        <div class="carousel">
          <div class="slides" tabindex="0" aria-label="${esc(c.client)} images">${c.slides.map(([col, cap, big]) => `
            <div class="slide" style="background:linear-gradient(150deg, ${col}, #161616 140%)">
              <div class="big">${esc(big).replace(/\n/g, "<br>")}</div><span class="cap">${esc(cap)}</span></div>`).join("")}
          </div>
          <div class="dots">${c.slides.map((_, i) => `<button aria-label="Image ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>
        </div>
        <div class="case-body">
          <div class="byline">
            <div class="avatars"><span>${mark("#fff", "#fff")}</span><span style="background:${c.color}">${esc(c.initials)}</span></div>
            <div><b>clicksyde</b><span class="verified" aria-label="verified">✓</span><span class="with">with</span> <b>${esc(c.client)}</b>
              <div class="meta">${c.tags.map(esc).join(" · ")}</div></div>
          </div>
          <h2>${esc(c.title)}</h2><p class="sub">${esc(c.sub)}</p>
          <div class="stats">${c.stats.map(([ic, n, l, hot]) => `<div class="stat ${hot ? "hot" : ""}"><span class="ic" aria-hidden="true">${ic}</span><b data-count>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div>
          <button class="btn story-toggle" aria-expanded="false" aria-controls="story-${ci}">Read the full story <span aria-hidden="true">＋</span></button>
          <div class="story" id="story-${ci}"><div>${c.story.map(([h, p]) => `<div class="chunk"><h4>${esc(h)}</h4><p>${esc(p)}</p></div>`).join("")}</div></div>
        </div>
        <div class="thread" aria-label="Client feedback">
          <div class="th-head"><span>💬 ${c.comments.length} ${c.comments.length === 1 ? "comment" : "comments"} from the client</span><span>Most relevant ▾</span></div>
          ${c.comments.map((m, mi) => {
            const key = c.id + mi, on = liked.has(key);
            return `<div class="comment ${m.reply ? "reply" : ""}">
              <div class="av" style="background:${m.brand ? "var(--brand)" : m.color}">${m.brand ? mark("#fff", "#fff") : esc(m.initials)}</div>
              <div><div class="who"><b>${esc(m.who)}</b><span class="role">${esc(m.role)}</span>${m.pinned ? '<span class="pin">📌 Pinned</span>' : ""}</div>
                <p class="said">${esc(m.said)}</p>
                <button class="like" data-key="${key}" data-n="${m.likes}" aria-pressed="${on}">${icons.heart}<span>${on ? m.likes + 1 : m.likes}</span> Like</button></div>
            </div>`; }).join("")}
          <div class="add-comment"><a href="start.html">Want a comment like this? Start your project →</a></div>
        </div>
      </article>`).join("");

    // carousel dots follow the swipe
    $$(".carousel").forEach((car) => {
      const track = $(".slides", car), dots = $$(".dots button", car);
      track.addEventListener("scroll", () => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, j) => d.setAttribute("aria-current", i === j));
      }, { passive: true });
      dots.forEach((d, j) => d.addEventListener("click", () => track.scrollTo({ left: j * track.clientWidth, behavior: "smooth" })));
    });
    $$(".story-toggle").forEach((b) => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", open);
      $("#" + b.getAttribute("aria-controls")).classList.toggle("open", open);
      b.lastElementChild.textContent = open ? "−" : "＋";
    }));
    $$(".like").forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      $("span", b).textContent = Number(b.dataset.n) + (on ? 1 : 0);
      on ? liked.add(b.dataset.key) : liked.delete(b.dataset.key);
      safeSet("cs-likes", JSON.stringify([...liked]));
    }));
    $(".feed-filters").addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      $$(".feed-filters .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      $$(".case").forEach((a) => (a.style.display = c.dataset.f === "all" || a.dataset.cat === c.dataset.f ? "" : "none"));
    });
  };

  /* ----- 04 INSIGHTS ----- */
  R.insights = () => {
    const f = D.posts.find((p) => p.featured) || D.posts[0];
    const meta = (p) => `<div class="post-meta"><span class="cat">${esc(p.cat)}</span><span>${p.mins} min read</span><span>·</span><span>${esc(p.date)}</span></div>`;
    $(".featured-slot").innerHTML = `<button class="featured rv" data-id="${f.id}">
      <div class="art" style="background:${f.color}"><span class="big">${esc(f.art)}</span></div>
      <div class="txt">${meta(f)}<h2>${esc(f.title)}</h2><p class="muted" style="margin:0">${esc(f.ex)}</p>
      <span class="btn btn-dark" style="align-self:flex-start;margin-top:8px">Read it <span class="arr">→</span></span></div></button>`;
    const rest = D.posts.filter((p) => p !== f);
    const cats = ["All", ...new Set(D.posts.map((p) => p.cat))];
    $(".feed-filters").innerHTML = cats.map((c, i) => `<button class="chip" data-f="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("");
    $(".posts").innerHTML = rest.map((p, i) => `<button class="post rv rv-d${i % 3}" data-id="${p.id}" data-cat="${esc(p.cat)}">
      <div class="art" style="background:${p.color}">${esc(p.art)}</div>
      <div class="txt">${meta(p)}<h3>${esc(p.title)}</h3><p>${esc(p.ex)}</p></div></button>`).join("");
    $(".feed-filters").addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      $$(".feed-filters .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      $$(".post").forEach((p) => p.classList.toggle("hide", c.dataset.f !== "All" && p.dataset.cat !== c.dataset.f));
    });

    // reader
    const reader = $(".reader");
    let opener = null;
    const open = (id) => {
      const p = D.posts.find((x) => x.id === id);
      const body = p.body || [["p", p.ex], ["p", "PLACEHOLDER: this article is still being written. The content team adds the full text in js/data.js (posts → body)."]];
      $("article", reader).innerHTML = `${meta(p)}<h1>${esc(p.title)}</h1>` + body.map(([t, x]) =>
        t === "h" ? `<h2>${esc(x)}</h2>` : t === "q" ? `<blockquote>${esc(x)}</blockquote>` : `<p>${esc(x)}</p>`).join("") +
        `<div class="end"><h3 style="font-size:28px">Want this kind of thinking on your brand?</h3>
          <p>Get the next one in your inbox, or let's talk about your business.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-brand" href="start.html">Let's talk →</a><a class="btn btn-light" href="#newsletter" data-close>Join the newsletter</a></div></div>`;
      reader.classList.add("open"); reader.scrollTop = 0; document.body.style.overflow = "hidden";
      history.replaceState(null, "", "#" + p.id);
      $(".bar button", reader).focus();
    };
    const close = () => {
      if (!reader.classList.contains("open")) return;
      reader.classList.remove("open"); document.body.style.overflow = "";
      history.replaceState(null, "", location.pathname);
      if (opener) opener.focus();
    };
    overlays.push(close);
    $(".bar button", reader).addEventListener("click", close);
    reader.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".post, .featured"); if (!b) return;
      opener = b; open(b.dataset.id);
    });
    const h = D.posts.find((p) => "#" + p.id === location.hash);
    if (h) setTimeout(() => open(h.id), 300);

  };

  function newsletter() {
    const form = $(".nl-form"); if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("input", form).value.trim(), note = $(".nl-note");
      if (!/^\S+@\S+\.\S+$/.test(email)) { note.textContent = "That email doesn't look right. Try again?"; return; }
      await sendLead({ type: "newsletter", email });
      form.innerHTML = `<span style="padding:12px 16px;color:var(--ink);font-weight:600">You're on the list. First issue lands soon ✉️</span>`;
      note.textContent = "";
    });
  }

  /* ----- 05 ABOUT ----- */
  R.about = () => {
    // typed answer to "like what exactly?"
    const t = $(".typed");
    const words = ["our favourite food?", "our favourite colour?", "why we're called Clicksyde?", "who's on the team?"];
    let wi = 0, ci = 0, del = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const type = () => {
      const w = words[wi];
      t.textContent = w.slice(0, ci);
      if (!del && ci < w.length) ci++; else if (!del) { del = true; return setTimeout(type, 1600); }
      else if (ci > 0) ci--; else { del = false; wi = (wi + 1) % words.length; }
      setTimeout(type, del ? 30 : 60);
    };
    if (reduce) t.textContent = words[0]; else type();

    $(".facts").innerHTML = D.facts.map((f, i) => `<button class="fact rv rv-d${i % 3}" aria-pressed="false">
      <div class="inner"><div class="face front"><small>${esc(f.tag)}</small><span class="flip">Tap to flip ↻</span><div class="qq">${esc(f.q)}</div></div>
      <div class="face back"><small>${esc(f.q)}</small><div class="a">${esc(f.a)}</div></div></div></button>`).join("");
    $$(".fact").forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true")));

    $(".chapters-story").innerHTML = D.timeline.map(([y, h, p]) => `<div class="cs rv"><div class="yr">${esc(y)}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("");
    $(".values").innerHTML = D.values.map(([i, h, p]) => `<div class="value rv"><div class="ico" aria-hidden="true">${i}</div><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`).join("");
    $(".team").innerHTML = D.team.map((m) => `<div class="member rv"><div style="overflow:hidden"><div class="ph" style="background:${m.c}">${esc(m.n.split(" ").map((x) => x[0]).join("").slice(0, 2))}</div></div>
      <div class="tx"><b>${esc(m.n)}</b><span>${esc(m.r)}</span><span class="odd">${esc(m.odd)}</span></div></div>`).join("");
  };

  /* ----- 06 LET'S TALK: 4 short questions as a chat ----- */
  R.talk = () => {
    const Q = D.questions;
    const params = new URLSearchParams(location.search);
    const pre = D.services.find((s) => s.id === params.get("service"));
    const ans = { need: [], budget: "", when: "", name: "", business: "", contact: "", about: "", service: pre ? pre.t : "" };
    $("[data-mark]").innerHTML = mark("#fff", "#fff");
    $("[data-cal]").href = D.contact.calendly;
    $("[data-mail]").href = "mailto:" + D.contact.email;
    $("[data-mail-text]").textContent = D.contact.email;
    const body = $(".convo-body");
    const bars = $$(".qbar i");
    const steps = ["need", "who", "budget", "reach"];
    const setBar = (n) => bars.forEach((b, i) => b.classList.toggle("on", i < n));

    const say = (html, qn) => { body.insertAdjacentHTML("beforeend", `<div class="bubble us">${qn ? `<span class="qn">${qn}</span>` : ""}${html}</div>`); };
    const reply = (text, stepIdx) => {
      body.insertAdjacentHTML("beforeend", `<div class="bubble them">${esc(text)}<button data-edit="${stepIdx}">edit</button></div>`);
    };
    const scroll = () => { const last = body.lastElementChild; if (last && last.getBoundingClientRect().bottom > innerHeight - 110) last.scrollIntoView({ behavior: "smooth", block: "center" }); };

    const render = (from) => {
      body.innerHTML = "";
      say(`Hey 👋 We'll keep this short: <b>4 quick questions</b>, about a minute.${pre ? ` We see you're interested in <b>${esc(pre.t)}</b>.` : ""}`);
      for (let i = 0; i < steps.length; i++) {
        if (i < from) { ask(i, true); continue; }
        ask(i, false); break;
      }
      setBar(from);
    };

    const ask = (i, answered) => {
      const s = steps[i];
      if (s === "need") {
        say("What do you need help with? Pick as many as you like.", "1 of 4");
        if (answered) return reply(ans.need.join(", "), i);
        const pane = answer(`<div class="opts">${Q.need.map((o) => `<button class="opt" aria-pressed="${ans.need.includes(o)}">${esc(o)}</button>`).join("")}</div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $$(".opt", pane).forEach((b) => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"));
        $("[data-next]", pane).onclick = () => {
          ans.need = $$(".opt[aria-pressed=true]", pane).map((b) => b.textContent);
          if (!ans.need.length) return ($(".err", pane).textContent = "Pick at least one.");
          render(1);
        };
      }
      if (s === "who") {
        say("Nice. Who are we talking to? Tell us about you and your business, like you'd text a friend.", "2 of 4");
        if (answered) return reply(`${ans.name}, ${ans.business}${ans.about ? ` · “${ans.about}”` : ""}`, i);
        const pane = answer(`<div class="row2"><div class="field"><label for="f-name">Your name</label><input id="f-name" autocomplete="name" value="${esc(ans.name)}"></div>
          <div class="field"><label for="f-biz">Business or brand</label><input id="f-biz" autocomplete="organization" value="${esc(ans.business)}"></div></div>
          <div class="field"><label for="f-about">Anything we should know? <span class="muted">(optional, one line is fine)</span></label>
          <textarea id="f-about" rows="2" placeholder="e.g. We sell skincare online and want to open a store in Abuja">${esc(ans.about)}</textarea></div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $("#f-name", pane).focus({ preventScroll: true });
        $("[data-next]", pane).onclick = () => {
          ans.name = $("#f-name", pane).value.trim(); ans.business = $("#f-biz", pane).value.trim(); ans.about = $("#f-about", pane).value.trim();
          if (!ans.name || !ans.business) return ($(".err", pane).textContent = "Just your name and business, please.");
          render(2);
        };
      }
      if (s === "budget") {
        say(`Thanks, ${esc(ans.name.split(" ")[0])}! Roughly what budget and timeline are you working with? No wrong answers, it just helps us plan.`, "3 of 4");
        if (answered) return reply(`${ans.budget} · ${ans.when}`, i);
        const pane = answer(`<div class="opts" data-g="budget">${Q.budget.map((o) => `<button class="opt" aria-pressed="${ans.budget === o}">${esc(o)}</button>`).join("")}</div>
          <div class="opts" data-g="when" style="margin-top:6px">${Q.when.map((o) => `<button class="opt" aria-pressed="${ans.when === o}">${esc(o)}</button>`).join("")}</div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $$(".opts", pane).forEach((g) => g.addEventListener("click", (e) => {
          const b = e.target.closest(".opt"); if (!b) return;
          $$(".opt", g).forEach((x) => x.setAttribute("aria-pressed", x === b));
          ans[g.dataset.g] = b.textContent;
        }));
        $("[data-next]", pane).onclick = () => {
          if (!ans.budget || !ans.when) return ($(".err", pane).textContent = "Pick one of each.");
          render(3);
        };
      }
      if (s === "reach") {
        say("Last one. Where can we reach you? We reply within one working day.", "4 of 4");
        const pane = answer(`<div class="field"><label for="f-contact">Email or WhatsApp number</label><input id="f-contact" autocomplete="email" value="${esc(ans.contact)}" placeholder="you@brand.com or 0801 234 5678"></div>
          <div class="go-row"><span class="err"></span><button class="btn btn-brand" data-next>Send it <span class="arr">→</span></button></div>`);
        $("[data-next]", pane).onclick = async () => {
          ans.contact = $("#f-contact", pane).value.trim();
          const okEmail = /^\S+@\S+\.\S+$/.test(ans.contact), okPhone = ans.contact.replace(/\D/g, "").length >= 10;
          if (!okEmail && !okPhone) return ($(".err", pane).textContent = "That doesn't look like an email or phone number.");
          pane.remove(); reply(ans.contact, 3); setBar(4);
          await sendLead({ type: "proposal", ...ans, need: ans.need.join(", ") });
          done();
        };
      }
      scroll();
    };

    const answer = (html) => { body.insertAdjacentHTML("beforeend", `<div class="answer">${html}</div>`); return body.lastElementChild; };

    const done = () => {
      const summary = `Hi Clicksyde! I'm ${ans.name} from ${ans.business}.\nI need: ${ans.need.join(", ")}${ans.service ? ` (${ans.service})` : ""}\nBudget: ${ans.budget}\nTimeline: ${ans.when}\nReach me: ${ans.contact}${ans.about ? `\nAbout us: ${ans.about}` : ""}`;
      const wa = D.contact.whatsapp ? `https://wa.me/${D.contact.whatsapp}?text=${encodeURIComponent(summary)}` : "";
      const mail = `mailto:${D.contact.email}?subject=${encodeURIComponent("New project: " + ans.business)}&body=${encodeURIComponent(summary)}`;
      body.insertAdjacentHTML("beforeend", `<div class="done-card">
        <h3>Got it, ${esc(ans.name.split(" ")[0])} 🎉</h3>
        <p>Here's what happens next:</p>
        <ol><li>A strategist reads this today and replies within one working day.</li>
          <li>A 30-minute discovery call to understand your goals.</li>
          <li>A proposal with a plan, timeline and price, within 5 working days.</li></ol>
        <div class="acts">${D.contact.formEndpoint ? "" : `<a class="btn btn-brand" href="${mail}">Send it by email</a>`}
          ${wa ? `<a class="btn btn-light" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}
          <a class="btn btn-light" href="${D.contact.calendly}">Book the call now</a></div>
      </div>`);
      scroll();
    };

    body.addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b && !$(".done-card", body)) render(Number(b.dataset.edit)); });
    render(0);
  };

  /* Lead hand-off: posts to formEndpoint when set; otherwise the visitor sends it by email/WhatsApp from the done card */
  async function sendLead(data) {
    if (!D.contact.formEndpoint) return;
    try {
      await fetch(D.contact.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ ...data, page: location.pathname, at: new Date().toISOString() }) });
    } catch (_) { /* the done card still offers email/WhatsApp */ }
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  if (R[page]) R[page]();
  newsletter();
  observe();
  $$("[data-count]").forEach((el) => countIO.observe(el));
})();
