/* Event settings and pass storage, shared by the landing page and the admin page.
   Change event details here only. */
window.BRF = {
  // TODO: confirm dates with the client. The voice note says 11-12 Dec, the old site says 10-11 Dec.
  eventStart: "2026-12-11T12:00:00+01:00",
  datesLabel: "11th – 12th December 2026",   // client wording, 23 Oct
  shortDates: "11th – 12th Dec",
  venue: "Landmark Event Centre, Lagos",

  tixUrl: "https://tix.africa/discover/bvndlerewardfestival2026",
  partnerUrl: "https://forms.gle/rPUGVDK9qsWDw4ij7?utm_source=web&utm_medium=landing+page&utm_campaign=BRF+2026",
  galleryUrl: "https://bvndleincorporated.pixieset.com/bvndlerewardsfestival/",
};

/* Supabase project for the free tickets (Bvndle Go). The publishable key is meant to be public:
   the database only lets visitors claim a ticket and read the total. Everything else needs an admin login. */
window.BRF_DB = {
  url: "https://jyqakzduwtnymmaplnfa.supabase.co",
  key: "sb_publishable_XAKiJE8pip0lTq-HBUbQtA_IUNNPQez",
};

/* Free ticket storage, backed by Supabase (supabase/migrations in this repo).
   claim() -> { ok, isNew, pass } or { ok: false, error } where error is one of:
   invalid_phone, invalid_email, missing_tag, email_taken, phone_taken, network. */
window.PassStore = (() => {
  const { url, key } = window.BRF_DB;
  let total = 0;

  async function rpc(name, body) {
    let res;
    try {
      res = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    } catch (e) {
      throw Object.assign(new Error("network"), { code: "network" });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = data && data.code === "P0001" ? data.message : "network";
      throw Object.assign(new Error(code), { code });
    }
    return data;
  }

  function source() {
    const q = new URLSearchParams(location.search);
    const utm = ["utm_source", "utm_medium", "utm_campaign"].map((k) => q.get(k)).filter(Boolean).join(" / ");
    if (utm) return utm.slice(0, 120);
    try { return document.referrer ? new URL(document.referrer).hostname : "direct"; } catch (e) { return "direct"; }
  }

  return {
    count: () => total,
    async refreshCount() {
      try { total = Number(await rpc("free_pass_count")) || 0; } catch (e) {}
      return total;
    },
    async claim({ first, last, email, phone, tag }) {
      try {
        const r = await rpc("claim_free_pass", {
          p_first_name: first, p_last_name: last, p_email: email, p_phone: phone,
          p_has_tag: !!tag, p_tag: tag || null, p_source: source(),
        });
        if (!r.existing) total += 1;
        return { ok: true, isNew: !r.existing, pass: { code: r.pass_code, name: `${first} ${last}`.trim(), first, last, email, phone, tag: tag || "", token: r.token } };
      } catch (e) {
        return { ok: false, error: e.code || "network" };
      }
    },
    /* 1 Million Questions, marked on the server. Each call resolves to { ok, data } or { ok: false, error }. */
    trivia: {
      status: (token) => call("trivia_status", { p_token: token }),
      next: (token) => call("trivia_next", { p_token: token }),
      answer: (token, id, choice) => call("trivia_answer", { p_token: token, p_question_id: id, p_choice: choice }),
    },
    /* Rewards across every game: my_rewards -> wallet totals; claim -> one-off activity reward (once per ticket). */
    rewards: {
      mine: (token) => call("my_rewards", { p_token: token }),
      claim: (token, activity, proof) => call("claim_activity_reward", { p_token: token, p_activity: activity, p_proof: proof || null }),
    },
  };

  async function call(name, body) {
    try { return { ok: true, data: await rpc(name, body) }; } catch (e) { return { ok: false, error: e.code || "network" }; }
  }
})();

/* Nigerian phone numbers: accepts 080..., 8012..., +234..., 234... and returns +234XXXXXXXXXX or null. */
window.normalizeNgPhone = (input) => {
  const digits = String(input).replace(/\D/g, "");
  let local = null;
  if (digits.startsWith("234") && digits.length === 13) local = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 11) local = digits.slice(1);
  else if (digits.length === 10 && /^[789]/.test(digits)) local = digits;
  if (!local || !/^[789][01]\d{8}$/.test(local)) return null;
  return "+234" + local;
};

window.formatNgPhone = (p) => p.replace(/^\+234(\d{3})(\d{3})(\d{4})$/, "+234 $1 $2 $3");
