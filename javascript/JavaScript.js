const daysOfWeek = [{
  "Monday": "https://i.postimg.cc/cJzgM84t/Monday.png",
  "Tuesday": "https://i.postimg.cc/g07Xq6kW/Tuesday.png",
  "Wednesday": "https://i.postimg.cc/5trYqFNJ/Wednesday.png",
  "Thursday": "https://i.postimg.cc/MGHfQYxH/Thursday.png",
  "Friday": "https://i.postimg.cc/W4yF6JbF/Friday.png",
  "Saturday": "https://i.postimg.cc/bv5DH2N2/Saturday.png",
  "Sunday": "https://i.postimg.cc/Dz04XcFm/Sunday.png"
}];

const courts = [{
  "court-1": "https://i.postimg.cc/cJCTLYbB/1.png",
  "court-2": "https://i.postimg.cc/rpsgwWPC/2.png",
  "court-3": "https://i.postimg.cc/N0nD9M31/3.png",
  "court-4": "https://i.postimg.cc/9f01QTnd/4.png",
  "court-5": "https://i.postimg.cc/q7qQvn5c/5.png",
  "court-6": "https://i.postimg.cc/q7FwhRPL/6.png",
  "court-7": "https://i.postimg.cc/k5Hs640N/7.png",
  "court-8": "https://i.postimg.cc/Pq7ypxgM/8.png"
}]

const playerSeeds = [{
  "seed-1": "https://i.postimg.cc/jq3xWr2b/1.png",
  "seed-2": "https://i.postimg.cc/kMYJVdGd/2.png",
  "seed-3": "https://i.postimg.cc/BZ7S8Gb3/3.png",
  "seed-4": "https://i.postimg.cc/jq3xWr2t/4.png",
  "seed-5": "https://i.postimg.cc/gctzwPjc/5.png",
  "seed-6": "https://i.postimg.cc/Y2Dr4w0q/6.png",
  "seed-7": "https://i.postimg.cc/KcpGKyj8/7.png",
  "seed-8": "https://i.postimg.cc/WpYNDPz4/8.png",
  "seed-9": "https://i.postimg.cc/Y2Dr4w0j/9.png",
  "seed-10": "https://i.postimg.cc/FFCrfQzY/10.png",
  "seed-11": "https://i.postimg.cc/T2NdyX1y/11.png",
  "seed-12": "https://i.postimg.cc/HWvYJCnX/12.png",
  "seed-13": "https://i.postimg.cc/jq3xWr2w/13.png",
  "seed-14": "https://i.postimg.cc/BZ7S8Gbx/14.png",
  "seed-15": "https://i.postimg.cc/tRvq1HJd/15.png",
  "seed-16": "https://i.postimg.cc/WbD2gfqh/16.png",
  "seed-17": "https://i.postimg.cc/4NKJVFHh/17.png",
  "seed-18": "https://i.postimg.cc/PrLtYFvW/18.png",
  "seed-19": "https://i.postimg.cc/4NKJVFHv/19.png",
  "seed-20": "https://i.postimg.cc/fT3wmgSx/20.png"
}]


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
  
  // 1. Hide all screen containers across the panel frame
  const screens = document.querySelectorAll('.app-screen');
  screens.forEach(screen => {
    screen.style.display = 'none';
  });
  
  // 2. Reveal the specific target dashboard panel
  const activeScreen = document.getElementById('screen-' + screenId);
  if (activeScreen) {
    activeScreen.style.display = 'block';
  } else {
    console.error("Could not find view panel framework container:", 'screen-' + screenId);
  }
}

/**
 * SUB-TAB CONTROL ENGINE FOR GAME SELECTOR MODULE
 */
function switchGameTab(tabId) {
  // 1. Clear highlight state from tabs
  document.querySelectorAll('.top-tab-bar .tab-item').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // 2. Hide all layout card groupings 
  document.querySelectorAll('.tab-viewport .tab-view').forEach(view => {
    view.classList.remove('active');
  });
  
  // 3. Mount targeted selections cleanly
  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');
}

/**
 * FORMAT CARD SELECTION HANDLING ENGINE
 * Intercepts selection data, builds dynamic template markup, and slides up detail panel
 * @param {string} formatKey - Systematic key descriptor of tapped card
 */
function selectFormat(formatKey) {
  let title = "";
  let htmlContent = "";

  switch (formatKey) {
    case 'rotating-partners':
      title = "Rotating Partners";
      htmlContent = `
        <span class="detail-tagline">"Maximise social interaction"</span>
        <h3>Game Overview</h3>
        <p>Round robin type event, where players play with and against as many other players as possible, i.e. each player has maximum exposure to all players.</p>
        <h3>When To Play</h3>
        <p>When you want to maximise social interaction or when you have a "smallish" DUPR spread across all players.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>DUPR events</li>
          <li>Scoring and non scoring variants</li>
          <li>Can be combined with play offs, if scored</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Available post rounds</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'doubles-pro':
      title = "Doubles Pro";
      htmlContent = `
        <span class="detail-tagline">"Tournament practice"</span>
        <h3>Game Overview</h3>
        <p>Same as a tournament structure, in that players are partnered up at the beginning of the event and stay together as a team for the entirety. Matches are built based on a single round robin (i.e. no divisions) basis.</p>
        <p>Pairings are built based on seedings, with the highest seed paired with the lowest, etc.</p>
        <h3>When To Play</h3>
        <p>When you want to give your event a tournament type feel.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Tournament preparation and structured match practice.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Yes</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'keep-it-fair':
      title = "Keep It Fair";
      htmlContent = `
        <span class="detail-tagline">"Balanced match ups"</span>
        <h3>Game Overview</h3>
        <p>Round robin type event, similar to Rotating Partners but with one exception: <strong>In this game you specify the allowable DUPR difference between pairings,</strong> in order to keep the match ups balanced.</p>
        <h3>When To Play</h3>
        <p>When you want to maximise social interaction while still maintaining close, competitive matchups.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>DUPR events where balancing team combinations matters.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Available post rounds</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'the-two-of-us':
      title = "The Two Of Us";
      htmlContent = `
        <span class="detail-tagline">"Tournament practice"</span>
        <h3>Game Overview</h3>
        <p>Similar to Rotating Partners, in that the game is a round robin style format where players partner and oppose multiple players. The main difference, is that you can <strong>select partners who will stay together</strong> for the whole event.</p>
        <p>In this way, it <strong>accommodates players who wish to stay partnered to practice for upcoming tournaments</strong>, while letting individual sign-ups continue rotating.</p>
        <h3>When To Play</h3>
        <p>Great game for enabling selected fixed partners to play together throughout the event, against multiple changing opposing partnerships.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Enabling tournament practice while keeping the rest of the pool open to play with and against multiple players.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'divisions':
      title = "Divisions";
      htmlContent = `
        <span class="detail-tagline">"Split by skill level"</span>
        <h3>Game Overview</h3>
        <p>Players are seeded and split by ranking into distinct groups or divisions. Players only play with and against others within their assigned group. For example, if you have 16 players split across 2 groups, seeds 1 to 8 populate Group 1, while seeds 9 to 16 are placed in Group 2.</p>
        <h3>When To Play</h3>
        <p>When your event draws players of all skill levels, and the overall DUPR or internal rating spread is relatively large.</p>
        <h3>Perfect For</h3>
        <ul>
          <li><strong>Court Requirements:</strong> Each group must have a minimum of 4 players. Games per round must be either equal or perfectly divisible by the number of groups (e.g., 3 groups on 3 courts, or 2 groups on 4 courts work perfectly, but 3 groups running across 4 courts is not allowed).</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Within Division</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'teams':
      title = "Teams";
      htmlContent = `
        <span class="detail-tagline">"Team game"</span>
        <h3>Game Overview</h3>
        <p>Players are allocated to balanced teams based on a selected draft generation layout. Players from those respective squads then combine forces to play matches against opposing teams.</p>
        <p>Your available draft logic options are:</p>
        <ul>
          <li><strong>Snake Draft:</strong> A 3-team pattern allocates seed 1 to Team 1, seed 2 to Team 2, and seed 3 to Team 3. In the second draft round, seed 4 goes to Team 3, seed 5 to Team 2, and seed 6 to Team 1 before continuing to "snake."</li>
          <li><strong>3rd Round Reversal (3RR):</strong> Identical to the snake sequence, except the absolute structural direction of the draft reverses when starting round 3. This is globally utilized to create fairer overall team balances.</li>
        </ul>
        <h3>When To Play</h3>
        <p>A high-energy scoring option when you want to inject a collective team element and unified camaraderie into your event.</p>
        <h3>Perfect For</h3>
        <ul>
          <li><strong>Roster Sizes:</strong> Each team must contain at least 4 players.</li>
          <li><strong>Field Caps:</strong> Accommodates either 2 or 3 teams. If running a 3-team format, 3 open courts must be available simultaneously.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'ladder-scramble':
      title = "Ladder Scramble";
      htmlContent = `
        <span class="detail-tagline">"Promotion and relegation"</span>
        <h3>Game Overview</h3>
        <p>Similar to standard Divisions, where players are seeded and split by initial ranking tier into distinct groups. Players only play with and against others assigned to their current ladder flight.</p>
        <p>The key driver here is that after the first block of games, <strong>players are completely reranked based on live match results, and divisions are reallocated dynamically</strong>.</p>
        <p><em>Scheduling Tip:</em> The ideal length for a flight block is the number of rounds required for all players to partner each other exactly once (e.g., a 5-player division tracking 1 court takes 5 rounds to complete a cycle).</p>
        <h3>When To Play</h3>
        <p>When an event has a wide variety of skill levels or large DUPR variations, but you want to offer an ongoing path for player progression and shifting competition tiers.</p>
        <p style="text-align: center; color: var(--accent); margin: 14px 0; font-size: 0.9rem;">
          Once all matches in a round finish, tap the 🔀 button inside the <strong>Draw / All Matches</strong> screen to recalculate.
        </p>
        <h3>Perfect For</h3>
        <ul>
          <li><strong>Court Requirements:</strong> Requires a minimum of 4 players per group. Round structures must align cleanly with your available court counts (e.g., 3 groups on 3 courts or 2 groups on 4 courts).</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'pools':
      title = "Pools";
      htmlContent = `
        <span class="detail-tagline">"Competitive tournament style"</span>
        <h3>Game Overview</h3>
        <p>Similar to standard divisions, except players are distributed across flights using advanced seeding logic modeled straight after major tournament brackets. Rather than cutting the field into straight numerical blocks (e.g., top 6, next 5), players are assigned via draft paths:</p>
        <ul>
          <li><strong>Snake Draft:</strong> Distributes seeds back-and-forth across pools (e.g., for 3 pools: Seed 1 to Pool 1, Seed 2 to Pool 2, Seed 3 to Pool 3, and then looping backward with Seed 4 to Pool 3).</li>
          <li><strong>3rd Round Reversal (3RR):</strong> Reverses the directional flow specifically at the start of the third round to ensure even, competitive weight distribution across all pools.</li>
        </ul>
        <h3>When To Play</h3>
        <p>Perfect for structured events where you have a tighter, more uniform skill/DUPR range across the entire field and want an authentic tournament pool play feel.</p>
        <h3>Perfect For</h3>
        <ul>
          <li><strong>Court Requirements:</strong> Minimum of 4 players per pool. Round setups must balance cleanly against available spaces (e.g., 3 groups on 3 courts or 2 groups on 4 courts).</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Across Pools</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'mid-tier-divisions':
      title = "Mid Tier Divisions";
      htmlContent = `
        <span class="detail-tagline">"Segregate top and bottom players"</span>
        <h3>Game Overview</h3>
        <p>An advanced mix of game mechanics. While players are seeded and separated into groups by rank, the system enables you to tag explicit players by DUPR/skill level who are locked to only play within their assigned flight.</p>
        <p>Concurrently, the engine maps out mid-tier crossover players who are eligible to rotate and play <em>across</em> different divisions.</p>
        <p><strong>This layout gives you the flexibility to simultaneously execute structured Divisions for some court flights, and social Rotating Partners for others.</strong></p>
        <h3>When To Play</h3>
        <p>Highly effective configuration if you need to run 2 locked divisions across 3 physical courts, using Court 2 as an open, fluid crossover court for mid-tier ranking matches.</p>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'pool-fusion':
      title = "Pool Fusion";
      htmlContent = `
        <span class="detail-tagline">"Competitive tournament style"</span>
        <h3>Game Overview</h3>
        <p>Identical seeding matrix rules to standard Pools, where players are cross-drafted across separate brackets using either a <strong>Snake Draft</strong> or a <strong>3rd Round Reversal (3RR)</strong> system to balance the structural strength of every group from the start.</p>
        <h3>When To Play</h3>
        <p>Deploy this format when handling an integrated, highly competitive field with a relatively tight DUPR spread where you intend to transition into multi-pool playoff brackets.</p>
        <h3>Perfect For</h3>
        <ul>
          <li><strong>Court Requirements:</strong> Minimum of 4 players required per pool. Court allocations must divide evenly based on your total pool configurations.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>None; Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>Across Pools</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'kings-queens':
      title = "Kings & Queens";
      htmlContent = `
        <span class="detail-tagline">"The traditional game"</span>
        <h3>Game Overview</h3>
        <p>A classic ladder climber system modeled on King of the Court mechanics with unique court entry exceptions:</p>
        <ul>
          <li><strong>Movement Matrix:</strong> Courts are designated top to bottom. Match winners move up 1 court flight, while losers drop down 1 court level. Exception: If you are already occupying the top or bottom court, you remain stationary.</li>
          <li><strong>Partner Splitting:</strong> Winning and losing pairings completely split and shuffle after every single round.</li>
          <li><strong>The Bye Penalty Rule:</strong> Any player returning from a rest or bye round is forced to restart on the lowest-ranked court. This means a losing team from the previous round could potentially be bumped up. Returning players must always earn their way back up to Court 1.</li>
        </ul>
        <h3>When To Play</h3>
        <p>When you want to run a highly competitive, fast-paced layout that rewards clear on-court performance.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Organizers wanting an authentic, traditional "King of the Court" tournament flow.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'survivor':
      title = "Survivor";
      htmlContent = `
        <span class="detail-tagline">"Winning combos are rewarded"</span>
        <h3>Game Overview</h3>
        <p>Built directly on the Kings & Queens court matrix model, with a major alteration to how top partnerships are managed:</p>
        <ul>
          <li><strong>Court Ascent:</strong> Courts are mapped top to bottom. Winners climb 1 court, losers descend 1 court.</li>
          <li><strong>The Top Court Lock:</strong> On Court 1 (Top Court) ONLY, the winning partners **stay together as a locked team**. Concurrently, the two winners climbing up from Court 2 will also stay together to challenge them. Continuous wins lock your partnership down.</li>
          <li><strong>The Bye Penalty Rule:</strong> Just like Kings & Queens, a player coming off a bye automatically re-enters on the lowest-ranked court, forcing them to fight back up to the top ladder spots.</li>
        </ul>
        <h3>When To Play</h3>
        <p>When you want a competitive bracket layout that actively builds chemistry and rewards consistent pair performance.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>A high-stakes alternative to King of the Court that rewards team endurance.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'out-of-lives':
      title = "Out Of Lives";
      htmlContent = `
        <span class="detail-tagline">"Promotes defence"</span>
        <h3>Game Overview</h3>
        <p>An endurance-style format where errors are costly. Every player begins the event with a set pool of **lives**. Losing a match costs you exactly 1 life—with zero opportunities to buy back or regain them.</p>
        <ul>
          <li><strong>Dynamic Court Allocation:</strong> Courts are sorted dynamically from top to bottom based on remaining lives. Players holding the cleanest record play on Court 1, while players low on lives cascade down to the base courts.</li>
          <li><strong>Configuration Tip:</strong> The start pool of lives can be customized based on your event timeline, though matching or setting it slightly below your total round count yields the highest competitive pressure.</li>
        </ul>
        <h3>When To Play</h3>
        <p>When you want long-term match consistency across the entire life of your tournament to heavily impact placement and court assignments.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Injected survival mechanics that shake up standard round-robin variants.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'snakes-ladders':
      title = "Snakes & Ladders";
      htmlContent = `
        <span class="detail-tagline">"Super punishment for losses"</span>
        <h3>Game Overview</h3>
        <p>A high-punishment variation of Kings & Queens that creates dramatic structural swings down the court flights:</p>
        <ul>
          <li><strong>Standard Flow:</strong> Courts sit top to bottom. Standard winners climb 1 court, standard losers slide down 1 court. Partners split after every round, and players out on a bye re-enter at the base court.</li>
          <li><strong>The Snake Exception:</strong> On Court 1 (The Top Flight) ONLY, the pair that loses the match doesn't just drop down one level—<strong>they slide down the "snake" all the way to the lowest court in the event</strong>.</li>
        </ul>
        <h3>When To Play</h3>
        <p>When you want high-drama match situations where losing at the absolute top brings massive consequences.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Injecting gamified, unpredictable ladder loops into competitive groupings.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'bridge-the-gap':
      title = "Bridge The Gap";
      htmlContent = `
        <span class="detail-tagline">"Mixing all skill levels"</span>
        <h3>Game Overview</h3>
        <p>A progressive, balancing configuration that recalculates global rankings round-by-round to pair opposite ends of the skill curve:</p>
        <ul>
          <li><strong>The Fusion Pairing:</strong> Each round, the highest-performing player (e.g., the top winner on Court 1) is automatically partnered with the lowest-performing player (the lower-scoring loser on the bottom court).</li>
          <li><strong>Court Cascading:</strong> This pairing strategy cascades inwards down through the remaining pool. The resulting high-low teams are placed sequentially onto courts from top to bottom.</li>
          <li><strong>Bye Rule:</strong> Players returning from a rest or bye round enter directly at the bottom baseline tier.</li>
        </ul>
        <h3>When To Play</h3>
        <p>When you want to seamlessly blend advanced and developing players into competitive matchups without risking lopsided blowouts.</p>
        <h3>Perfect For</h3>
        <ul>
          <li>Community mixers or club events designed to bridge social and competitive player gaps.</li>
        </ul>
        <h3>Set Up Options</h3>
        <div class="app-table-wrapper">
          <table class="app-overlay-table">
            <thead>
              <tr><th>Option</th><th>Available</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Scoring</strong></td><td>Points; Win / Loss</td></tr>
              <tr><td><strong>Default Scoring</strong></td><td>Points</td></tr>
              <tr><td><strong>DUPR Option</strong></td><td>Yes. Must score Points</td></tr>
              <tr><td><strong>Play Offs</strong></td><td>N/A</td></tr>
              <tr><td><strong>Redivisioning</strong></td><td>N/A</td></tr>
            </tbody>
          </table>
        </div>
      `;
      break;

    default:
      // Structural fallback layout loop for remaining variant additions
      title = formatKey.replace(/-/g, ' ').toUpperCase();
      htmlContent = `
        <span class="detail-tagline">"System Engine Module Configuration"</span>
        <h3>Status</h3>
        <p>Waiting for layout attributes for ${title}. Card registration tag logged successfully.</p>
      `;
  }

  // Inject structural updates cleanly into layout views
  document.getElementById('detail-title').innerText = title;
  document.getElementById('detail-body-content').innerHTML = htmlContent;
  
  // Animate view upward into phone display
  document.getElementById('format-detail-overlay').classList.add('open');
}

/**
 * CLOSES DYNAMIC FORMAT HOVER LAYERS
 */
function closeFormatDetail() {
  document.getElementById('format-detail-overlay').classList.remove('open');
}

// GLOBAL BROWSER CACHE
window.cachedUserUniverse = {
  events: [],
  activeEventId: null,
  dupr: [],
  players: [],
  draw: [],
  byes: []
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

  // 1. Unpack fields safely
  let events = [];
  let activeId = null;

  if (payload && payload.events) {
    events = payload.events;
    activeId = payload.activeEventId;
  } else if (Array.isArray(payload)) {
    events = payload;
    activeId = window.cachedUserUniverse ? window.cachedUserUniverse.activeEventId : null;
  }

  // 2. Clear out container if no items exist
  if (events.length === 0) {
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h3>No Authorized Events Found</h3>
      </div>
    `;
    return;
  }

  // 3. CHRONOLOGICAL SORT: Organize all events by date ascending first
  events.sort((a, b) => {
    const dateA = a.EventDate || a.eventDate || '';
    const dateB = b.EventDate || b.eventDate || '';
    
    // Fallback logic if dates are missing or blank string text matches
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    return new Date(dateA) - new Date(dateB);
  });

  // 4. Separate events into two distinct HTML structures
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

    // Get the day-based icon URL
    const iconAsset = getDayIconUrl(rawDate);
    const iconMarkup = `<img src="${iconAsset}" alt="Day Icon" class="card-icon-images">`;

    const cardClass = isActive ? 'app-card active-event' : 'app-card';
    const activeBadge = isActive ? `<span class="active-pill-badge">ACTIVE</span>` : '';

    const cardMarkup = `
      <div class="${cardClass}" id="event-card-${currentId}" onclick="setActiveEventTrack('${currentId}')">
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

  // 5. Build dynamic segmented display grids
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
    const targetDayName = dayNames[dateObj.getDay()]; // e.g. "Monday"

    const iconUrl = daysOfWeek[0][targetDayName];
    return iconUrl || fallbackEmoji;
  } catch (err) {
    console.error("Error evaluating day icon:", err);
    return fallbackEmoji;
  }
}

/**
 * ACTION ROUTINE: Instantly targets a tournament, filters its data locally, and syncs the sheet in background
 */
function setActiveEventTrack(eventId) {
  console.log("Loading event detail state for ID:", eventId);
  
  // 1. Locate data records out of our global cache framework
  if (!window.cachedUserUniverse || !window.cachedUserUniverse.events) {
    console.error("Global cache universe is missing!");
    return;
  }
  
  const targetEvent = window.cachedUserUniverse.events.find(e => String(e.EventID || e.eventId) === String(eventId));
  
  if (!targetEvent) {
    alert("Error: Tournament record could not be found.");
    return;
  }
  
  // 2. Clear out time strings safely for standard date pickers (YYYY-MM-DD)
  let inputDate = '';
  if (targetEvent.EventDate) {
    inputDate = targetEvent.EventDate.split('T')[0];
  }

  // 3. Target dynamic container grid
  const detailContainer = document.getElementById('event-detail-content');
  if (!detailContainer) return;

  // Handle spaces and case variations securely: targetEvent["DUPR Limit"]
  const duprVal = targetEvent["DUPR Limit"] !== undefined ? targetEvent["DUPR Limit"] : (targetEvent.duprLimit || 0);

  // 4. Inject clean AppSheet-styled edit template
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
      <label for="edit-event-courts">Number of Courts</label>
      <input type="number" id="edit-event-courts" class="detail-input" min="1" value="${targetEvent.NumberofCourts || 1}">
    </div>

    <div class="detail-form-group">
      <label for="edit-event-dupr">DUPR Limit</label>
      <input type="number" step="0.05" min="0" max="8" id="edit-event-dupr" class="detail-input" value="${duprVal}">
    </div>

    <div class="form-action-bar">
      <button class="btn-secondary" onclick="navigateToScreen('events')">Back</button>
      <button class="btn-primary" onclick="saveAndActivateEventAction()">Next</button>
    </div>
  `;

  // 5. Fire screen router navigation to pull up the detail screen card view panel
  navigateToScreen('event-detail');
}

function saveAndActivateEventAction() {
  // 1. Pull the specific event target ID out of our hidden input node
  const eventId = document.getElementById('edit-event-id').value;
  if (!eventId) {
    console.error("Missing event context ID context framework.");
    return;
  }

  // 2. Gather the form fields to prepare the structural update object
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
    // 3. Update local global cache universe instantly so the active event swaps over
    window.cachedUserUniverse.activeEventId = eventId;

    // 4. Update the actual data attributes inside the array row so modifications are visible
    const eventIndex = window.cachedUserUniverse.events.findIndex(e => String(e.EventID || e.eventId) === String(eventId));
    if (eventIndex !== -1) {
      window.cachedUserUniverse.events[eventIndex] = {
        ...window.cachedUserUniverse.events[eventIndex],
        ...updatedData
      };
    }

    // 5. Instantly rebuild the 'My Events' screen list layout panels
    renderUserEventCards(window.cachedUserUniverse);
  }

  // 6. Asynchronously save changes and the active assignment state down to your server rows
  const userEmail = "brett.collins028@gmail.com";

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight — Apps Script reads raw body either way
    body: JSON.stringify({ action: 'Event Update', userEmail, eventId, updatedData })
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log("Database records and active status updated successfully:", result.response);
      } else {
        console.error("Background Server Sync Failed:", result.error);
      }
    })
    .catch(err => {
      console.error("Background Server Sync Failed:", err);
    });

  // 7. Route the UI view context instantly over to your next workflow panel step
  navigateToScreen('players');
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwWWH_GMZBOSu_Mw_7JPd5pibdxBWbf9Tgvp0-j_J4cIS5h7fgxQeHQCMJVgUzvBUG/exec"; // <-- your deployment URL

function preFetchUserUniverseData() {
  const userEmail = "brett.collins028@gmail.com"; // <-- Ensure this email matches your data row!
  const url = `${APPS_SCRIPT_URL}?email=${encodeURIComponent(userEmail)}`;

  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Apps Script returned status ${response.status}`);
      }
      return response.json();
    })
    .then(payload => {
      console.log("Initial database pre-fetch successful!", payload);
      window.cachedUserUniverse = payload;
      renderUserEventCards(payload);
      return payload;
    })
    .catch(err => {
      console.error("Critical initialization failure: " + (err.message || err));
      throw err;
    });
}

// Global initialization event listener running on app startup
window.addEventListener("DOMContentLoaded", async (event) => {
  console.log("App loaded. Pre-fetching database universes...");

  try {
    await preFetchUserUniverseData();
  } catch (error) {
    console.error("Failed to load universe data:", error);
  } finally {
    const loader = document.getElementById("app-splash-preloader");
    if (loader) {
      loader.style.display = "none";
    }
  }
});
