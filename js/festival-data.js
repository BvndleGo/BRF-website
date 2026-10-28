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

  /* ---- 5. The experience: five zones, each with its own plan (designer's zone-map pack, 27 Oct).
     Art: assets/zones/<id>.svg (text-free; .p people, .trail route, .lock and .cf animate). Stations: number, name,
     one line, and x / y as a % of the drawing. Rules from the pack: no brand names, Catharsis stays sealed (never say
     what happens inside the chambers), plans are indicative.
     reward: only the Wealth zone pays (2 BvndleCoins, once per ticket, for going through all its stations). ---- */
  zones: [
    { id: "market", name: "Wealth", hall: "Hall 1 · back centre", tag: "Learn it. Trade it. Ring the bell.",
      color: "#F5B63E", art: "assets/zones/market.svg?v=1", view: "39 62 1251 596",
      reward: { activity: "wealth_zone", coins: 2 },  // walk through all its stations on the site (client 27 Oct)
      stations: [
      { n: "01", name: "Passport Desk", desc: "Your way into the market. Don’t lose it.", x: 20.03, y: 23.05 },
      { n: "02", name: "The Vault · west", desc: "Your first stamp of ownership.", x: 39.14, y: 41.29 },
      { n: "03", name: "Licence Bar", desc: "Two minutes stand between you and a trading licence.", x: 38.66, y: 15.29 },
      { n: "04", name: "Order Desk", desc: "Your first order. No pressure.", x: 23.37, y: 32.63 },
      { n: "05", name: "Trading Floor and Bell Stage", desc: "Loud floor, live ticker, and one winner gets to ring the bell.", x: 52.51, y: 17.6 },
      { n: "06", name: "OTC Desk", desc: "The deals that never make the board.", x: 31.81, y: 41.63 },
      { n: "07", name: "Featured Stocks Wall", desc: "Today’s names to watch.", x: 56.97, y: 50.5 },
      { n: "08", name: "The Vault · east", desc: "Watch your trade travel. Literally.", x: 46.46, y: 53.0 },
      { n: "09", name: "Wealth Lounge", desc: "Where the smart money sits down.", x: 81.97, y: 48.41 },
      { n: "10", name: "Global Gateway", desc: "The world market, one step away.", x: 88.5, y: 58.19 },
      { n: "11", name: "Sentiment Pit", desc: "Bulls or bears? Pick a side and shout.", x: 74.8, y: 69.13 },
      { n: "12", name: "Connections Wall", desc: "Sign out like a market legend.", x: 64.93, y: 59.58 },
      ] },
    { id: "connection", name: "Connection", hall: "Hall 1 · back left", tag: "Come together. Play loud. Treat someone.",
      color: "#DD5796", art: "assets/zones/connection.svg?v=1", view: "58 22 1225 594",
      reward: null,
      stations: [
      { n: "C", name: "Concierge", desc: "Your band is your currency. Wear it loud.", x: 31.31, y: 57.58 },
      { n: "01", name: "Passion Board", desc: "Say it where everyone can read it.", x: 30.89, y: 20.12 },
      { n: "02", name: "Trivia Counter", desc: "Think fast, win coins.", x: 49.35, y: 5.13 },
      { n: "03", name: "App Desk", desc: "A few taps, a few coins.", x: 31.51, y: 40.51 },
      { n: "04", name: "Dance Square", desc: "Bring a partner. The floor lights up and someone wins every hour.", x: 61.23, y: 35.98 },
      { n: "05", name: "Bar Count", desc: "Hang on. Your friends are counting.", x: 43.81, y: 43.7 },
      { n: "06", name: "Table Games", desc: "Friendships have ended over less.", x: 53.04, y: 58.57 },
      { n: "07", name: "Pop-up Station", desc: "It changes. Come and see.", x: 15.11, y: 38.43 },
      { n: "08", name: "Make-a-Scent", desc: "Make something they’ll remember you by.", x: 87.07, y: 46.65 },
      { n: "09", name: "Ice Cream Cart", desc: "One cup. Two spoons. Choose wisely.", x: 70.87, y: 51.2 },
      { n: "10", name: "Wish Tree", desc: "Tie a wish. Read someone else’s.", x: 64.11, y: 59.7 },
      { n: "11", name: "Massage Chairs", desc: "Ten minutes where nobody can reach you.", x: 83.38, y: 57.32 },
      ] },
    { id: "escape", name: "Catharsis", hall: "Hall 1 · back right, through to Hall 2", tag: "Four rooms. Fifteen minutes. One way out.",
      color: "#69E392", art: "assets/zones/escape.svg?v=1", view: "248 0 1050 418",
      reward: null,
      stations: [
      { n: "01", name: "Booking Gate", desc: "The clock is already running. Grab your slot before another crew does.", x: 44.58, y: 70.5 },
      { n: "02", name: "Briefing Booth", desc: "This is where you get the mission. That’s all we’re saying.", x: 14.68, y: 38.25 },
      { n: "03", name: "Chamber 1 · Balogun", desc: "Every Lagosian thinks they know the market. Prove it.", x: 39.39, y: 18.44 },
      { n: "04", name: "Chamber 2 · Oshodi", desc: "Miss this one and you’re walking.", x: 58.62, y: 39.07 },
      { n: "05", name: "Chamber 3 · Third Mainland", desc: "NEPA has entered the chat.", x: 73.33, y: 46.89 },
      { n: "06", name: "Chamber 4 · The Vault", desc: "It locks at 4. You have until then.", x: 82.29, y: 51.2 },
      { n: "07", name: "Escape Landing", desc: "Make it out and be a legend.", x: 88.57, y: 77.03 },
      { n: "08", name: "Public Lane", desc: "No slot? Watch the crews sweat through the glass.", x: 70.67, y: 69.38 },
      { n: "09", name: "Market Street", desc: "Eat, shop and plan your rematch.", x: 33.74, y: 29.88 },
      { n: "10", name: "Leaderboard Wall", desc: "Fifteen minutes. One name at the top. Could be yours.", x: 20.31, y: 22.22 },
      ] },
    // Alte and Adrenaline: "BRF 2026 Zone Designs Handoff" (27 Oct). Copy as supplied. No hall given yet.
    { id: "alte", name: "Alte", hall: "", tag: "Food, fashion and fabric dyeing.", color: "#E987E6", art: "assets/zones/alte.svg?v=1", view: "58 22 1225 660",
      reward: null,
      stations: [
      { n: "01", name: "Entry and exit", desc: "Check in with the Bvndle app and start earning coins.", x: 26.2, y: 68.3 },
      { n: "02", name: "Main screen", desc: "Schedules, live moments and zone leaderboards.", x: 70.5, y: 15.3 },
      { n: "03", name: "Food and drink merchants", desc: "Local food and drink vendors along the back of the zone.", x: 34.9, y: 15.1 },
      { n: "04", name: "Merchant seating", desc: "Shaded tables beside the merchants to slow down and share.", x: 18.0, y: 37.0 },
      { n: "05", name: "Runway", desc: "Emerging designers and street style on show through the day.", x: 49.7, y: 40.9 },
      { n: "06", name: "Mini dye pits", desc: "Inspired by Kano's dye pits: dye your own fabric to take home.", x: 63.3, y: 63.9 },
      { n: "07", name: "Drying line", desc: "Freshly dyed fabric hung to dry, and the zone's favourite photo spot.", x: 75.1, y: 49.3 },
      { n: "08", name: "Masterclass pod", desc: "Small-group sessions with designers, makers and creatives.", x: 83.5, y: 43.5 },
      ] },
    { id: "adrenaline", name: "Adrenaline", hall: "", tag: "Gaming, esports and cosplay.", color: "#66E0E0", art: "assets/zones/adrenaline.svg?v=1", view: "58 22 1225 660",
      reward: null,
      stations: [
      { n: "01", name: "Entry and exit", desc: "Check in with the Bvndle app and start earning coins.", x: 26.2, y: 68.3 },
      { n: "02", name: "Gaming pods", desc: "Open play stations for casual matches and qualifiers.", x: 36.2, y: 21.5 },
      { n: "03", name: "Competitor stage", desc: "Teams face off live in K0n10Dr championship matches.", x: 64.9, y: 30.6 },
      { n: "04", name: "Main screen", desc: "Every match, broadcast big for the whole zone.", x: 71.0, y: 15.7 },
      { n: "05", name: "Viewing centre", desc: "Tiered seating to watch the action with the crowd.", x: 46.4, y: 45.8 },
      { n: "06", name: "Cosplay stage", desc: "Character showcases and cosplay contests.", x: 84.4, y: 38.3 },
      { n: "07", name: "Costume rack", desc: "Borrow a piece and become a character for the day.", x: 72.6, y: 51.3 },
      { n: "08", name: "Cosplay floor", desc: "Meet the cosplayers and grab your photos.", x: 61.4, y: 61.9 },
      ] },
  ],

  /* ---- 5b. Speakers by track (website review, 27 Oct). Tapping a track shows its speakers. Add each speaker as
     { name: "Full name", role: "Title, Company", photo: "assets/img/speakers/<file>.jpg" } (photo optional).
     An empty list shows "Speakers announced soon". ---- */
  speakers: {
    intro: "While the fun never stops, there will be conversations that spark ideas, challenge perspectives, and get the room talking, led by some of the brightest minds on the continent across industries, interests, and everything in between.",
    tracks: [
      { name: "The Chronicles of <i>Japa</i>", speakers: [] },
      { name: "Brands, Marketing & What's In Between", speakers: [] },
      { name: "The Business Of Wealth", speakers: [] },
      { name: "The <i>Jara</i> Economy", speakers: [] },
      { name: "The Creative Economy", speakers: [] },
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
      ] },
      { label: "Day 2", date: "12th Dec", talks: [
        { time: "10:00am", until: "10:30am", title: "Recap and spoken word", topic: "Performance" },
        { time: "10:35am", until: "11:25am", title: "What Is Loyalty When Value Is Unclear?", topic: "Talk" },
        { time: "11:30am", until: "11:40am", title: "Award ceremony", topic: "Awards" },
        { time: "11:40am", until: "12:25pm", title: "The real currency for loyalty", topic: "Talk" },
        { time: "12:30pm", until: "1:00pm", title: "Real-time action", note: "Audience talent show", topic: "Showcase" },
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
    note: "Concert tickets are paid. Seating plan is illustrative.",
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
