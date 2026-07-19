/**
 * GENERIC CARD LIST RENDERER
 * Renders any array of records into the same visual card structure.
 * Each caller supplies how to filter, icon, and build content for its data type.
 *
 * @param {Object} options
 * @param {string} options.containerId - DOM id to render into
 * @param {Array} options.records - full array of records (e.g. payload.players)
 * @param {string} options.activeEventId - the currently active EventID
 * @param {string} [options.eventIdField='EventID'] - field name holding the EventID on each record
 * @param {string} options.emptyMessage - message shown when there's nothing to display
 * @param {Function} options.getIcon - (record) => icon URL or emoji string
 * @param {Function} options.getContentHtml - (record) => inner HTML for .card-content
 * @param {Function} [options.getOnClick] - (record) => onclick attribute string (optional)
 */
function renderEntityCards(options) {
  const {
    containerId,
    records,
    activeEventId,
    eventIdField = 'EventID',
    emptyMessage = 'No records found',
    getIcon,
    getContentHtml,
    getOnClick
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`DOM Element '#${containerId}' not found!`);
    return;
  }

  // 1. Filter down to the active event only
  const filtered = (records || []).filter(record => {
    const recordEventId = record[eventIdField] || record.eventId;
    return String(recordEventId) === String(activeEventId);
  });

  // 2. Empty state
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h3>${emptyMessage}</h3>
      </div>
    `;
    return;
  }

  // 3. Build cards
  let cardsHtml = '';
  filtered.forEach(record => {
    const iconAsset = getIcon(record);
    const iconMarkup = iconAsset.startsWith('http')
      ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images">`
      : `<span class="card-icon">${iconAsset}</span>`;

    const onClickAttr = getOnClick ? `onclick="${getOnClick(record)}"` : '';

    cardsHtml += `
      <div class="app-card" ${onClickAttr}>
        <div class="card-icon-wrapper">
          ${iconMarkup}
        </div>
        <div class="card-content">
          ${getContentHtml(record)}
        </div>
        <span class="card-arrow">→</span>
      </div>
    `;
  });

  container.innerHTML = cardsHtml;
  console.log(`Successfully rendered ${filtered.length} card(s) into #${containerId}.`);
}

function renderPlayerCards(payload) {
  console.log('Calling renderPlayerCards');
  renderEntityCards({
    containerId: 'active-players-list',
    records: payload.players,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Players Found',
    getIcon: (player) => '🎾', // swap for a seed/skill icon lookup later
    getContentHtml: (player) => `
      <h3>${player.Name (player.FirstName) || 'Unnamed Player'}</h3>
      <p class="card-meta-line">DUPR: ${player.DUPR || 'N/A'}</p>
    `,
    getOnClick: (player) => `viewPlayerDetail('${player.PlayerID}')`
  });
}

function renderDrawCards(payload) {
  renderEntityCards({
    containerId: 'active-draw-list',
    records: payload.draw,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Draw Published Yet',
    getIcon: (drawEntry) => courts[0]['court-' + drawEntry.Court] || '🏟️',
    getContentHtml: (drawEntry) => `
      <h3>Court ${drawEntry.Court || '—'}</h3>
      <p class="card-meta-line">Round ${drawEntry.Round || '—'}</p>
    `
  });
}
