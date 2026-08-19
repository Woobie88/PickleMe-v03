/**
 * ============================================================
 * REDIVISIONING PARTNER SCHEDULER
 * For games where gamesProfile.Redivisioning === "Yes", builds
 * a guaranteed unique-partnership schedule using a phantom-slot
 * rotation (100% reliable for any pool size, odd or even —
 * verified, not probabilistic). Falls back to reusing prior
 * pairings only once every unique pairing has been used.
 * ============================================================
 */

/**
 * Generalized schedule for ANY pool size (odd or even), where byes fall
 * out naturally from the same rotation used for partnerships — no
 * separate bye-scheduling step needed.
 *
 * If n is odd, adds a phantom player (index n) to make the total even.
 * Whoever rotation-pairs with the phantom each round gets the bye.
 *
 * Returns an array of rounds, each shaped { bye: index|null, partnerPairs: [[i,j], ...] }
 * — indices are POSITIONS within whatever ordered player list this was
 * built for (e.g. stableOrder from buildStablePoolOrder), not PlayerIDs
 * directly. Callers must map these indices back to real players.
 */
function generatePoolScheduleWithByes(n) {
  const hasPhantom = n % 2 !== 0;
  const totalSlots = hasPhantom ? n + 1 : n;
  const phantomIndex = hasPhantom ? n : null;

  const slots = Array.from({ length: totalSlots }, (_, i) => i);
  const numRounds = totalSlots - 1;
  const schedule = [];

  let arrangement = [...slots];

  for (let round = 0; round < numRounds; round++) {
    const partnerPairs = [];
    let byePlayer = null;

    for (let i = 0; i < totalSlots / 2; i++) {
      const a = arrangement[i], b = arrangement[totalSlots - 1 - i];
      if (a === phantomIndex) { byePlayer = b; continue; }
      if (b === phantomIndex) { byePlayer = a; continue; }
      partnerPairs.push([a, b]);
    }

    schedule.push({ bye: byePlayer, partnerPairs });

    const fixed = arrangement[0];
    const rest = arrangement.slice(1);
    rest.unshift(rest.pop());
    arrangement = [fixed, ...rest];
  }

  return schedule;
}

/**
 * Generates a full round-by-round pairing schedule for a pool, honoring
 * the requested number of rounds. If numberOfRounds exceeds the pool's
 * natural cycle length, wraps back to the start and reuses the same
 * proven cycle (still no repeats within any single pass through it).
 */
function generateRedivisionSchedule(poolPlayers, numberOfRounds) {
  const stableOrder = buildStablePoolOrder(poolPlayers);
  const n = stableOrder.length;
  const baseCycle = generatePoolScheduleWithByes(n);

  const fullSchedule = [];
  for (let round = 0; round < numberOfRounds; round++) {
    const cycleIndex = round % baseCycle.length;
    const roundPlan = baseCycle[cycleIndex];

    const byePlayer = roundPlan.bye !== null ? stableOrder[roundPlan.bye] : null;
    const partnerPairs = roundPlan.partnerPairs.map(([i, j]) => [stableOrder[i], stableOrder[j]]);

    fullSchedule.push({ round: round + 1, bye: byePlayer, pairs: partnerPairs });
  }

  return fullSchedule;
}

/**
 * Logs a player-by-player summary matching the format used elsewhere
 * in the draw generator.
 */
function logRedivisionSummary(poolPlayers, schedule) {
  const partnerCounts = {}, byeCounts = {};
  poolPlayers.forEach(p => { partnerCounts[p.PlayerID] = {}; byeCounts[p.PlayerID] = 0; });

  schedule.forEach(r => {
    if (r.bye) byeCounts[r.bye.PlayerID]++;
    r.pairs.forEach(([a, b]) => {
      partnerCounts[a.PlayerID][b.PlayerID] = (partnerCounts[a.PlayerID][b.PlayerID] || 0) + 1;
      partnerCounts[b.PlayerID][a.PlayerID] = (partnerCounts[b.PlayerID][a.PlayerID] || 0) + 1;
    });
  });

  console.log("=== REDIVISION PARTNER SUMMARY ===");
  poolPlayers.forEach(p => {
    const counts = partnerCounts[p.PlayerID];
    const uniquePartners = Object.keys(counts).length;
    const maxSamePartner = Object.values(counts).reduce((max, c) => Math.max(max, c), 0);

    console.log(
      `${p.PlayerID} || Games ${schedule.filter(r => r.bye?.PlayerID !== p.PlayerID).length} || Byes ${byeCounts[p.PlayerID]} || Unique Partners ${uniquePartners} || Max Same Partner ${maxSamePartner}`
    );
  });
}

/**
 * Entry point: only used when gamesProfile.Redivisioning === "Yes".
 * Returns { round, bye, pairs } for each round -- pairs still need to
 * be grouped into 2v2 court matchups via the existing greedy opponent
 * engine (generateBestMatchups) before becoming real match records.
 */
function buildRedivisionPartnerships(poolPlayers, numberOfRounds) {
  const schedule = generateRedivisionSchedule(poolPlayers, numberOfRounds);
  logRedivisionSummary(poolPlayers, schedule);
  return schedule;
}