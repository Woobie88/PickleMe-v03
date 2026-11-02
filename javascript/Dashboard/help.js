/**
 * ============================================================
 * CONTEXT-SENSITIVE HELP
 * The header menu's "Help" item slides up a bottom sheet (#help-overlay,
 * styled with the same .detail-overlay classes as the game-format cards),
 * with content that depends
 * on the screen (and, for Draw / Players, the tab) the user is on.
 *
 * Requires: navigateToScreen() sets window.currentScreenId = screenId.
 *
 * To edit help text, change HELP_CONTENT below. Keys are a screen id
 * ('players') or 'screen:tab' ('draw:standings'). Each entry has:
 *   title    - overlay heading
 *   tagline  - the short quoted line under the heading
 *   sections - [{ h: 'Heading', p: ['paragraph', ...], ul: ['bullet', ...],
 *                 table: { head: ['A','B'], rows: [['a1','b1'], ...] } }]
 * Any of p / ul / table can be left out. HTML (<strong>, <em>) is allowed.
 * ============================================================
 */

const HELP_CONTENT = {

  // ---------- Home / events ----------
  dashboard: {
    title: 'Home',
    tagline: 'Your starting point',
    sections: [
      { h: 'Overview',
        p: ['Tap a card to open that part of the app. Everything else (Players, Draw, Standings) works on your <strong>active event</strong>.'] }
    ]
  },

  events: {
    title: 'My Events',
    tagline: 'Choose your active event',
    sections: [
      { h: 'Overview',
        p: ['Only events you have been given access to are listed here.'] },
      { h: 'How To Use',
        ul: ['<strong>Drag</strong> an event card to make it your active event.',
             '<strong>Tap</strong> an event to view or edit its details.'] }
    ]
  },

  'event-detail': {
    title: 'Event Details',
    tagline: 'Edit your event settings',
    sections: [
      { h: 'Overview',
        p: ['Edit the event settings here. Scoring mode, ladder scoring and the current round are shown on the Draw screen.'] }
    ]
  },

  games: {
    title: 'Games',
    tagline: 'Pick the format',
    sections: [
      { h: 'Overview',
        p: ['Choose the game format used by your active event. The format decides how players are paired, grouped and moved between courts.'] },
      { h: 'Format Groups',
        table: {
          head: ['Tab', 'Formats'],
          rows: [
            ['<strong>Traditional</strong>', 'Rotating Partners, Doubles Pro, Keep It Fair, Kings &amp; Queens, Survivor, Snakes &amp; Ladders'],
            ['<strong>Tiered</strong>',      'Divisions, Pools, Ladder Scramble, Teams, Cross Court Divisions, Pair Me Up, Rx Sports'],
            ['<strong>Novelty</strong>',     'Pool Fusion, My House, Bridge The Gap, It\u2019s A Knockout, MLB Divisions, Out Of Lives, The Two Of Us']
          ]
        } },
      { h: 'How To Use',
        ul: ['Tap the tabs at the top to browse the groups.',
             '<strong>Tap</strong> a card to read how the format works and which scoring, DUPR, play-off and redivisioning options it supports.',
             '<strong>Press and hold</strong> a card to make it the game for your active event. You\u2019ll feel a short buzz and the card is highlighted green.',
             'The highlighted game is the one used when you generate a draw.'] },
      { h: 'Good To Know',
        p: ['Activating a game also <strong>resets the event\u2019s scoring mode, draw weighting and pairing method</strong> to that game\u2019s defaults.',
            'Pressing and holding the game that is already active does nothing.'] }
    ]
  },

  // ---------- Players ----------
  players: {
    title: 'Players',
    tagline: 'Who is playing',
    sections: [
      { h: 'Overview',
        p: ['The player list for your active event. Changes made on other devices appear here automatically.'] },
      { h: 'How To Use',
        ul: ['Tap a player to view or edit their details.',
             'Use the <strong>+</strong> button to add players one at a time, or import them from an OpenSports screenshot.'] }
    ]
  },

  'players:checkin': {
    title: 'Check In',
    tagline: 'Set the bye order',
    sections: [
      { h: 'Overview',
        p: ['Decide who sits out first when there are more players than spots on court.'] },
      { h: 'How To Use',
        ul: ['<strong>Drag</strong> player cards into the order you want. It is saved when you drop a card.',
             'Players marked <strong>unavailable</strong> are left out of the draw.'] }
    ]
  },

  'player-detail': {
    title: 'Player Details',
    tagline: 'Edit one player',
    sections: [
      { h: 'How To Use',
        ul: ['Edit the name, first name or DUPR. Changes save automatically a moment after you stop typing.',
             'Mark a player <strong>unavailable</strong> to leave them out of the draw.',
             'Swipe left or right to move between this player\u2019s tabs.'] }
    ]
  },

  'add-players': {
    title: 'Add Players',
    tagline: 'One at a time, or in bulk',
    sections: [
      { h: 'Options',
        ul: ['<strong>Individual:</strong> type a name and the DUPR details fill in automatically if the player is in the database.',
             '<strong>OpenSports:</strong> scan a screenshot of the attendee list to import many players at once.'] }
    ]
  },

  'individual-add': {
    title: 'Add A Player',
    tagline: 'Add one player',
    sections: [
      { h: 'How To Use',
        ul: ['Type the full name. The first name fills in automatically unless you change it yourself.',
             'If the name is in the DUPR database, the ID and rating fill in for you. Otherwise enter them manually.'] },
      { h: 'Good To Know',
        p: ['A missing rating defaults to <strong>2.0</strong>.'] }
    ]
  },

  'opensports-import': {
    title: 'Scan OpenSports',
    tagline: 'Import from a screenshot',
    sections: [
      { h: 'How To Use',
        ul: ['Choose a clear screenshot of the attendee list and let it scan.',
             'You can scan several photos. Repeated names are only counted once.',
             'When you are done, tap <strong>Review</strong> to check the names before importing.'] }
    ]
  },

  'opensports-review': {
    title: 'Review Scanned Players',
    tagline: 'Check before you import',
    sections: [
      { h: 'How To Use',
        ul: ['Fix any name the scan got wrong, and check first names and DUPR details.',
             'Tap <strong>\u2715</strong> to remove a name you don\u2019t want to import.',
             'Highlighted rows had no DUPR match. Enter the ID and rating manually if you know them.'] }
    ]
  },

  // ---------- Draw ----------
  'generate-draw': {
    title: 'Generate Draw',
    tagline: 'Build the matches',
    sections: [
      { h: 'Overview',
        p: ['Choose the draw settings, then generate the draw for your active event.'] },
      { h: 'Good To Know',
        p: ['Generating a new draw <strong>replaces</strong> the existing one for this event.'] }
    ]
  },

  draw: {
    title: 'All Matches',
    tagline: 'The full draw',
    sections: [
      { h: 'Overview',
        p: ['Every match in the draw, grouped by round. Scores entered on any device appear here automatically.'] }
    ]
  },

  'draw:current-round': {
    title: 'Current Round',
    tagline: 'Enter scores',
    sections: [
      { h: 'How To Use',
        ul: ['Tap a match to enter or change its score.',
             'Scores update live as other people enter theirs.'] },
      { h: 'Good To Know',
        p: ['The current round is kept <strong>per device</strong>, so moving to the next round on your phone doesn\u2019t move anyone else\u2019s screen.'] }
    ]
  },

  'draw:standings': {
    title: 'Standings',
    tagline: 'The live ladder',
    sections: [
      { h: 'Overview',
        p: ['Players are ranked using the ladder scoring mode chosen at the top. Only <strong>completed</strong> matches count, and the table updates live as scores come in.'] },
      { h: 'Ladder Scoring Modes',
        table: {
          head: ['Mode', 'Ranked By', 'Tie-Breaks'],
          rows: [
            ['<strong>Wins</strong>',   'Share of games won',                    'Margin, then DUPR'],
            ['<strong>Margin</strong>', 'Share of total points won',             'Wins, then DUPR'],
            ['<strong>Overs</strong>',  'Points won compared with expected',     'Margin, Wins, then DUPR']
          ]
        } },
      { h: 'How To Use',
        ul: ['Tap a player to see their results.'] }
    ]
  },

  'match-detail': {
    title: 'Score Entry',
    tagline: 'Record the result',
    sections: [
      { h: 'How To Use',
        ul: ['Use <strong>+</strong> and <strong>\u2212</strong> to enter each team\u2019s score. It saves automatically after a moment.',
             'In <strong>Wins</strong> scoring mode you mark the winning team instead of entering points.',
             'Swipe left or right to move between matches in the same round.'] },
      { h: 'Good To Know',
        p: ['If someone else changes this match, the screen updates automatically.'] }
    ]
  },

  // ---------- Other ----------
  analytics: {
    title: 'Analytics',
    tagline: 'How the event is going',
    sections: [
      { h: 'How To Use',
        ul: ['Swipe left or right to move between the different analytics views.',
             'Results are based on the matches in the current draw.'] }
    ]
  },

  profile: {
    title: 'Profile',
    tagline: 'Your account',
    sections: [
      { h: 'How To Use',
        ul: ['Your name and email are shown here.',
             'Enter a new password and tap Update to change it. If it fails, log out, log back in and try again.'] }
    ]
  },

  // ---------- Fallback ----------
  _default: {
    title: 'Help',
    tagline: 'Getting around',
    sections: [
      { h: 'How To Use',
        ul: ['Use the bottom bar to move between sections, and the menu at the top right for more options.',
             'Everything you enter is saved automatically and shared with others working on the same event.'] }
    ]
  }
};

// Shown (as a "Good To Know" paragraph) in apps other than the main PickleMe app,
// on screens where scoring settings appear.
const HELP_LITE_NOTE =
  'In this version of the app, the game, scoring settings and current round are <strong>view-only</strong>. ' +
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

/** Builds the overlay markup in the same style as selectFormat(). */
function buildHelpHtml(content, key) {
  let html = `<span class="detail-tagline">"${content.tagline}"</span>`;

  const sections = [...content.sections];

  // Only mention view-only settings on screens where they actually appear
  const showsSettings = ['games', 'draw:current-round', 'draw:standings', 'match-detail'].includes(key);
  if (showsSettings && window.currentAppName !== 'pickleMe') {
    sections.push({ h: 'Good To Know', p: [HELP_LITE_NOTE] });
  }

  sections.forEach(sec => {
    html += `<h3>${sec.h}</h3>`;

    (sec.p || []).forEach(text => { html += `<p>${text}</p>`; });

    if (sec.ul && sec.ul.length) {
      html += '<ul>' + sec.ul.map(item => `<li>${item}</li>`).join('') + '</ul>';
    }

    if (sec.table) {
      html += `
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead><tr>${sec.table.head.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>
              ${sec.table.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  });

  return html;
}

function openHelp() {
  const key = getHelpKey();
  const content = HELP_CONTENT[key] || HELP_CONTENT[key.split(':')[0]] || HELP_CONTENT._default;

  // Don't stack two sheets if a game detail panel happens to be open
  document.getElementById('format-detail-overlay')?.classList.remove('open');

  document.getElementById('help-title').innerText = content.title;
  document.getElementById('help-body-content').innerHTML = buildHelpHtml(content, key);
  document.getElementById('help-body-content').scrollTop = 0;
  document.getElementById('help-overlay').classList.add('open');
}

function closeHelp() {
  document.getElementById('help-overlay')?.classList.remove('open');
}

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHelp();
});