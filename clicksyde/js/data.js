/* Clicksyde: all site content lives here.
   Anything marked PLACEHOLDER is a stand-in until the team supplies the real thing. */
window.CS = {
  /* Contact + conversion settings */
  contact: {
    email: "hello@clicksyde.com",          // PLACEHOLDER: confirm the inbox leads should go to
    whatsapp: "",                          // PLACEHOLDER: business WhatsApp number in international format, digits only (e.g. 2347000000000)
    calendly: "#",                         // PLACEHOLDER: discovery-call booking link (Calendly, Cal.com, Google appointment page)
    instagram: "#", linkedin: "#", x: "#", tiktok: "#",
  },

  /* Where form answers and newsletter sign-ups are saved: the Clicksyde Supabase project.
     key = the project's publishable key (sb_publishable_...) or legacy anon key. Both are safe in a public page:
     the database only lets visitors ADD rows, never read them (supabase/migrations/20261125000000_clicksyde_leads.sql).
     Never put the secret / service_role key here. Leave key empty and the form falls back to email/WhatsApp. */
  supabase: {
    url: "https://jcwekuxjhcceqprefudc.supabase.co",
    key: "sb_publishable_Bu3WBDBC2YCVlThNQFE-IQ_WLCXAQxr"
  },

  /* The storybook: each page is a chapter answering one visitor question */
  chapters: [
    { id: "home",     href: "index.html",    n: "01", title: "Hello",        label: "Home",     stage: "Understand", q: "What does Clicksyde do, and is it for me?" },
    { id: "wall",     href: "services.html", n: "02", title: "The Wall",     label: "Services", stage: "Explore",    q: "Which of your services solves my problem?" },
    { id: "work",     href: "work.html",     n: "03", title: "Receipts",     label: "Work",     stage: "Trust",      q: "Can you actually deliver?" },
    { id: "insights", href: "insights.html", n: "04", title: "Insights",     label: "Insights", stage: "Grow",       q: "What do you know that I don't?" },
    { id: "about",    href: "about.html",    n: "05", title: "Still curious?", label: "About",  stage: "Connect",    q: "Who are the people behind this?" },
    { id: "talk",     href: "start.html",    n: "06", title: "Let's talk",   label: "Let's talk", stage: "Convert",  q: "How do we start?" }
  ],

  /* Logo slideshow (text wordmarks until logo files are added to assets/clients/) */
  clients: ["Domino's Pizza", "PLACEHOLDER Brand", "Client Two", "Client Three", "Client Four", "Client Five", "Client Six", "Client Seven"],

  /* Hero reel fallback frames (shown until assets/reel.mp4 exists) */
  reel: [
    ["#FF4306", "Launch film"], ["#2B2B2B", "Street activation"], ["#F6A8C5", "Creator collab"],
    ["#00B8E6", "Product drop"], ["#FFE45C", "Social series"], ["#26B3A6", "Brand refresh"],
    ["#C9B6F2", "Feedback campaign"], ["#161616", "Event recap"], ["#FF8A5C", "Paid social"],
    ["#BDE6CF", "Behind the scenes"]
  ],

  /* CHAPTER 02: the sticky-note wall. c = note colour (taken from the sticky-note reference) */
  services: [
    {
      id: "strategy", t: "Brand Strategy", s: "Know exactly who you are and why anyone should care.", c: "#DDE3F6", rot: -2, cat: "think",
      body: "Before a single post goes out, we pin down your positioning, your audience and the one thing you want people to remember. Everything we make after that has a reason to exist.",
      get: ["Positioning and messaging framework", "Audience and competitor research", "Brand voice guide", "90-day marketing roadmap"],
      for: ["New brands", "Rebrands", "Businesses that feel invisible"]
    },
    {
      id: "social", t: "Social Media Management", s: "Show up every day without it feeling like a chore.", c: "#FFE600", rot: 1.5, cat: "show",
      body: "We plan, write, design and publish your content, reply to your community and report on what's working. You get a feed people actually stop on.",
      get: ["Monthly content calendar", "Copy, design and scheduling", "Community management", "Monthly performance report"],
      for: ["Brands posting inconsistently", "Teams without an in-house social lead"]
    },
    {
      id: "content", t: "Content Production", s: "Photo and video that looks like money was spent wisely.", c: "#DDF3E2", rot: -1, cat: "show",
      body: "Shoots, short-form video, product photography and campaign films. We write it, shoot it, edit it and cut it for every platform it needs to live on.",
      get: ["Creative concept and script", "Photo and video shoots", "Edits for Reels, TikTok and YouTube", "Asset library you own"],
      for: ["Product launches", "Campaigns", "Always-on content"]
    },
    {
      id: "ads", t: "Performance Ads", s: "Every naira of ad spend should be able to explain itself.", c: "#D8BDF0", rot: 2, cat: "grow",
      body: "Paid campaigns on Meta, TikTok and Google built around a clear goal: leads, sales or sign-ups. We test, cut what doesn't work and scale what does.",
      get: ["Campaign setup and tracking", "Ad creative and copy testing", "Weekly optimisation", "Clear cost-per-result reporting"],
      for: ["E-commerce", "Lead generation", "App installs"]
    },
    {
      id: "feedback", t: "Customer Feedback Campaigns", s: "Turn what customers say into your best marketing.", c: "#E3EEF8", rot: -1.5, cat: "think",
      body: "We collect, organise and act on what your customers are telling you, then turn the good stuff into stories and the hard stuff into fixes. It's how we helped Domino's Pizza tell a stronger product story.",
      get: ["Feedback collection system", "Insight report", "Testimonial and UGC content", "Response playbook"],
      for: ["Restaurants and retail", "Service businesses", "Brands with reviews piling up"]
    },
    {
      id: "influencer", t: "Influencer & Creator Marketing", s: "The right voices, not just the loudest ones.", c: "#FDE3EA", rot: 1, cat: "show",
      body: "We find creators your audience already trusts, brief them properly, manage the paperwork and measure what each partnership actually brought in.",
      get: ["Creator shortlist and vetting", "Briefs and contracts", "Campaign management", "Reach and conversion tracking"],
      for: ["Launches", "Awareness pushes", "Brands entering a new audience"]
    },
    {
      id: "activations", t: "Experiential & Activations", s: "Moments people film, share and talk about.", c: "#11C5F0", rot: -2.5, cat: "show",
      body: "Pop-ups, events, sampling and street activations designed to be experienced in person and amplified online.",
      get: ["Concept and run-of-show", "Vendor and venue management", "On-site content capture", "Post-event recap"],
      for: ["Product launches", "Festivals and events", "Community building"]
    },
    {
      id: "pr", t: "PR & Communications", s: "Get talked about for the right reasons.", c: "#DDF3E2", rot: 2.5, cat: "grow",
      body: "Press stories, media relations, thought leadership and the plan for when things go sideways. Your story, told by people other than you.",
      get: ["Media list and pitching", "Press releases", "Founder thought leadership", "Crisis comms plan"],
      for: ["Funding announcements", "Founders building a profile", "Brand milestones"]
    },
    {
      id: "web", t: "Websites & Digital", s: "A home online that works as hard as you do.", c: "#2CB8AD", rot: -1, cat: "grow",
      body: "Landing pages, websites and digital experiences built to convert visitors into leads, like the one you're reading right now.",
      get: ["UX and copy", "Design and build", "Analytics and tracking", "Conversion optimisation"],
      for: ["Launches", "Lead generation", "Brands with an outdated site"]
    }
  ],

  /* Problem finder on The Wall: maps a problem to the notes that solve it */
  problems: [
    { p: "Nobody knows we exist", h: "Awareness", ids: ["social", "influencer", "activations", "pr"] },
    { p: "People see us but don't buy", h: "Conversion", ids: ["ads", "web", "strategy"] },
    { p: "Our brand feels generic", h: "Identity", ids: ["strategy", "content"] },
    { p: "Customers aren't coming back", h: "Retention", ids: ["feedback", "social"] },
    { p: "We're launching something new", h: "Launch", ids: ["strategy", "content", "influencer", "activations"] },
    { p: "Our content looks cheap", h: "Quality", ids: ["content", "social"] }
  ],

  /* CHAPTER 03: case studies. Each has its own client comment thread underneath. */
  cases: [
    {
      id: "dominos", client: "Domino's Pizza", initials: "D", color: "#006491",
      tags: ["Marketing", "Customer Feedback"], cat: "feedback",
      title: "Domino's Pizza", sub: "How we turned customers' feedback into a stronger product story",
      slides: [["#C8553D", "The pizza", "Feedback,\nserved hot"], ["#006491", "The campaign", "Real people.\nReal reviews."], ["#E31837", "The result", "1.3M\nreached"]],
      stats: [["📊", "250k+", "revenue generated", true], ["👤", "1.3M", "people reached"], ["✉️", "32%", "email conversion"], ["★", "4.5★", "average rating"]],
      story: [
        ["The challenge", "Customers had plenty to say, but none of it was making it into the brand's story. Reviews sat unread and good experiences went unshared."],
        ["What we did", "We built a feedback loop: collect it, sort it, answer it, and turn the best moments into content. Real customers became the face of the campaign."],
        ["The result", "Bigger visibility, stronger conversations and a product story people believed, because it came from people like them."]
      ],
      comments: [
        { who: "Domino's Pizza", role: "Head of Marketing", pinned: true, likes: 48, color: "#006491", initials: "D",
          said: "Clicksyde understood the vision and knew exactly how to position it. The result was bigger visibility, stronger conversations, and a brand that felt impossible to overlook." },
        { who: "Clicksyde", role: "Replying", reply: true, likes: 12, brand: true,
          said: "We see every project as more than just marketing. It's a partnership founded on trust, shaped by creativity, and powered by ambition. Thanks for trusting us with this one 🍕" }
      ]
    },
    {
      id: "case-two", client: "PLACEHOLDER Fintech", initials: "F", color: "#2B2B2B",
      tags: ["Performance Ads", "Content"], cat: "ads",
      title: "PLACEHOLDER Fintech", sub: "From 'what's that app?' to 40,000 sign-ups in one quarter",
      slides: [["#2B2B2B", "The brief", "Make money\nfeel simple"], ["#FF4306", "The creative", "20 ads.\n3 winners."], ["#11C5F0", "The result", "40k\nsign-ups"]],
      stats: [["📈", "40k", "new sign-ups", true], ["💸", "-38%", "cost per sign-up"], ["🎬", "120", "ad variations tested"], ["⏱", "90", "days"]],
      story: [
        ["The challenge", "A good product nobody had heard of, and an ad budget that had to prove itself fast."],
        ["What we did", "Short, honest videos with real users, tested in small batches. We killed the losers in days and put the budget behind the winners."],
        ["The result", "Sign-ups grew month on month while the cost of each one dropped."]
      ],
      comments: [
        { who: "PLACEHOLDER Fintech", role: "Growth Lead", pinned: true, likes: 31, color: "#2B2B2B", initials: "F",
          said: "PLACEHOLDER testimonial: replace with the client's real words once approved." }
      ]
    },
    {
      id: "case-three", client: "PLACEHOLDER Fashion", initials: "A", color: "#B23A6F",
      tags: ["Influencer", "Activation"], cat: "show",
      title: "PLACEHOLDER Fashion", sub: "A pop-up that sold out in a weekend and trended for a week",
      slides: [["#B23A6F", "The pop-up", "One weekend\nonly"], ["#FFE600", "The creators", "15 creators.\n1 story."], ["#161616", "The result", "Sold\nout"]],
      stats: [["🛍", "100%", "stock sold", true], ["👀", "2.1M", "views"], ["🤳", "15", "creators"], ["📍", "3.4k", "visitors"]],
      story: [
        ["The challenge", "Launch a new collection with buzz, without a TV budget."],
        ["What we did", "A one-weekend pop-up built for phones, with creators who brought their own audiences through the door."],
        ["The result", "The collection sold out and the content kept working for weeks after."]
      ],
      comments: [
        { who: "PLACEHOLDER Fashion", role: "Founder", pinned: true, likes: 27, color: "#B23A6F", initials: "A",
          said: "PLACEHOLDER testimonial: replace with the client's real words once approved." }
      ]
    }
  ],

  /* CHAPTER 04: insights (blog). Posts are PLACEHOLDER drafts for the content team. */
  posts: [
    { id: "feedback-is-content", cat: "Strategy", title: "Your customers are writing your marketing. Are you reading it?", ex: "What the Domino's campaign taught us about turning reviews into revenue.", mins: 6, date: "Nov 2026", color: "#FF4306", art: "★★★★★", featured: true,
      body: [
        ["p", "Every business has a marketing team it doesn't pay: its customers. They post, review, complain and recommend every day. Most brands treat that as noise. The smart ones treat it as a brief."],
        ["h", "Start by listening on purpose"],
        ["p", "Pick three places your customers talk (reviews, DMs, comments) and read them every week. Tag each one: praise, problem or idea."],
        ["q", "The best line in your next campaign has probably already been written by a customer."],
        ["h", "Answer in public"],
        ["p", "A reply to a bad review is read by far more people than the person who wrote it. Answer quickly, fix what you can and say what you changed."],
        ["h", "Turn praise into proof"],
        ["p", "Ask happy customers if you can feature them. Real faces and real words beat a polished ad nearly every time."]
      ] },
    { id: "ads-budget", cat: "Performance", title: "How to tell if your ad budget is working (without a data team)", ex: "Three numbers to check every Monday morning.", mins: 4, date: "Nov 2026", color: "#161616", art: "₦ → ↑", body: null },
    { id: "posting-daily", cat: "Social", title: "You don't need to post every day. You need to post on purpose.", ex: "A simple content rhythm for small teams.", mins: 5, date: "Oct 2026", color: "#26B3A6", art: "M T W", body: null },
    { id: "creator-brief", cat: "Influencer", title: "The one-page creator brief we use for every campaign", ex: "Free template inside.", mins: 3, date: "Oct 2026", color: "#C9B6F2", art: "1 pg", body: null },
    { id: "naija-data", cat: "Data", title: "What Nigerian shoppers actually do online in 2026", ex: "Numbers worth knowing before your next campaign.", mins: 8, date: "Sep 2026", color: "#00B8E6", art: "%", body: null },
    { id: "rebrand", cat: "Brand", title: "Signs it's time to rebrand (and signs it isn't)", ex: "A rebrand won't fix a product problem.", mins: 5, date: "Sep 2026", color: "#F6A8C5", art: "Aa", body: null }
  ],

  /* CHAPTER 05: the fun facts that open the About page (flip cards). PLACEHOLDER answers for the team to make their own. */
  facts: [
    { q: "Favourite food?", a: "Jollof. Which jollof is an ongoing office debate we refuse to settle publicly.", tag: "Asked by everyone" },
    { q: "Favourite colour?", a: "This orange. We had it matched off a sunset. Okay, off a screen. Still counts.", tag: "Obviously" },
    { q: "Why 'Clicksyde'?", a: "Because every brand wants to be on the side people click. That's the whole job.", tag: "The name" },
    { q: "What do you argue about?", a: "Kerning, captions, and whether a meme is still funny after 48 hours.", tag: "Office life" },
    { q: "What's on the playlist?", a: "Afrobeats in the morning, lo-fi when the deadline is close, silence when it's very close.", tag: "Vibes" },
    { q: "What makes you say no to a client?", a: "When we can't see how we'd make them money. We'd rather tell you than take your budget.", tag: "Honestly" }
  ],

  /* PLACEHOLDER: the Clicksyde origin story; swap in real years and moments */
  timeline: [
    ["20XX", "A group chat, a laptop, and too many opinions about ads", "Clicksyde started as a few young people who were tired of watching good brands market themselves badly."],
    ["20XX", "The first client who took a chance", "One brand said yes. We over-delivered, they told a friend, and the friend told two more."],
    ["20XX", "From side project to studio", "A real team, real clients, and a rule we still keep: if it doesn't move the business, it doesn't ship."],
    ["Now", "Making brands impossible to overlook", "Strategy, content, ads and experiences for businesses that want to grow, and a blog for everyone who wants to learn how."]
  ],

  values: [
    ["🎯", "Results over noise", "Likes are nice. Revenue is nicer. We measure what matters to your business."],
    ["🤝", "Partners, not vendors", "We're in your WhatsApp, not just your inbox. Your wins are our wins."],
    ["⚡", "Fast, then better", "We ship, learn and improve. Waiting for perfect is how campaigns die."],
    ["💬", "Straight talk", "If something isn't working we'll say so, and tell you what we'd do instead."]
  ],

  /* PLACEHOLDER team: add real names, roles, photos (assets/team/*.jpg) and one odd fact each */
  team: [
    { n: "Team member", r: "Strategy", odd: "PLACEHOLDER odd fact", c: "#FF4306" },
    { n: "Team member", r: "Creative", odd: "PLACEHOLDER odd fact", c: "#161616" },
    { n: "Team member", r: "Design", odd: "PLACEHOLDER odd fact", c: "#26B3A6" },
    { n: "Team member", r: "Content & Insights", odd: "PLACEHOLDER odd fact", c: "#C9B6F2" }
  ],

  /* CHAPTER 06: the 4 questions on the Let's talk page */
  questions: {
    need: ["Get more people to know us", "Turn attention into sales", "Content that looks premium", "Launch something new", "A full marketing team", "Not sure yet, help me figure it out"],
    budget: ["Under ₦500k / month", "₦500k – ₦2m / month", "₦2m – ₦5m / month", "₦5m+ / month", "One-off project", "Rather discuss on a call"],
    when: ["Yesterday 🔥", "This month", "Next 1–3 months", "Just exploring"]
  }
};
