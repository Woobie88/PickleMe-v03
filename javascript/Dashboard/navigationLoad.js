/**
 * ============================================================
 * CORE APP ROUTER + STARTUP
 * Handles app-wide screen transitions, bottom-nav highlighting,
 * app-startup data loading, and global touch/click behaviors
 * (tap-press feedback, suppressing a click right after a drag).
 *
 * Event Cards (My Events rendering, drag-to-activate, detail
 * edit, active-event data loading) now live in eventCards.js.
 * Player/Draw screen rendering lives in playerCards.js /
 * drawCards.js. Load order: eventCards.js should load before
 * this file, since window.cachedUserUniverse is declared there
 * and this file's DOMContentLoaded handler calls functions
 * defined in eventCards.js (preFetchUserUniverseData,
 * startDrawListener).
 * ============================================================
 */

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
    case 'generate-draw-teams':
      renderGenerateDrawTeams(window.cachedUserUniverse);
      break;
    case 'generate-draw-available':
      renderAvailabilityView(window.cachedUserUniverse, 'gd-unavailable-list', 'gd-available-list');
      break;
    case 'draw':
      renderDrawCards(payload);
      renderCurrentRoundView(payload);
      renderStandingsView(payload);
      updateDrawFabMenuVisibility();
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
    case 'redivision':
      renderRedivisionScreen(window.cachedUserUniverse);
      break;
  }
}

// ---------- GLOBAL TOUCH/CLICK FEEDBACK ----------

/**
 * Adds a .pressed class on touchstart/removes on touchend/touchcancel,
 * for cards where CSS :active alone isn't reliably visible on mobile.
 */
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

// ---------- APP STARTUP ----------

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
  initPlayerDetailSwipeHandlers(); // ADD THIS
  enableCardPressFeedback('#screen-dashboard .app-card');

  document.getElementById('ind-firstname').addEventListener('input', () => {
    indFirstNameManuallyEdited = true;
  });
});

// Suppresses a stray click firing right after a drag/long-press interaction
// (e.g. after dragging an event card to activate it, or a long-press on a
// game card) — set by whichever handler just consumed the gesture.
document.addEventListener('click', (e) => {
  if (window.suppressNextCardClick) {
    e.stopImmediatePropagation();
    e.preventDefault();
    window.suppressNextCardClick = false;
  }
}, true);
