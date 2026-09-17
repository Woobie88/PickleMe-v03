// ---------- FLEX ROUND GENERATION (Cross Court Divisions) ----------
//
// Three groups set on the Cross Court Divisions screen, persisted to player.Team:
//   1 = Core Group 1  (max 4)   2 = Flex Group (unlimited)   3 = Core Group 2 (max 4)
//
// Group membership decides who can play with/against whom: Core Group 1 only
// ever partners or opposes Core Group 1 or Flex players, Core Group 2 only
// Core Group 2 or Flex, and the two cores never meet. Which physical court a
// match happens on is unrelated to that and is decided the same way every
// other game type here decides it — via assignCourts, balancing each
// player's court history — so court assignment flexes freely with courtCount.
//
// Capping each core at 4 (one court's worth) is what makes the byes safe to
// draw at random: whichever k courts end up "Core 1 + Flex" for the round,
// Core 1 always fits inside them no matter who sits out, and likewise for
// Core 2 on the other k' courts — so a valid split always exists.

const FLEX_CORE_GROUP_1 = 1;
const FLEX_GROUP = 2;
const FLEX_CORE_GROUP_2 = 3;
const FLEX_CORE_MAX = 4;

// How many of courtsCount courts run as "Core 1 + Flex" this round (the rest
// run "Core 2 + Flex"). Returns every k that fits exactly, given Flex players
// bridge whichever side is short.
function feasibleFlexSplits(core1Count, flexCount, core2Count, courtsCount) {
  const feasible = [];
  for (let k = 0; k <= courtsCount; k++) {
    const topDemand = k * 4;
    const bottomDemand = (courtsCount - k) * 4;
    const bridgeToTop = topDemand - core1Count;
    const bridgeToBottom = bottomDemand - core2Count;
    if (bridgeToTop >= 0 && bridgeToBottom >= 0 && bridgeToTop + bridgeToBottom === flexCount) {
      feasible.push({ k, bridgeToTop, bridgeToBottom });
    }
  }
  return feasible;
}

// One attempt: pick a feasible split, bridge Flex players, and pair off each
// pool. Mirrors attemptPartnerships/attemptMatchups — a single candidate,
// scored, for generateBestFlexRound to compare across many of.
function attemptFlexRound(coreGroup1, flexGroup, coreGroup2, courtsCount, partnerCounts, opponentCounts, scorers) {
//   const splits = feasibleFlexSplits(coreGroup1.length, flexGroup.length, coreGroup2.length, courtsCount);
//   if (splits.length === 0) return null;

//   const { bridgeToTop, bridgeToBottom } = splits[Math.floor(Math.random() * splits.length)];
//   const shuffledFlex = shuffle(flexGroup);

//   const topPool = coreGroup1.concat(shuffledFlex.slice(0, bridgeToTop));
//   const bottomPool = coreGroup2.concat(shuffledFlex.slice(bridgeToTop, bridgeToTop + bridgeToBottom));

  for (var partnerGroup = 0; partnerGroup < 5; partnerGroup++) {
    switch (partnerGroup) {
        case 0:
           const partnerships = attemptPartnerships(coreGroup1, partnerCounts, scorers); 
           console.log('Core Group 1',partnerships );
           break;
        case 1:
           const partnerships = attemptPartnerships(coreGroup2, partnerCounts, scorers); 
           console.log('Core Group 2',partnerships );
           break;
        case 2:
           const partnerships = attemptPartnerships(flexGroup, partnerCounts, scorers); 
           console.log('Flex Group',partnerships );
           break;
        case 3:
           const partnerships = attemptPartnerships(coreGroup1.concat(flexGroup), partnerCounts, scorers); 
           console.log('Core Group 1 + Flex Group',partnerships );
           break;
        case 4:
           const partnerships = attemptPartnerships(coreGroup2.concat(flexGroup), partnerCounts, scorers); 
           console.log('Core Group 2 + Flex Group',partnerships );
           break;
    }
  }
//   const topPartnerships = attemptPartnerships(topPool, partnerCounts, scorers);
//   const bottomPartnerships = attemptPartnerships(bottomPool, partnerCounts, scorers);

//   const topMatchups = attemptMatchups(topPartnerships.pairs, opponentCounts, scorers);
//   const bottomMatchups = attemptMatchups(bottomPartnerships.pairs, opponentCounts, scorers);

  return {
    matchups: topMatchups.matchups.concat(bottomMatchups.matchups),
    cost: topPartnerships.cost + bottomPartnerships.cost + topMatchups.cost + bottomMatchups.cost
  };
}

// Tries many splits and pairings and keeps the lowest-cost combination —
// this is what stops the smaller core group getting stuck repartnering
// itself: a split that bridges a Flex player in to break up a repeat will
// score lower and win, rather than the split being decided before scoring
// ever happens.
function generateBestFlexRound(coreGroup1, flexGroup, coreGroup2, courtsCount, partnerCounts, opponentCounts, scorers, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptFlexRound(coreGroup1, flexGroup, coreGroup2, courtsCount, partnerCounts, opponentCounts, scorers);
    if (result && result.cost < bestCost) { bestCost = result.cost; best = result.matchups; }
  }
  return best;
}

function generateFlexRoundDraw(players, matches, byePlayerIds, roundNumber, courtsCount, eventId, drawVersion, userEmail, scorers) {
  const eligible = players.filter(p => !byePlayerIds.includes(p.PlayerID));
  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);

  const coreGroup1 = eligible.filter(p => parseInt(p.Team) === FLEX_CORE_GROUP_1);
  const flexGroup = eligible.filter(p => parseInt(p.Team) === FLEX_GROUP);
  const coreGroup2 = eligible.filter(p => parseInt(p.Team) === FLEX_CORE_GROUP_2);

  if (coreGroup1.length > FLEX_CORE_MAX || coreGroup2.length > FLEX_CORE_MAX) {
    console.error(`Cannot generate Cross Court draw: core groups are capped at ${FLEX_CORE_MAX} (Core Group 1 has ${coreGroup1.length}, Core Group 2 has ${coreGroup2.length}).`);
    return [];
  }

  if (eligible.length !== courtsCount * 4) {
    console.error(`Cannot generate Cross Court draw for round ${roundNumber}: ${eligible.length} eligible players cannot fill ${courtsCount} courts.`);
    return [];
  }

  const bestMatchups = generateBestFlexRound(coreGroup1, flexGroup, coreGroup2, courtsCount, partnerCounts, opponentCounts, scorers);
  if (!bestMatchups) {
    console.error(`Cannot generate Cross Court draw for round ${roundNumber}: no court split fits this group composition.`);
    return [];
  }

  const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);
  const courted = assignCourts(bestMatchups, courtNumbers, courtCounts);

  return courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
}