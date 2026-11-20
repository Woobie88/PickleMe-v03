function generateTeamsRoundDraw(players, allMatches, numberOfRounds, courtsCount, activeEventId, newDrawVersion, userEmail, numberOfTeams, scorers) {
    // --- Determine the structure of the match ups based on the number of teams & number of courts --- //
    

    // --- Build the players into each team, sorting rank by DUPR rating --- //
    const allTeams = {};
    players.forEach(p => { (allTeams[p.Team] = allTeams[p.Team] || []).push(p); });
    const allTeamKeys = Object.keys(allTeams).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`All teams is ${allTeamKeys}`);
    return;

    // --- NOTE MAY DO AT END --- //

    // const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
    // const teamOpponentCounts = buildTeamOpponentHistory(matches);

    // --- ****************** --- //

    // --- Build bye order based on first selecting team with manual bye, then applying byes accross all teams based on DUPR ranking --- //
    
    

    // --- Build matrix of team pairings, with Avg. DUPR & Delta DUPR --- //
   

    // --- Build all potential court pairings for the full event, including DUPR delta --- //

    // --- Define stored data variables --- //

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    // --- Pick best scoring matches, excluding players having a bye --- //

    // --- Revise scoring of round match ups --- //

    // --- Move all instances of pairings to partnership played --- //

    // --- Resort potential round match ups --- //

    
    return allMatches;
}
