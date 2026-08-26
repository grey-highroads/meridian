// What a page shows when the account holds no tour. Every rail page reaches
// this instead of asking the tour handler for a tour that does not exist, which
// put an error message where the work goes. The wording stays in one file so
// four pages say the same thing.

export function showNoTour(root, locationBar) {
  if (locationBar) locationBar.innerHTML = "";
  if (!root) return;
  root.innerHTML = `<section class="m-empty-state m-empty-state--waiting" aria-labelledby="no-tour-heading">
      <div class="m-empty-state__visual" aria-hidden="true">
        <svg class="m-empty-state__glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor">
          <path d="M12 44h40M16 36h32M22 28h20"></path>
          <circle cx="32" cy="16" r="4"></circle>
        </svg>
        <span class="m-empty-state__calibration">Tour / None yet</span>
      </div>
      <div class="m-empty-state__body">
        <span class="m-label">Nothing here yet</span>
        <h2 id="no-tour-heading" class="m-section-heading">This account has no tour</h2>
        <p class="m-copy m-copy--large">Scenes, reviews, and tour details all sit under a tour. Start the tour from Home and this page fills in from there.</p>
        <div class="m-empty-state__actions"><a class="m-button m-button--primary" href="./index.html">Go to Home</a></div>
      </div>
    </section>`;
}
