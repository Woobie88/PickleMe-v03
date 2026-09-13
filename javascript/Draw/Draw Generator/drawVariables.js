// --- Draw Generation Weighting: slider presets ---
const penaltyWeightPresets = [
  { drawWeightValue: 0, label: 'Maximise partner & opponent rotation', partnerDuprGapWeight: 10, partnerFrequencyWeight: 100, partnerDuprDelta: 0.5,  
    opponentDuprGapWeight: 10,  opponentFrequencyWeight: 100, opponentDuprDelta: 0.5  },
  { drawWeightValue: 1, label: 'Balanced draw', partnerDuprGapWeight: 50,  partnerFrequencyWeight: 50, partnerDuprDelta: 0.4,
    opponentDuprGapWeight: 50,  opponentFrequencyWeight: 50, opponentDuprDelta: 0.3  },
  { drawWeightValue: 2, label: 'Minimise DUPR differences for the match',  partnerDuprGapWeight: 100,  partnerFrequencyWeight: 20, partnerDuprDelta: 0.25,
    opponentDuprGapWeight: 100,  opponentFrequencyWeight: 10, opponentDuprDelta: 0.2  }
];

let duprGapWeight;
let frequencyWeight;