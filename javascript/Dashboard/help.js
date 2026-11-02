/**
 * ============================================================
 * CONTEXT-SENSITIVE HELP
 * The header menu's "Help" item opens a sheet whose content depends on
 * the screen (and, for Draw / Players, the tab) the user is on.
 *
 * Requires: navigateToScreen() sets window.currentScreenId = screenId.
 * Edit HELP_CONTENT below to change what each screen says.
 * Keys are either a screen id ('players') or 'screen:tab' ('draw:standings').
 * ============================================================
 */

const HELP_CONTENT = {
  // ---------- Home / events ----------
  dashboard: {
    title: 'Home',
    tips: [
      'Tap a card to open that section of the app.',
      'Your active event is the one all other screens (Players, Draw, Standings) work on.'
    ]
  },
  events: {
    title: 'My Events',
    tips: [
      'Drag an event card to make it your active event.',
      'Tap an event to view or edit its details.',
      'Only events you have been given access to appear here.'
    ]
  },
  'event-detail': {
    title: 'Event Details',
    tips: [
      'Edit the event settings here; changes are saved to the event.',
      'Scoring mode, ladder scoring and the current round are shown on the Draw screen.'
    ]
  },
  games: {
    title: 'Games',
    tips: [
      'Choose the game format used by your active event.',
      'The format decides how players are grouped (e.g. teams, pairs, pools, divisions).'
    ]
  },

  // ---------- Players ----------
  players: {
    title: 'Players',
    tips: [
      'This is the player list for your active event.',
      'Tap a player to view or edit their details.',
      'Use the + button to add players one at a time or by scanning an OpenSports screenshot.',
      'Changes made on other devices appear here automatically.'
    ]
  },
  'players:checkin': {
    title: 'Check In',
    tips: [
      'Drag player cards to set the order in which players get byes.',
      'The order is saved when you drop a card.',
      'Players marked unavailable are left out of the draw.'
    ]
  },
  'player-detail': {
    title: 'Player Details',
    tips: [
      'Edit the name, first name or DUPR; changes save automatically a moment after you stop typing.',
      'Mark a player unavailable to leave them out of the draw.',
      'Swipe left or right to move between the player\u2019s tabs.'
    ]
  },
  'add-players': {
    title: 'Add Players',
    tips: [
      'Add one player at a time, or import many from an OpenSports screenshot.',
      'DUPR ratings are matched automatically by name; you can correct them before saving.'
    ]
  },
  'individual-add': {
    title: 'Add a Player',
    tips: [
      'Type the full name. The first name fills in automatically unless you change it yourself.',
      'If the name is in the DUPR database, the ID and rating fill in for you; otherwise enter them manually.',
      'A missing rating defaults to 2.0.'
    ]
  },
  'opensports-import': {
    title: 'Scan OpenSports Screenshot',
    tips: [
      'Take or choose a clear screenshot of the attendee list and tap to scan it.',
      'You can scan several photos; repeated names are only counted once.',
      'When you are done, tap Review to check the names before importing.'
    ]
  },
  'opensports-review': {
    title: 'Review Scanned Players',
    tips: [
      'Fix any name the scan got wrong, and check first names and DUPR details.',
      'Tap \u2715 to remove a name you don\u2019t want to import.',
      'Rows in a different colour had no DUPR match; enter the ID and rating manually if you know them.'
    ]
  },

  // ---------- Draw ----------
  'generate-draw': {
    title: 'Generate Draw',
    tips: [
      'Choose the draw settings, then generate the draw for your active event.',
      'Generating a new draw replaces the existing one for this event.'
    ]
  },
  draw: {
    title: 'Draw \u2013 All Matches',
    tips: [
      'Every match in the draw, grouped by round.',
      'Scores entered on any device show up here automatically.'
    ]
  },
  'draw:current-round': {
    title: 'Draw \u2013 Current Round',
    tips: [
      'Tap a match to enter or change its score.',
      'The current round is kept per device, so moving to the next round on your phone doesn\u2019t move anyone else\u2019s screen.',
      'Scores update live as other people enter them.'
    ]
  },
  'draw:standings': {
    title: 'Standings',
    tips: [
      'Players are ranked by the ladder scoring mode shown at the top: Wins, Margin or Overs.',
      'Ties are broken in order: Overs \u2192 Margin \u2192 Wins \u2192 DUPR, or Margin \u2192 Wins \u2192 DUPR, or Wins \u2192 Margin \u2192 DUPR, depending on the mode.',
      'Only completed matches count.',
      'Tap a player to see their results.'
    ]
  },
  'match-detail': {
    title: 'Score Entry',
    tips: [
      'Use + and \u2212 to enter each team\u2019s score. It saves automatically after a moment.',
      'In Wins scoring mode you mark the winning team instead of entering points.',
      'Swipe left or right to move between matches in the same round.',
      'If someone else changes this match, the screen updates automatically.'
    ]
  },

  // ---------- Other ----------
  analytics: {
    title: 'Analytics',
    tips: [
      'Swipe left or right to move between the different analytics views.',
      'Results are based on the matches in the current draw.'
    ]
  },
  profile: {
    title: 'Profile',
    tips: [
      'Your name and email are shown here.',
      'Enter a new password and tap Update to change it. If it fails, log out, log back in and try again.'
    ]
  },

  // ---------- Fallback ----------
  _default: {
    title: 'Help',
    tips: [
      'Use the bottom bar to move between sections and the menu at the top right for more options.',
      'Everything you enter is saved automatically and shared with others working on the same event.'
    ]
  }
};

// Notes appended for apps other than the main PickleMe app
const HELP_LITE_NOTE =
  'In this version of the app, scoring settings and the current round are view-only. ' +
  'They can only be changed in the main PickleMe app.';

/** Works out the help key for wherever the user currently is. */
function getHelpKey() {
  const screen = window.currentScreenId || 'dashboard';

  if (screen === 'draw') {
    if (document.getElementById('view-standings')?.classList.contains('active')) return 'draw:standings';
    if (document.getElementById('view-current-round')?.classList.contains('active')) return 'draw:current-round';
    return 'draw';
  }
  if (screen === 'players') {
    if (document.getElementById('view-checkin')?.classList.contains('active')) return 'players:checkin';
    return 'players';
  }
  return screen;
}

function openHelp() {
  const key = getHelpKey();
  const content = HELP_CONTENT[key] || HELP_CONTENT[key.split(':')[0]] || HELP_CONTENT._default;

  document.getElementById('help-title').innerText = content.title;

  let html = '<ul class="help-list">' + content.tips.map(t => `<li>${t}</li>`).join('') + '</ul>';

  // Only mention view-only settings on screens where they actually appear
  const showsSettings = ['draw:current-round', 'draw:standings', 'match-detail'].includes(key);
  if (showsSettings && window.currentAppName !== 'pickleMe') {
    html += `<p class="help-note">${HELP_LITE_NOTE}</p>`;
  }

  document.getElementById('help-body').innerHTML = html;
  document.getElementById('help-overlay').classList.add('open');
}

function closeHelp() {
  document.getElementById('help-overlay')?.classList.remove('open');
}

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHelp();
});