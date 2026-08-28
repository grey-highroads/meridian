import { escape } from "./ideas-view.js";

// The four asks are instruments over the same artist record. They are not
// rows in a directory: each one names a job, says what it returns, and carries
// its own action or honest state at the foot of the instrument.
export function askInstrument(entry) {
  return `<article class="m-intelligence-instrument">
      <div class="m-stack">
        <h3 class="m-intelligence-instrument__heading">${escape(entry.title)}</h3>
        <p class="m-copy">${escape(entry.copy)}</p>
      </div>
      <div class="m-intelligence-instrument__footer">${entry.control}</div>
    </article>`;
}

export function renderAsks(entries) {
  return `<section class="m-intelligence-asks" aria-labelledby="asks-heading">
      <h2 id="asks-heading" class="m-label">What you can ask</h2>
      <div class="m-intelligence-instruments">${entries.map(askInstrument).join("")}</div>
    </section>`;
}
