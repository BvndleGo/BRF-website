# Bvndle Rewards Festival 2026 website

Build as of 23 Oct 2026. Same as the version on https://bvndlexperiment.netlify.app

Plain static site. No build step, no framework, no dependencies to install.

## Running it locally

Serve the folder with any local server, e.g.

```bash
npx serve .
```

Opening index.html straight from the file system won't load the floor plan (the browser blocks the request on file://).

## Files

- index.html - the festival page
- admin.html - list of free ticket sign-ups, with CSV export (uses css/site.css and js/admin.js). Not indexed by search engines.
- _headers - Netlify headers, keeps admin.html out of search
- css/ - loaded in this order: v3, v31, v32, v34, theme, v4. Most recent work is in v4.css
- js/store.js - event settings (dates, venue, links) and sign-up storage
- js/festival-data.js - all the festival content
- js/v3.js - page behaviour (hero, floor walk, ticket form etc.)
- js/trivia.js - the 1 Million Questions game
- assets/ - logos, images, video, and the floor plan at assets/floor/floor.svg

## Updating content

Content lives in js/festival-data.js and js/store.js. Anything still waiting on real content is marked PLACEHOLDER or TODO in those files.

When you edit a CSS or JS file, bump its ?v= number in index.html (e.g. festival-data.js?v=13 to ?v=14) so returning visitors don't get the cached copy.

## Before launch

1. Free tickets are stored in Supabase (project "Bvndle Go"). The schema lives in supabase/migrations. Visitors can only claim a ticket and read the total; the list is visible only to admins in admin.html.
2. tixUrl in js/store.js is the TIX homepage. Swap in the actual concert event link.
3. Confirm the dates: datesLabel ("11th – 12th December 2026") and eventStart, which drives the countdown.

## Still waiting on from Bvndle

- Floor stands: what happens at each one, coin values, photos (floor.stations: does, coins, img)
- Whether the colours on the floor plan mean zones or stand types (floor.stations[].zone)
- Prizes for Creative / Alte and Adrenaline, currently ₦2m and ₦1m as stand-ins (journey[].prize)
- Main stage topics, speakers and times for both days (stage.days)
- 2026 headliner clues, unlock dates and reveal date (lineup.mystery, lineup.revealLabel)
- Photos for Mavo, Fola and Zerry DL (lineup.past[].photo)
- Testimonial videos, names and quotes (voices; set video to an .mp4 path and the play button shows up)
- Real venue seating layout (the hall plan in the concert section is illustrative)
- Premium Table guest count and benefits (vip.tiers, id "premiumtable")

## The festival floor

The floor section uses Bvndle's isometric floor plan, recoloured with the zone colours. Scrolling walks a marker along the dashed route, stopping at each stand (numbered 01-12 in walking order) with a callout showing what happens there and the coins. A zone's passport stamp lands once all its stands are passed.

Returning visitors who've already walked it get a shorter version: zone tiles that jump to that zone's stands.

The main ticket button changes with where the visitor is: "See the experience" until the floor is walked, then "Get free ticket", then "My ticket" after they've claimed one.

To move a stand, change its x_pct / y_pct (position as a percentage of the drawing). To add one, add it to floor.stations. Walking order is worked out from the route, so you don't need to sort them.

## Hosting

Works on any static host. On Netlify, deploy the folder as is (_headers is picked up automatically), then add rewardfest.bvndle.com as a custom domain.

Fonts come from Google Fonts (Anton, Doto, Inter Tight) and icons from Phosphor Icons via unpkg. No keys needed.

## Free tickets and admin

- Form → `claim_free_pass` in Supabase. Each person gets a code like `BRF-1A2B3C4D`. Duplicate emails or phone numbers are blocked; claiming again with the same email and phone returns the same ticket.
- `admin.html` → Supabase sign-in. Only users listed in `public.admins` can see sign-ups, check people in at the gate and export CSV.
- Adding an admin: add their email to `public.admin_emails`, then create their login in Supabase → Authentication → Users → Add user. Approved emails become admins automatically.
- Customer.io: every new ticket is sent from the database to Customer.io (workspace 220452) as the person (by email, BRF data in `brf_*` attributes) plus a `free_pass_claimed` event. A job every 5 minutes retries anything that didn't go through. See supabase/migrations/20261024010000_customerio_sync.sql.
- Confirmation email: Customer.io automation "BRF 2026 — Free Ticket Confirmation" (triggered by `free_pass_claimed`).

## 1 Million Questions and BvndleCoins

- Ticket holders play the real questions; everyone else can play a practice round on the sample questions in js/trivia.js.
- Questions are marked in Supabase, never in the browser: one at a time, options shuffled per person, 15 seconds each, each question answered once.
- Every right answer is a draw entry. Every 10 right answers earns 5 BvndleCoins, recorded as pending.
- admin.html → Coins tab: approve or reject awards, then "Export approved" for a per-person list (email, phone, Bvndle tag, coins, naira value) to credit in the Bvndle app.
- The question bank is in Supabase only (the repo is public). To update questions, ask for a re-import from the Google Sheet.

## Analytics

- js/analytics.js records anonymous visits into Supabase: sections reached, clicks, scroll depth, active time, key actions and where people were when they left. Visitors who have Do Not Track switched on are skipped.
- admin.html → Analytics tab: visits, unique visitors, ticket conversion, time on site, how far people get, where they leave, most clicked, sources (UTM or referrer), devices, busiest hours and the latest 50 visits.
- Add `?utm_source=...&utm_campaign=...` to links you share so the Sources chart shows which posts bring people in.
