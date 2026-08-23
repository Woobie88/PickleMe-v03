/**
 * ============================================================
 * PLAYOFFS: 1-ROUND (Final only)
 * Groups players by STANDINGS RANK into courts (Court 1 = top
 * ranks, Court 2 = next ranks, etc.), then finds the DUPR-
 * balanced 2v2 split within each court group.
 * ============================================================
 */

function getStandingsRankedPlayers(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes');

  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const standings = players.map(player => {
    const stats = calculatePlayerStats(player.PlayerID, matches);
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player, points };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0);
  });

  return standings.map(s => s.player);
}

function bestBalancedPairing(fourPlayers) {
  const [a, b, c, d] = fourPlayers;
  const options = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ];
  let best = options[0], bestGap = Infinity;
  options.forEach(opt => {
    const gap = Math.abs(teamAvgDupr(opt.teamA) - teamAvgDupr(opt.teamB));
    if (gap < bestGap) { bestGap = gap; best = opt; }
  });
  return best;
}

function generatePlayoffFinalRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.ceil(rankedPlayers.length / 4);

  const matches = [];
  for (let c = 0; c < courtsCount; c++) {
    const courtPlayers = rankedPlayers.slice(c * 4, c * 4 + 4);
    if (courtPlayers.length < 4) break; // incomplete group — not enough players for a full court

    const courtNumber = c + 1;
    const pairing = bestBalancedPairing(courtPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, roundNumber, eventId, drawVersion, userEmail
    ));
  }

  console.log(`The playoff matches are ${matches}`);
  return matches;
}