/**
 * ============================================================
 * EVENT CARDS
 * Covers: the My Events screen (card rendering, day-of-week
 * icons), tap-vs-drag handling to view detail or set the
 * active event, the Event Detail edit form (courts/DUPR limit
 * steppers), and the data-loading pipeline that fetches events
 * from Firestore on app startup and re-fetches player/draw
 * data whenever the active event changes.
 *
 * Depends on functions defined elsewhere:
 * - navigateToScreen() — core router, in JavaScript.js
 * - renderPlayerCards(), renderGenerateDrawDetails() — playerCards.js
 * - renderDrawCards(), renderCurrentRoundView(), renderStandingsView() — drawCards.js
 * - window.fetchEventsFromFirestore(), window.setActiveEventInFirestore(),
 *   window.updateEventInFirestore(), window.listenToDrawChanges() — fireStone.js
 *
 * window.cachedUserUniverse (the global in-memory cache) is
 * declared here since it's first populated by this file's
 * preFetchUserUniverseData(), but it's read/written from
 * every other screen file too.
 * ============================================================
 */

// GLOBAL BROWSER CACHE
window.cachedUserUniverse = {
  events: [],
  activeEventId: null,
  dupr: [],
  players: [],
  draw: [],
  userAccess: []
};

// ---------- MY EVENTS SCREEN RENDERING ----------

/**
 * Builds the event elements out of client-side cache
 */
function renderUserEventCards(payload) {
  console.log("renderUserEventCards received payload:", payload);

  const container = document.getElementById('active-events-list');
  if (!container) {
    console.error("DOM Element '#active-events-list' not found!");
    return;
  }

  let events = [];
  let activeId = null;

  if (payload && payload.events) {
    events = payload.events;
    activeId = payload.activeEventId;
  } else if (Array.isArray(payload)) {
    events = payload;
    activeId = window.cachedUserUniverse ? window.cachedUserUniverse.activeEventId : null;
  }

  if (events.length === 0) {
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h3>No Authorized Events Found</h3>
      </div>
    `;
    return;
  }

  events.sort((a, b) => {
    const dateA = a.EventDate || a.eventDate || '';
    const dateB = b.EventDate || b.eventDate || '';
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateA) - new Date(dateB);
  });

  let currentEventHtml = '';
  let otherEventsHtml = '';
  let otherCount = 0;

  events.forEach(event => {
    const currentId = event.EventID || event.eventId;
    const isActive = (String(currentId) === String(activeId));

    const rawDate = event.EventDate || event.eventDate || '';
    let displayDate = 'Ongoing';
    if (rawDate) {
      displayDate = rawDate.split('T')[0];
    }

    const iconAsset = getDayIconUrl(rawDate);
    const iconMarkup = `<img src="${iconAsset}" alt="Day Icon" class="card-icon-images">`;

    const cardClass = isActive ? 'app-card active-event' : 'app-card';
    const activeBadge = isActive ? `<span class="active-pill-badge">ACTIVE</span>` : '';

    const cardMarkup = `
      <div class="${cardClass}" id="event-card-${currentId}" data-event-id="${currentId}">
        <div class="card-icon-wrapper">
          ${iconMarkup}
        </div>
        <div class="card-content">
          <h3>${event.EventName || 'Unnamed Event'} ${activeBadge}</h3>
          <p>📍 ${event.EventLocation || 'Main Facility'}</p>
          <p class="card-meta-line">
            ${displayDate} &nbsp;||&nbsp; ${event.NumberofCourts || 1} Courts
          </p>
        </div>
        <span class="card-arrow">→</span>
      </div>
    `;

    if (isActive) {
      currentEventHtml += cardMarkup;
    } else {
      otherEventsHtml += cardMarkup;
      otherCount++;
    }
  });

  let finalHtml = '';

  if (currentEventHtml) {
    finalHtml += `
      <div class="event-section-title current">Current Event</div>
      ${currentEventHtml}
    `;
  }

  if (otherCount > 0) {
    finalHtml += `
      <div class="event-section-title other">Other Events</div>
      ${otherEventsHtml}
    `;
  }

  container.innerHTML = finalHtml;
  enableLongHoldToActivate(containerId, userEmail);
  console.log("Successfully rendered event grid sorted chronologically (ascending).");
}

function getDayIconUrl(dateString) {
  const fallbackEmoji = "🎾";

  if (!dateString) return fallbackEmoji;

  try {
    const pureDateStr = dateString.split('T')[0];
    const parts = pureDateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = dayNames[dateObj.getDay()];

    const iconUrl = daysOfWeek[0][targetDayName];
    return iconUrl || fallbackEmoji;
  } catch (err) {
    console.error("Error evaluating day icon:", err);
    return fallbackEmoji;
  }
}

// ---------- TAP-VS-LONG-HOLD: VIEW DETAIL OR SET ACTIVE EVENT ----------

/**
 * Single source of truth for tap-vs-long-hold handling on event cards.
 *
 * Tap       → opens the event detail view
 * Long hold → sets the event as the active event
 *
 * A small amount of finger movement is allowed during the hold so
 * normal mobile touch movement does not accidentally cancel it.
 */
function enableLongHoldToActivate(containerId, userEmail) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll('.app-card[data-event-id]').forEach(card => {

    let holdTimer = null;
    let isLongHold = false;
    let startX = 0;
    let startY = 0;

    const HOLD_DURATION = 650; // milliseconds
    const MAX_MOVEMENT = 15;   // pixels allowed while holding


    // ------------------------------------------------------------
    // TOUCH START
    // ------------------------------------------------------------

    card.addEventListener('touchstart', (e) => {

      if (!e.touches || !e.touches.length) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      isLongHold = false;

      clearTimeout(holdTimer);

      holdTimer = setTimeout(async () => {

        isLongHold = true;

        const eventId = card.dataset.eventId;

        // --------------------------------------------------------
        // Already active — nothing to do
        // --------------------------------------------------------

        if (
          String(eventId) ===
          String(window.cachedUserUniverse.activeEventId)
        ) {
          return;
        }

        // --------------------------------------------------------
        // Visual feedback
        // --------------------------------------------------------

        card.classList.add('long-hold-active');

        // Prevent the subsequent touchend from being interpreted
        // as a normal tap.
        window.suppressNextCardClick = true;

        try {

          // ------------------------------------------------------
          // Set active event in Firestore
          // ------------------------------------------------------

          await window.setActiveEventInFirestore(
            eventId,
            userEmail
          );

          // ------------------------------------------------------
          // Update local active event
          // ------------------------------------------------------

          window.cachedUserUniverse.activeEventId = eventId;

          // ------------------------------------------------------
          // Clear stale event-specific data
          // ------------------------------------------------------

          window.cachedUserUniverse.players = [];
          window.cachedUserUniverse.draw = [];

          // ------------------------------------------------------
          // Re-render event cards
          // ------------------------------------------------------

          renderUserEventCards(
            window.cachedUserUniverse
          );

          // ------------------------------------------------------
          // Refresh all event-scoped views
          // ------------------------------------------------------

          await refreshAllEventScopedViews();

        } catch (err) {

          console.error(
            "Failed to set active event:",
            err
          );

        } finally {

          card.classList.remove('long-hold-active');

        }

      }, HOLD_DURATION);

    }, { passive: true });


    // ------------------------------------------------------------
    // TOUCH MOVE
    // ------------------------------------------------------------

    card.addEventListener('touchmove', (e) => {

      if (!e.touches || !e.touches.length) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const deltaX = Math.abs(currentX - startX);
      const deltaY = Math.abs(currentY - startY);

      // Allow small natural finger movement.
      // Cancel the hold only if the finger moves too far.
      if (
        deltaX > MAX_MOVEMENT ||
        deltaY > MAX_MOVEMENT
      ) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }

    }, { passive: true });


    // ------------------------------------------------------------
    // TOUCH END
    // ------------------------------------------------------------

    card.addEventListener('touchend', () => {

      clearTimeout(holdTimer);
      holdTimer = null;

      if (!isLongHold) {

        // --------------------------------------------------------
        // Normal tap → open detail view
        // --------------------------------------------------------

        const eventId = card.dataset.eventId;

        updateActiveEvent(eventId);
      }

      isLongHold = false;

    });


    // ------------------------------------------------------------
    // TOUCH CANCEL
    // ------------------------------------------------------------

    card.addEventListener('touchcancel', () => {

      clearTimeout(holdTimer);
      holdTimer = null;

      isLongHold = false;

    });

  });
}

/**
 * Re-fetches and re-renders whatever event-scoped screens are currently
 * visible, and restarts the real-time draw listener — called right after
 * the active event changes, since Players/Draw/Standings/the listener are
 * all scoped to a specific EventID and would otherwise show stale data.
 */
async function refreshAllEventScopedViews() {
  const payload = window.cachedUserUniverse;

  // Players screen
  if (document.getElementById('screen-players')?.style.display === 'block') {
    await renderPlayerCards(payload);
  }

  // Draw screen (any of its three tabs)
  if (document.getElementById('screen-draw')?.style.display === 'block') {
    await renderDrawCards(payload);
    await renderCurrentRoundView(payload);
    await renderStandingsView(payload);
  }

  // Generate Draw screen
  if (document.getElementById('screen-generate-draw')?.style.display === 'block') {
    renderGenerateDrawDetails(payload);
  }

  // Also restart the real-time listener, since it's scoped to a specific EventID/DrawVersion
  startDrawListener();
}

// ---------- EVENT DETAIL EDIT FORM ----------

/**
 * ACTION ROUTINE: Instantly targets a tournament, filters its data locally, and syncs the sheet in background
 */
function updateActiveEvent(eventId) {
  console.log("Loading event detail state for ID:", eventId);

  if (!window.cachedUserUniverse || !window.cachedUserUniverse.events) {
    console.error("Global cache universe is missing!");
    return;
  }

  const targetEvent = window.cachedUserUniverse.events.find(e => String(e.EventID || e.eventId) === String(eventId));

  if (!targetEvent) {
    alert("Error: Tournament record could not be found.");
    return;
  }

  let inputDate = '';
  if (targetEvent.EventDate) {
    inputDate = targetEvent.EventDate.split('T')[0];
  }

  const detailContainer = document.getElementById('event-detail-content');
  if (!detailContainer) return;

  const duprVal = targetEvent["DUPR Limit"] !== undefined ? targetEvent["DUPR Limit"] : (targetEvent.duprLimit || 0);

  detailContainer.innerHTML = `
    <input type="hidden" id="edit-event-id" value="${targetEvent.EventID || ''}">

    <div class="detail-form-group">
      <label for="edit-event-name">Event Name</label>
      <input type="text" id="edit-event-name" class="detail-input" value="${targetEvent.EventName || ''}">
    </div>

    <div class="detail-form-group">
      <label for="edit-event-date">Date</label>
      <input type="date" id="edit-event-date" class="detail-input" value="${inputDate}">
    </div>

    <div class="detail-form-group">
      <label for="edit-event-location">Location</label>
      <input type="text" id="edit-event-location" class="detail-input" value="${targetEvent.EventLocation || ''}">
    </div>

    <div class="detail-form-group">
      <label>Number of Courts</label>
      <div class="score-control">
        <button class="score-btn" onclick="adjustCourts(-1)">−</button>
        <span id="courts-value" class="score-value">${targetEvent.NumberofCourts || 1}</span>
        <button class="score-btn" onclick="adjustCourts(1)">+</button>
      </div>
      <input type="hidden" id="edit-event-courts" value="${targetEvent.NumberofCourts || 1}">
    </div>
    
    <div class="detail-form-group">
      <label>DUPR Limit</label>
      <div class="score-control">
        <button class="score-btn" onclick="adjustDuprLimit(-1)">−</button>
        <span id="dupr-value" class="score-value">${duprVal}</span>
        <button class="score-btn" onclick="adjustDuprLimit(1)">+</button>
      </div>
      <input type="hidden" id="edit-event-dupr" value="${duprVal}">
    </div>

    <div class="form-action-bar">
      <button class="btn-secondary" onclick="navigateToScreen('events')">Cancel</button>
      <button class="btn-primary" onclick="updateActiveEventDetails()">Update</button>
    </div>
  `;

  navigateToScreen('event-detail');
}

function adjustCourts(direction) {
  const hiddenInput = document.getElementById('edit-event-courts');
  const displaySpan = document.getElementById('courts-value');

  let current = parseInt(hiddenInput.value) || 1;
  current += direction;
  current = Math.max(1, current); // minimum 1

  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustDuprLimit(direction) {
  const hiddenInput = document.getElementById('edit-event-dupr');
  const displaySpan = document.getElementById('dupr-value');

  let current = parseFloat(hiddenInput.value) || 0;

  if (direction > 0) {
    // Increasing
    if (current === 0) {
      current = 2; // first press from 0 jumps straight to 2
    } else {
      current = Math.round((current + 0.25) * 100) / 100; // avoid floating point drift
    }
  } else {
    // Decreasing
    if (current > 2) {
      current = Math.round((current - 0.25) * 100) / 100;
    } else if (current === 2) {
      current = 0; // stepping down from 2 goes straight back to 0
    }
    // if current is already 0, do nothing (stays at 0 — the floor)
  }

  current = Math.max(0, current); // safety floor
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

async function updateActiveEventDetails() {
  const eventId = document.getElementById('edit-event-id').value;
  if (!eventId) {
    console.error("Missing event context ID context framework.");
    return;
  }

  const updatedData = {
    EventID: eventId,
    EventName: document.getElementById('edit-event-name').value,
    EventDate: document.getElementById('edit-event-date').value,
    EventLocation: document.getElementById('edit-event-location').value,
    NumberofCourts: parseInt(document.getElementById('edit-event-courts').value, 10) || 1,
    "DUPR Limit": parseFloat(document.getElementById('edit-event-dupr').value) || 0
  };

  console.log("Saving form data adjustments:", updatedData);

  if (window.cachedUserUniverse) {
    const eventIndex = window.cachedUserUniverse.events.findIndex(e => String(e.EventID || e.eventId) === String(eventId));
    if (eventIndex !== -1) {
      window.cachedUserUniverse.events[eventIndex] = {
        ...window.cachedUserUniverse.events[eventIndex],
        ...updatedData
      };
    }
    renderUserEventCards(window.cachedUserUniverse);
  }

  try {
    await window.updateEventInFirestore(eventId, updatedData);
    console.log("Event updated successfully in Firestore.");
  } catch (err) {
    console.error("Failed to update event in Firestore:", err);
  }

  navigateToScreen('events');
}

// ---------- ACTIVE-EVENT DATA LOADING (app startup + event switching) ----------

function preFetchUserUniverseData() {
  const userEmail = window.currentUserEmail;

  return window.fetchEventsFromFirestore(userEmail)
    .then(payload => {
      console.log("Firestore events fetch successful!", payload);
      window.cachedUserUniverse.events = payload.events;
      window.cachedUserUniverse.activeEventId = payload.activeEventId;
      renderUserEventCards(window.cachedUserUniverse);
      return payload;
    })
    .catch(err => {
      console.error("Firestore fetch failed: " + (err.message || err));
      throw err;
    });
}

/**
 * Starts a real-time Firestore listener scoped to the current active
 * event's draw. Called on app startup and again every time the active
 * event changes (via refreshAllEventScopedViews), tearing down any
 * previous listener first so only one is ever running at a time.
 */
function startDrawListener() {
  // Stop any previously running listener before starting a new one
  if (window.currentDrawUnsubscribe) {
    window.currentDrawUnsubscribe();
    window.currentDrawUnsubscribe = null;
  }

  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  const drawVersion = activeEvent.CurrentDrawVersion;

  window.currentDrawUnsubscribe = window.listenToDrawChanges(activeEventId, drawVersion, (matches) => {
    console.log("Live draw update received:", matches.length, "matches");
    window.cachedUserUniverse.draw = matches;

    if (document.getElementById('view-current-round')?.classList.contains('active')) {
      renderCurrentRoundView(window.cachedUserUniverse);
    }
    if (document.getElementById('view-standings')?.classList.contains('active')) {
      renderStandingsView(window.cachedUserUniverse);
    }
    if (document.getElementById('screen-draw')?.style.display === 'block') {
      renderDrawCards(window.cachedUserUniverse);
    }
  });
}
