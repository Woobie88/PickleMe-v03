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
    entityName, // NEW: e.g. 'players', 'draw', 'byes'
    records,
    activeEventId,
    eventIdField = 'EventID',
    emptyMessage = 'No records found',
    getIcon,
    getContentHtml,
    getOnClick,
    extraFilter = () => true,
    sortFn = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`DOM Element '#${containerId}' not found!`);
    return;
  }

  const placeholder = entityName
    ? document.getElementById(`place-holder-${entityName}`)
    : null;

  // 1. Filter down to the active event, plus any extra caller-supplied condition
  let filtered = (records || []).filter(record => {
    const recordEventId = record[eventIdField] || record.eventId;
    const matchesEvent = String(recordEventId) === String(activeEventId);
    return matchesEvent && extraFilter(record);
  });

  // 1b. Apply optional sort
  if (sortFn) {
    filtered = filtered.sort(sortFn);
  }

  // 2. Empty state
  if (filtered.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h3>${emptyMessage}</h3>
      </div>
    `;
    return;
  }

  // Hide placeholder since we have cards to show
  if (placeholder) placeholder.style.display = 'none';

  // 3. Build cards
  let cardsHtml = '';
  filtered.forEach((record, index) => {
    const iconAsset = getIcon(record, index);
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
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(payload.activeEventId)
  );
  const currentVersion = activeEvent ? activeEvent.CurrentPlayerVersion : null;

  renderEntityCards({
    containerId: 'active-players-list',
    entityName: 'players', // NEW — looks up 'place-holder-players' automatically
    records: payload.players,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Players Found',
    extraFilter: (player) => String(player.PlayerVersion) === String(currentVersion),
    sortFn: (a, b) => (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0),
    getIcon: (player, index) => { /* unchanged */ },
    getContentHtml: (player) => { /* unchanged */ },
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
