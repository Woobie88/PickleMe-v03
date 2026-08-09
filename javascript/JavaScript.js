/**
 * DOM ROUTING ENGINE
 * Handles app-wide section transitions
 */
function switchScreen(screenId, navButton) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const targetView = document.getElementById('screen-' + screenId);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  if (navButton) {
    navButton.classList.add('active');
    document.getElementById('app-header').innerText = navButton.querySelector('.nav-text').innerText;
  }
}

/**
 * CORE DISPATCH ROUTER
 * Enhanced to automatically trigger dashboard data loads for the My Events screen
 */
function navigateToScreen(screenId) {
  console.log("Routing viewport layout to:", screenId);
  
  const screens = document.querySelectorAll('.app-screen');
  screens.forEach(screen => {
    screen.style.display = 'none';
  });
  
  const activeScreen = document.getElementById('screen-' + screenId);
  if (activeScreen) {
    activeScreen.style.display = 'block';
  } else {
    console.error("Could not find view panel framework container:", 'screen-' + screenId);
  }

  const navMap = {
    dashboard: 'nav-dashboard',
    events: 'nav-dashboard',
    'event-detail': 'nav-dashboard',
    games: 'nav-dashboard',
    dupr: 'nav-dashboard',
    cleanup: 'nav-dashboard',
    players: 'nav-players',
    'add-players': 'nav-players',
    'generate-draw': 'nav-dashboard',
    draw: 'nav-draw',
    'match-detail': 'nav-draw',
    ladder: 'nav-ladder',
    analytics: 'nav-analytics',
    profile: 'nav-profile'
  };

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeNavId = navMap[screenId];
  if (activeNavId) {
    const activeNavEl = document.getElementById(activeNavId);
    if (activeNavEl) activeNavEl.classList.add('active');
  }

  const payload = window.cachedUserUniverse;

  switch (screenId) {
    case 'players':
      renderPlayerCards(payload);
      break;
    case 'generate-draw':
      renderGenerateDrawDetails(window.cachedUserUniverse);
      break;  
    case 'draw':
      renderDrawCards(payload);
      renderCurrentRoundView(payload);
      renderStandingsView(payload);
      break;
    case 'ladder':
      renderLadderCards(payload);
      break;
    case 'analytics':
      renderAnalyticsCards(payload);
      break;
    case 'profile':
      renderProfileCards(payload);
      break;
    case 'games':
      enableGameDragToActivate();
      renderActiveGameHighlight();
      break;
    case 'opensports-review':
      renderOpenSportsReview();
      break;
    case 'individual':
      resetIndividualAddForm();
      navigateToScreen('individual-add');
      break;
  }
}

// GLOBAL BROWSER CACHE
window.cachedUserUniverse = {
  events: [],
  activeEventId: null,
  dupr: [],
  players: [],
  draw: [],
  userAccess: []
};

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
  enableDragToActivate('active-events-list', "brett.collins028@gmail.com");
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

/**
 * Single source of truth for tap-vs-drag handling on event cards.
 * Tap opens the detail view; dragging up sets the event active.
 */
function enableDragToActivate(containerId, userEmail) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.querySelectorAll('.app-card[data-event-id]').forEach(card => {
    let startY = 0, currentY = 0, isDragging = false;

    card.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      if (deltaY < -25) {
        isDragging = true;
        const dragDistance = Math.min(Math.abs(deltaY), 80);
        card.style.transform = `translateY(${-dragDistance}px)`;
        card.style.opacity = 1 - (dragDistance / 160);
      }
    }, { passive: true });

    card.addEventListener('touchend', async () => {
      const deltaY = currentY - startY;
      card.style.transform = '';
      card.style.opacity = '';

      if (isDragging && deltaY < -60) {
        const eventId = card.dataset.eventId;

        if (String(eventId) === String(window.cachedUserUniverse.activeEventId)) {
          isDragging = false;
          return;
        }

        window.suppressNextCardClick = true;

        try {
          await window.setActiveEventInFirestore(eventId, userEmail);
          window.cachedUserUniverse.activeEventId = eventId;

          window.cachedUserUniverse.players = [];
          window.cachedUserUniverse.draw = [];

          renderUserEventCards(window.cachedUserUniverse);
          await refreshAllEventScopedViews();

        } catch (err) {
          console.error("Failed to set active event:", err);
        }
      } else if (!isDragging) {
        // Plain tap — open the detail view
        const eventId = card.dataset.eventId;
        updateActiveEvent(eventId);
      }

      isDragging = false;
    });
  });
}

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

function preFetchUserUniverseData() {
  const userEmail = "brett.collins028@gmail.com";

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

function enableCardPressFeedback(selector) {
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('touchstart', () => {
      card.classList.add('pressed');
    }, { passive: true });

    card.addEventListener('touchend', () => {
      card.classList.remove('pressed');
    });

    card.addEventListener('touchcancel', () => {
      card.classList.remove('pressed');
    });
  });
}

// Global initialization event listener running on app startup
window.addEventListener("DOMContentLoaded", async (event) => {
  console.log("App loaded. Pre-fetching database universes...");
  try {
    await preFetchUserUniverseData();
    startDrawListener();
  } catch (error) {
    console.error("Failed to load universe data:", error);
  } finally {
    const loader = document.getElementById("app-splash-preloader");
    if (loader) {
      loader.style.display = "none";
    }
  }
  initMatchSwipeHandlers();
  initCurrentRoundSwipeHandlers();
  enableCardPressFeedback('#screen-dashboard .app-card');

  document.getElementById('ind-firstname').addEventListener('input', () => {
    indFirstNameManuallyEdited = true;
  }); // ADD THIS
});

document.addEventListener('click', (e) => {
  if (window.suppressNextCardClick) {
    e.stopImmediatePropagation();
    e.preventDefault();
    window.suppressNextCardClick = false;
  }
}, true);
