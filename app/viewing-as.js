// Who is looking. There is no login yet, so this is a switch a person flips,
// labeled as a stand-in, and it goes away at step 4 when login supplies the
// actor. Recorded in docs/deferred-work.md.
//
// It changes what a page shows and never what is stored. Nothing here is sent
// to the handler, and no action takes an actor from the request, so flipping
// the switch cannot change a single byte in storage. That is what keeps the
// client's approval the client's and Higher Roads' approval Higher Roads'.

export const VIEWERS = {
  higherRoads: "Higher Roads",
  client: "Client reviewer",
};

export function resolveViewer(value) {
  return value === "client" ? "client" : "higherRoads";
}

export function viewerLabel(viewer) {
  return VIEWERS[resolveViewer(viewer)];
}

function attribute(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Two items. The one you are on is pressed, the other is a link to the page
// that side of the work happens on.
export function viewerSwitch(viewer, { clientHref, workHref }) {
  const current = resolveViewer(viewer);
  const items = [
    { key: "higherRoads", href: workHref },
    { key: "client", href: clientHref },
  ].map((entry) => {
    const pressed = entry.key === current;
    return pressed
      ? `<span class="m-segmented__item" aria-pressed="true">${attribute(VIEWERS[entry.key])}</span>`
      : `<a class="m-segmented__item" aria-pressed="false" href="${attribute(entry.href)}">${attribute(VIEWERS[entry.key])}</a>`;
  }).join("");
  return `<div class="m-stack">
      <span class="m-label">Viewing as</span>
      <div class="m-segmented">${items}</div>
      <span class="m-help">A switch until people can sign in. It changes what you see and nothing that is stored.</span>
    </div>`;
}
