/* Event settings and pass storage, shared by the landing page and the admin page.
   Change event details here only. */
window.BRF = {
  // TODO: confirm dates with the client. The voice note says 11-12 Dec, the old site says 10-11 Dec.
  eventStart: "2026-12-11T12:00:00+01:00",
  datesLabel: "11th – 12th December 2026",   // client wording, 23 Oct
  shortDates: "11th – 12th Dec",
  venue: "Landmark Event Centre, Lagos",
  // TODO: replace with the real TIX event link once tickets are live.
  tixUrl: "https://tix.africa/",
  partnerUrl: "https://forms.gle/rPUGVDK9qsWDw4ij7?utm_source=web&utm_medium=landing+page&utm_campaign=BRF+2026",
  galleryUrl: "https://bvndleincorporated.pixieset.com/bvndlerewardsfestival/",
};

/* Prototype storage: sign-ups live in this browser's localStorage only.
   Before launch, swap these functions for calls to a real backend.
   count() becomes the public, read-only endpoint that drives the tree lights. */
window.PassStore = (() => {
  const KEY = "brf_passes_v1";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  function makeCode() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return "BRF-" + code;
  }

  return {
    all: read,
    count: () => read().length,
    findByPhone(phone) {
      return read().find((p) => p.phone === phone) || null;
    },
    add({ name, first, last, phone, tag }) {
      const list = read();
      const existing = list.find((p) => p.phone === phone);
      if (existing) return { pass: existing, isNew: false, saved: true };
      const pass = { code: makeCode(), name, first: first || "", last: last || "", phone, tag: tag || "", createdAt: new Date().toISOString() };
      list.push(pass);
      return { pass, isNew: true, saved: write(list) };
    },
    replaceAll(list) {
      return write(list);
    },
  };
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
