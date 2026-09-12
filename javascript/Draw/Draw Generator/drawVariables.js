// --- Draw Generation Weighting: slider presets ---
const penaltyWeightPresets = [
  { drawWeightValue: 0, label: 'Maximise partner & opponent rotation', partnerDuprGapWeight: 10, partnerFrequencyWeight: 100,  
    opponentDuprGapWeight: 10,  opponentFrequencyWeight: 100},
  { drawWeightValue: 1, label: 'Balanced draw', partnerDuprGapWeight: 50,  partnerFrequencyWeight: 50,  
    opponentDuprGapWeight: 50,  opponentFrequencyWeight: 50  },
  { drawWeightValue: 2, label: 'Minimise DUPR differences for the match',  partnerDuprGapWeight: 100,  partnerFrequencyWeight: 80, partnerDuprDelta: 0.5,
    opponentDuprGapWeight: 100,  opponentFrequencyWeight: 20, opponentDuprDelta: 0.5  }
];

let duprGapWeight;
let frequencyWeight;