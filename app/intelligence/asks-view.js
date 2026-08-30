import { escape } from "./ideas-view.js";

// The four asks are instruments over the same artist record. They are not
// rows in a directory: each one names a job, says what it returns, and carries
// its own action or honest state at the foot of the instrument.
//
// Each title carries a small mark drawn in the rail's vocabulary: 24 by 24,
// stroked, geometric, nothing filled. The mark is identity, not decoration and
// not colour. Four hues would have been a rainbow across four peers, and three
// of the four would have landed on colours that already mean a state somewhere
// else on the same screen. Ruled 2026-08-29. The marks inherit the text colour,
// and the instruments separate from the page through the raised gradient.
//
// The mark sits inside the heading rather than in a row beside it. The first
// build put both in an `m-cluster`, which is a wrapping flex row, so at phone
// width the title wrapped below the mark and the mark was left sitting alone
// above it. A mark belongs to the words it names, so it travels with them.

export const MARKS = {
  // Three starting points out of one request.
  ideas: '<svg class="m-icon m-icon--large" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21v-8M12 13 5 5M12 13l7-8"/></svg>',
  // Two sets of things, side by side.
  compare: '<svg class="m-icon m-icon--large" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h6M4 12h6M4 17h6M14 7h6M14 12h6M14 17h6"/></svg>',
  // A finished frame, looked at closely.
  artboard: '<svg class="m-icon m-icon--large" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="15" rx="1"/><circle cx="11" cy="11" r="3"/><path d="m13.4 13.4 2.6 2.6"/></svg>',
  // Stops along a route.
  stops: '<svg class="m-icon m-icon--large" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12h18"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>',
};

// The four instruments share one footer skeleton, because four different
// control shapes in four cards left every control at a different height and
// every card with a different ragged bottom edge. The ask sits in a slot tall
// enough for a labelled choice and bottom aligned inside it, so a select with a
// button, a lone button, and an honest state all land on the same line across a
// row. The way back to an answer sits in a row of its own beneath it.
//
// A card with no answer reserves that row rather than collapsing it, but only
// once some instrument on the page holds an answer. Before then there is
// nothing for the four to line up with and the room belongs to the page.
export function askInstrument(entry, answered = false) {
  const mark = MARKS[entry.mark] || "";
  const answer = entry.answer || "";
  const reserved = answer ? "" : " m-intelligence-instrument__answer--reserved";
  const row = answered
    ? `<div class="m-intelligence-instrument__answer${reserved}">${answer}</div>`
    : "";
  return `<article class="m-intelligence-instrument">
      <div class="m-intelligence-instrument__body">
        <h3 class="m-intelligence-instrument__heading">${mark}${escape(entry.title)}</h3>
        <p class="m-copy">${escape(entry.copy)}</p>
      </div>
      <div class="m-intelligence-instrument__footer">
        <div class="m-intelligence-instrument__ask">${entry.control}</div>
        ${row}
      </div>
    </article>`;
}

// The instruments earn their size on a first visit and not after. Once an
// answer is on the page they tighten, so the answer gets the room the menu was
// holding. Spacing only: every word an instrument says, it keeps saying.
export function renderAsks(entries, { answered = false } = {}) {
  const compact = answered ? " m-intelligence-instruments--compact" : "";
  return `<section class="m-intelligence-asks" aria-labelledby="asks-heading">
      <h2 id="asks-heading" class="m-label">What you can ask</h2>
      <div class="m-intelligence-instruments${compact}">${entries.map((entry) => askInstrument(entry, answered)).join("")}</div>
    </section>`;
}
