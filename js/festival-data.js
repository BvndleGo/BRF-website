/* Festival content for the v4 sections. Everything marked PLACEHOLDER waits for the client's answers
   (see guide/DIRECTION-v4.md, "Questions for the client"). Change it here; no other file needs to change. */
window.BRF_DATA = {
  /* ---- 2. Guess the headliners ---- */
  lineup: {
    // 2025 artists. photo: an image path, or null to show a lettered placeholder card until a portrait is approved
    past: [
      { name: "Yinka Ayefele", photo: "assets/img/concert/c03.jpg" },
      { name: "Mavo", photo: null },
      { name: "Segun Johnson", photo: "assets/img/zones/performance-5.jpg" },
      { name: "Fola", photo: null },                      // client, 22 Oct: "Fola instead of Dave"
      { name: "Zerry DL", photo: null },                  // client, 23 Oct ("Zerry DL ni o")
    ],
    // 2026 headliners stay hidden. Clues unlock on their date (YYYY-MM-DD); locked clues show the date only.
    mystery: [
      { clues: [["2026-11-01", "PLACEHOLDER clue: Lagos-born"], ["2026-11-15", "PLACEHOLDER clue: a 2025 hit"], ["2026-11-29", "PLACEHOLDER clue: first time at Bvndle"]] },
      { clues: [["2026-11-05", "PLACEHOLDER clue"], ["2026-11-19", "PLACEHOLDER clue"], ["2026-12-03", "PLACEHOLDER clue"]] },
      { clues: [["2026-11-08", "PLACEHOLDER clue"], ["2026-11-22", "PLACEHOLDER clue"], ["2026-12-06", "PLACEHOLDER clue"]] },
    ],
    revealLabel: "Reveal soon",                           // PLACEHOLDER: reveal date, e.g. "Revealed 7 December"
  },

  /* ---- 5. The journey: five zones, one after another. Every zone runs the same four steps:
     Meet (the vendors and brands in that zone), Interact (try, play, engage), Watch (their live showcase or demo),
     Redeem (cash in that zone's coins at its own booth; its passport stamp lands).
     PLACEHOLDER: the wording of each step and the coin values until the client confirms vendors per zone.
     photos: assets/img/zones/<set>-<n>.jpg ---- */
  journey: [
    // prize: the amount to be won in that zone (client, 22 Oct). null shows "Prize to be announced".
    { name: "Creative / Alte", color: "#FF3E8E", text: "#111", icon: "ph-palette", set: "music", prize: "₦2m",   // PLACEHOLDER prize (Paul, 23 Oct)
      line: "Art, style and the alte crowd: fashion labels, artists and creative brands.",
      steps: [
        { t: "Meet the makers", d: "Fashion labels, artists and creative brands, each at their own stall.", coins: 30, img: 2 },
        { t: "Get hands-on", d: "Paint the mural, try on the drops, get styled on the spot.", coins: 50, img: 5 },
        { t: "Watch the showcase", d: "Runway moments and live art from the vendors on the zone stage.", coins: 40, img: 8 },
        { t: "Cash in here", d: "Cash in your Creative coins for prints, merch and fashion drops.", redeem: true, img: 6 } ] },
    { name: "Connection", color: "#2e4bff", text: "#fff", icon: "ph-handshake", set: "stage", prize: "₦50m",
      line: "Brands, creators and new people: talks, meet-ups and real conversations.",
      steps: [
        { t: "Meet the brands", d: "The brands that reward you all year, in person and ready to talk.", coins: 30, img: 1 },
        { t: "Get involved", d: "Speed-friending, Q&A and quick brand missions. Swap tags, earn coins.", coins: 50, img: 4 },
        { t: "Watch the talks", d: "Founders and creators on stage: money, music and Lagos life.", coins: 40, img: 6 },
        { t: "Cash in here", d: "Swap your Connection coins for vouchers and brand hampers.", redeem: true, img: 8 } ] },
    { name: "Escape", color: "#8B80F9", text: "#111", icon: "ph-umbrella-simple", set: "funtime", prize: "₦60m",
      line: "Slow down: lounges, food and drink vendors, games you can play lying down.",
      steps: [
        { t: "Meet the vendors", d: "Food, drinks and lifestyle brands set up around the lounge.", coins: 30, img: 1 },
        { t: "Taste and play", d: "Tasting trails, silent disco and mini games at the stalls.", coins: 40, img: 6 },
        { t: "Watch the show", d: "Live cook-offs and product demos from the vendors.", coins: 40, img: 3 },
        { t: "Cash in here", d: "Cash in your Escape coins for treats, hampers and gift cards.", redeem: true, img: 7 } ] },
    { name: "Wealth", color: "#FFD23F", text: "#111", icon: "ph-piggy-bank", set: "missions", prize: "₦40m",
      line: "Banks, fintechs and money brands: games that teach you to stack.",
      steps: [
        { t: "Meet the money brands", d: "Banks, fintechs and investment apps, side by side.", coins: 30, img: 1 },
        { t: "Play the money games", d: "Savings challenge, spin the wheel, sign-up missions.", coins: 60, img: 2 },
        { t: "Watch the demos", d: "Live walkthroughs: send, save and invest in under a minute.", coins: 40, img: 3 },
        { t: "Cash in here", d: "Swap your Wealth coins for gadgets and cash prizes at the zone booth.", redeem: true, img: 4 } ] },
    { name: "Adrenaline", color: "#FF5A2D", text: "#111", icon: "ph-lightning", set: "games", prize: "₦1m",   // PLACEHOLDER prize (Paul, 23 Oct)
      line: "Gaming and sports brands, live challenges and 1 Million Questions rounds.",
      steps: [
        { t: "Meet the game brands", d: "Gaming, sports and drinks brands with their challenges ready.", coins: 30, img: 1 },
        { t: "Take the challenge", d: "Beat the clock, win the round, play 1 Million Questions for draw entries.", coins: 80, img: 2 },
        { t: "Watch the battles", d: "Dance-offs and head-to-head finals on the zone floor.", coins: 40, img: 5 },
        { t: "Cash in here", d: "Your last booth: cash in every coin for appliances, gadgets and cash.", redeem: true, img: 6 } ] },
  ],

  /* ---- 5. The festival floor (client 23 Oct). The client's isometric floor plan, recoloured with the zone colours
     from `journey` above. Visitors walk its dashed route station by station.
     stations: n, name and x_pct / y_pct are the client's own list (position as % of the drawing).
     zone: index into `journey` (decided by the colour of the area the station stands on).
     PLACEHOLDER: does (what happens there), coins and img until the client sends the real station copy. ---- */
  floor: {
    art: "assets/floor/floor.svg?v=2",
    view: [39, 62, 1251, 596],          // the drawing's own viewBox: x, y, width, height
    stations: [
      { n: "01", name: "Passport Desk", x_pct: 20.03, y_pct: 23.05, zone: 0, coins: 20, img: 2, does: "Pick up your festival passport. Every zone stamps it as you go." },
      { n: "02", name: "The Vault \u00b7 west", x_pct: 39.14, y_pct: 41.29, zone: 3, coins: 50, img: 2, does: "Crack the vault challenge for a share of the zone's prize pot." },
      { n: "03", name: "Licence Bar", x_pct: 38.66, y_pct: 15.29, zone: 0, coins: 30, img: 5, does: "Earn your trading licence with a two-minute money quiz." },
      { n: "04", name: "Order Desk", x_pct: 23.37, y_pct: 32.63, zone: 0, coins: 30, img: 8, does: "Place your first order with the coins you have earned so far." },
      { n: "05", name: "Trading Floor and Bell Stage", x_pct: 52.51, y_pct: 17.6, zone: 2, coins: 80, img: 3, does: "Trade live on the floor. The top traders ring the bell on stage." },
      { n: "06", name: "OTC Desk", x_pct: 31.81, y_pct: 41.63, zone: 3, coins: 30, img: 1, does: "Swap coins and vouchers one-to-one with the brands." },
      { n: "07", name: "Featured Stocks Wall", x_pct: 56.97, y_pct: 50.5, zone: 2, coins: 40, img: 6, does: "See which brands are trending today and back your pick." },
      { n: "08", name: "The Vault \u00b7 east", x_pct: 46.46, y_pct: 53, zone: 3, coins: 60, img: 4, does: "The big vault: cash in your coins for gadgets and cash prizes." },
      { n: "09", name: "Wealth Lounge", x_pct: 81.97, y_pct: 48.41, zone: 4, coins: 30, img: 1, does: "Sit down with the money brands: saving, investing and insurance." },
      { n: "10", name: "Global Gateway", x_pct: 88.5, y_pct: 58.19, zone: 4, coins: 40, img: 2, does: "Send, spend and save across borders with the fintechs." },
      { n: "11", name: "Sentiment Pit", x_pct: 74.8, y_pct: 69.13, zone: 4, coins: 60, img: 5, does: "Call the crowd's mood. Get it right and win coins on the spot." },
      { n: "12", name: "Connections Wall", x_pct: 64.93, y_pct: 59.58, zone: 1, coins: 30, img: 4, does: "Swap Bvndle tags, meet people and add yourself to the wall." },
    ],
  },

  /* ---- 5c. Main stage programme, both days (client 26 Oct). Rows: time + until, title, optional note (shown under the
     title), type (the colour tag), optional where. Speakers and hosts not announced yet; add speaker: "Name" to a row
     to show it with a mic icon. ---- */
  stage: {
    note: "Speakers and hosts are announced closer to the day.",
    topics: { Welcome: "#F3F0EB", Performance: "#FF3E8E", Talk: "#FFD23F", "Fireside chat": "#FFD23F", Session: "#8B80F9", Zones: "#2e4bff", "Game show": "#FF5A2D", Podcast: "#8B80F9", Auction: "#FF5A2D", Showcase: "#FF3E8E", Comedy: "#FFD23F", Awards: "#FFD23F", Activation: "#2e4bff", Party: "#FF3E8E", Concert: "#5b4bd6" },
    days: [
      { label: "Day 1", date: "11th Dec", talks: [
        { time: "10:00am", until: "10:10am", title: "Introduction", topic: "Welcome" },
        { time: "10:10am", until: "10:20am", title: "Opening act", note: "Theatre and dance troupe", topic: "Performance" },
        { time: "10:35am", until: "11:25am", title: "The Jara Economics: who decides?", topic: "Talk" },
        { time: "11:30am", until: "11:40am", title: "Performance", topic: "Performance" },
        { time: "11:40am", until: "12:25pm", title: "Japa or Japada?", note: "Fireside chat", topic: "Fireside chat" },
        { time: "12:30pm", until: "1:00pm", title: "PwC Report Hotline", topic: "Session" },
        { time: "1:00pm", until: "7:00pm", title: "Zone activation", note: "All five zones open, all afternoon", topic: "Zones", where: "Festival floor" },
        { time: "2:30pm", until: "3:00pm", title: "Who Wants to Be a Millionaire?", note: "Live game show: partner and sponsor trivia", topic: "Game show" },
        { time: "3:30pm", until: "4:00pm", title: "Afropolitan", note: "Main stage podcast", topic: "Podcast" },
        { time: "4:00pm", until: "5:00pm", title: "Konga Auction", topic: "Auction" },
        { time: "6:00pm", until: "7:00pm", title: "Talent hunt", topic: "Showcase" },
        { time: "7:00pm", until: "9:00pm", title: "Comedy Night: New School vs Old School", topic: "Comedy" },
      ] },
      { label: "Day 2", date: "12th Dec", talks: [
        { time: "10:00am", until: "10:30am", title: "Recap and spoken word", topic: "Performance" },
        { time: "10:35am", until: "11:25am", title: "What Loyalty When Value Is Unclear?", topic: "Talk" },
        { time: "11:30am", until: "11:40am", title: "Award ceremony", topic: "Awards" },
        { time: "11:40am", until: "12:25pm", title: "The real currency for loyalty", topic: "Talk" },
        { time: "12:30pm", until: "1:00pm", title: "Real-time action", note: "Audience talent show", topic: "Showcase" },
        { time: "1:00pm", until: "7:00pm", title: "Zone activation", note: "All five zones open, all afternoon", topic: "Zones", where: "Festival floor" },
        { time: "2:30pm", until: "3:00pm", title: "cr8torium", note: "Main stage podcast", topic: "Podcast" },
        { time: "3:00pm", until: "3:30pm", title: "Dating game show: Auction a Friend", topic: "Game show" },
        { time: "4:00pm", until: "5:00pm", title: "Konga Activation", topic: "Activation" },
        { time: "6:00pm", title: "Vibe and shut down", topic: "Party" },
        { time: "9:00pm", title: "The Bvndle Rewards Concert", note: "Separate paid ticket on TIX", topic: "Concert" },
      ] },
    ],
  },

  /* ---- 9. Heard on the floor: video testimonials. video: an .mp4 path when it arrives (null shows the poster and
     "Video coming soon"). poster: any 2025 photo. PLACEHOLDER names, quotes and durations. ---- */
  voices: [
    { name: "Tosin A.", area: "Lekki Phase 1", quote: "I actually left with real value.", poster: "assets/img/zones/redemption-4.jpg", time: "0:42", video: null },
    { name: "Chinedu E.", area: "Surulere", quote: "You come for vibes, you stay because you're winning.", poster: "assets/img/zones/games-5.jpg", time: "0:38", video: null },
    { name: "Aisha M.", area: "Yaba", quote: "It didn't feel like marketing. It felt like an experience.", poster: "assets/img/concert/c16.jpg", time: "0:51", video: null },
    { name: "Femi O.", area: "Ikoyi", quote: "Best event I attended last December. No debate.", poster: "assets/img/concert/c20.jpg", time: "0:29", video: null },
    { name: "Ngozi T.", area: "Victoria Island", quote: "Every brand showed up. You could feel it everywhere.", poster: "assets/img/zones/funtime-6.jpg", time: "0:46", video: null },
    { name: "Emeka B.", area: "Ikeja", quote: "I brought my whole team. We still talk about it.", poster: "assets/img/concert/c25.jpg", time: "0:33", video: null },
  ],

  /* ---- 6. Concert tickets (seat map). Prices from "BRF 2026 Ticket Pricing & Allocation (Final, Reconciled)", 24 Oct.
     Each tier sits in a zone on the hall plan (zone). Several tiers can share a zone; the plan then shows "From <lowest>".
     The hall layout itself is illustrative until the venue plan is confirmed. ---- */
  vip: {
    note: "All concert tickets are sold on TIX. Seating plan is illustrative.",
    zones: { front: "Premium · front row", vip: "VIP", floor: "Concert floor", tables: "Tables" },
    groups: [["individual", "Individual tickets"], ["group", "Group tables"]],
    tiers: [
      { id: "eb1", group: "individual", zone: "floor", name: "Early Bird · Phase 1", line: "General concert access.", amount: 15000, price: "₦15,000", status: "50 tickets only", view: "assets/img/concert/c18.jpg" },
      { id: "eb2", group: "individual", zone: "floor", name: "Early Bird · Phase 2", line: "General concert access. Opens when Phase 1 sells out.", amount: 20000, price: "₦20,000", status: "50 tickets only", view: "assets/img/concert/c13.jpg" },
      { id: "regular", group: "individual", zone: "floor", name: "Regular", line: "General concert access, after the Early Bird phases.", amount: 25000, price: "₦25,000", status: "", view: "assets/img/concert/c24.jpg" },
      { id: "vip", group: "individual", zone: "vip", name: "Individual VIP", line: "VIP access, a shisha pot, juice and a drink.", amount: 250000, price: "₦250,000", status: "", view: "assets/img/concert/c02.jpg" },
      { id: "premium", group: "individual", zone: "front", name: "Individual Premium", line: "Front-row seat, finger food, juice, an activation drink and a picture with an artist.", amount: 500000, price: "₦500,000", status: "", view: "assets/img/concert/c01.jpg" },
      { id: "viptable", group: "group", zone: "tables", name: "VIP Table for 10", line: "A reserved VIP table for 10 guests, with VIP benefits for everyone at the table.", amount: 2000000, price: "₦2,000,000", status: "10 tables", view: "assets/img/concert/c10.jpg" },
      // 26 Oct: Premium tables come in two sizes. Perks for the table not yet confirmed, so none listed.
      { id: "premiumtable5", group: "group", zone: "tables", name: "Premium Table for 5", line: "A reserved Premium table for a group of 5.", amount: 2000000, price: "₦2,000,000", status: "", view: "assets/img/concert/c14.jpg" },
      { id: "premiumtable10", group: "group", zone: "tables", name: "Premium Table for 10", line: "A reserved Premium table for a group of 10.", amount: 4000000, price: "₦4,000,000", status: "", view: "assets/img/concert/c13.jpg" },
    ],
  },
};
