/* 1 Million Questions: a trivia raffle. Every right answer in the practice round is one entry into the draw;
   claiming a free ticket locks the entries in, and winners are announced live on the day.
   SAMPLE SET about the festival itself. The real questions come from the client and replace this list.
   Each item: q = question, a = four options, ok = index of the right answer,
   near = index of the "so close" answer (a believable miss), or -1 for none. */
window.BRF_TRIVIA = {
  sample: true,
  champion2025: "Kahoot",
  drawDay: "12 December",
  questions: [
    { q: "How many zones are at Bvndle Rewards Festival 2026?", a: ["Three", "Five", "Seven", "Ten"], ok: 1, near: 2 },
    { q: "Where do you cash in your coins?", a: ["At the gate", "At each zone's redemption booth", "Online after the event", "At the concert"], ok: 1, near: 3 },
    { q: "What gets stamped at every zone?", a: ["Your hand", "Your festival passport", "Your ticket", "Your phone"], ok: 1, near: 2 },
    { q: "Concert night is on…", a: ["11 December", "12 December", "24 December", "31 December"], ok: 1, near: 0 },
    { q: "What does it cost to get on the festival floor?", a: ["Nothing: the Day Pass is free", "₦5,000", "₦10,000", "A BvndleCoin"], ok: 0, near: 3 },
    { q: "Who won 1 Million Questions at the 2025 festival?", a: ["Kahoot", "Bvndle", "Nobody", "The crowd"], ok: 0, near: 3 },
    { q: "Where do you find the silent disco?", a: ["Escape Zone", "Wealth Zone", "Connection Zone", "Adrenaline Zone"], ok: 0, near: 2 },
    { q: "In which zone do you spin the wheel?", a: ["Wealth Zone", "Creative / Alte Zone", "Escape Zone", "Adrenaline Zone"], ok: 0, near: 3 },
    { q: "Where are your BvndleCoins kept?", a: ["In the Bvndle app", "On a paper card", "At the bank", "Nowhere"], ok: 0, near: 1 },
    { q: "When are the 1 Million Questions winners announced?", a: ["Live on the day", "A week later", "By email", "Next year"], ok: 0, near: 1 },
    { q: "Roughly how many people came through the gates in 2025?", a: ["500", "2,000", "5,000", "50,000"], ok: 2, near: 1 },
    { q: "How many headliners are being kept secret this year?", a: ["One", "Two", "Three", "Five"], ok: 2, near: 1 },
  ],
};
