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
      renderPlayerAvailabilityList(window.cachedUserUniverse);
      break;
    case 'draw':
      renderDrawCards(payload);
      renderCurrentRoundView(payload);
      renderStandingsView(payload);
      updateDrawFabMenuVisibility();
      break;
    case 'player-substitution':
      renderPlayerSubstitutionScreen(window.cachedUserUniverse);
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
    case 'redivision-teams':
      renderRedivisionTeamsScreen(window.cachedUserUniverse);
      break;
    case 'redivision-available':
      renderRedivisionAvailabilityList(window.cachedUserUniverse); // see #4 below
      break;
    // Add to navigateToScreen's switch statement:
    case 'redraw':
      renderRedrawScreen(window.cachedUserUniverse);
      break;
    case 'redraw-available':
      renderRedrawAvailabilityList(window.cachedUserUniverse);
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

// ---------- PROFILE --------------
window.isSignUpMode = false;

function toggleLoginMode() {
  window.isSignUpMode = !window.isSignUpMode;
  document.getElementById('login-name-group').style.display = window.isSignUpMode ? '' : 'none';
  document.getElementById('login-mode-label').innerText = window.isSignUpMode ? 'Create your account' : 'Log in to continue';
  document.getElementById('login-submit-btn').innerText = window.isSignUpMode ? 'Sign Up' : 'Log In';
  document.getElementById('login-toggle-text').innerText = window.isSignUpMode ? 'Already have an account? Log In' : "Don't have an account? Sign Up";
  document.getElementById('login-error').innerText = '';
}

async function handleLoginOrSignUp() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.innerText = '';

  if (!email || !password) {
    errorEl.innerText = 'Please enter both email and password.';
    return;
  }

  try {
    if (window.isSignUpMode) {
      const name = document.getElementById('login-name').value.trim();
      if (!name) {
        errorEl.innerText = 'Please enter your name.';
        return;
      }
      await window.signUpUser(name, email, password);
    } else {
      await window.logInUser(email, password);
    }
    // onAuthStateChanged (below) handles what happens next automatically
  } catch (err) {
    console.error("Auth error:", err);
    errorEl.innerText = err.message || 'Something went wrong.';
  }
}

// --------- RENDER PROFILE CARD ---------
function renderProfileCards(payload) {
  document.getElementById('profile-name').innerText = window.currentUserName || '—';
  document.getElementById('profile-email').innerText = window.currentUserEmail || '—';
}

async function handleUpdatePassword() {
  const newPassword = document.getElementById('profile-new-password').value;
  if (!newPassword) {
    alert("Enter a new password first.");
    return;
  }
  try {
    await window.changeUserPassword(newPassword);
    alert("Password updated successfully.");
    document.getElementById('profile-new-password').value = '';
  } catch (err) {
    console.error("Failed to update password:", err);
    alert("Failed to update password — you may need to log in again first, then retry.");
  }
}

async function handleLogOut() {
  await window.logOutUser();
  navigateToScreen('login');
}

// ---------- APP STARTUP ----------

// Global initialization event listener running on app startup
window.addEventListener("DOMContentLoaded", () => {
  window.onAuthStateChangedListener(async (user) => {
    if (user) {
      // Logged in — fetch profile, store globally, then load the app as normal
      const profile = await window.fetchUserProfile(user.uid);
      window.currentUserEmail = user.email;
      window.currentUserName = profile?.Name || '';
      window.currentUserId = user.uid;

      navigateToScreen('dashboard');

      try {
        await preFetchUserUniverseData();
        startDrawListener();
      } catch (error) {
        console.error("Failed to load universe data:", error);
      } finally {
        const loader = document.getElementById("app-splash-preloader");
        if (loader) loader.style.display = "none";
      }

      initMatchSwipeHandlers();
      initCurrentRoundSwipeHandlers();
      initPlayerDetailSwipeHandlers();
      initPlayerSubstitutionSwipeHandlers();
      enableCardPressFeedback('#screen-dashboard .app-card');

      document.getElementById('ind-firstname')?.addEventListener('input', () => {
        indFirstNameManuallyEdited = true;
      });

    } else {
      // Not logged in — show the login screen, hide the splash
      navigateToScreen('login');
      const loader = document.getElementById("app-splash-preloader");
      if (loader) loader.style.display = "none";
    }
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
