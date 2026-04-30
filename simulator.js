export const SEATS = ["A", "B", "C", "D"];

export const ROUND_MULTIPLIERS = [1, 1, 1, 1, 3, 1, 1, 5, 1, 10];

const PAYOFF_BY_X_COUNT = {
  0: { X: 0, Y: 1 },
  1: { X: 3, Y: -1 },
  2: { X: 2, Y: -2 },
  3: { X: 1, Y: -3 },
  4: { X: -1, Y: 0 }
};

export const STRATEGIES = {
  always_x: {
    id: "always_x",
    label: "always_x",
    isStochastic: false,
    decide: () => "X"
  },
  always_y: {
    id: "always_y",
    label: "always_y",
    isStochastic: false,
    decide: () => "Y"
  },
  random: {
    id: "random",
    label: "random",
    isStochastic: true,
    decide: (_gameState, random = Math.random) => (random() < 0.5 ? "X" : "Y")
  }
};

export function getStrategyList() {
  return Object.values(STRATEGIES).map(({ id, label, isStochastic }) => ({
    id,
    label,
    isStochastic
  }));
}

export function resolveRoundPayoffs(choicesBySeat, multiplier = 1) {
  const choiceEntries = Object.entries(choicesBySeat);
  const xCount = choiceEntries.filter(([, choice]) => choice === "X").length;
  const payoffs = {};

  for (const [seat, choice] of choiceEntries) {
    const base = PAYOFF_BY_X_COUNT[xCount][choice];
    payoffs[seat] = base * multiplier;
  }

  return payoffs;
}

export function simulateGame(strategyIdsBySeat, options = {}) {
  const random = options.random ?? Math.random;
  const history = [];
  const cumulativeScores = Object.fromEntries(SEATS.map((seat) => [seat, 0]));

  ROUND_MULTIPLIERS.forEach((multiplier, index) => {
    const roundNumber = index + 1;
    const choicesBySeat = {};

    for (const seat of SEATS) {
      const strategyId = strategyIdsBySeat[seat];
      const strategy = STRATEGIES[strategyId];

      if (!strategy) {
        throw new Error(`Unknown strategy for seat ${seat}: ${strategyId}`);
      }

      const gameState = {
        roundNumber,
        actingSeat: seat,
        seats: [...SEATS],
        roundHistory: history.map((round) => ({
          roundNumber: round.roundNumber,
          multiplier: round.multiplier,
          choicesBySeat: { ...round.choicesBySeat },
          payoffsBySeat: { ...round.payoffsBySeat },
          cumulativeScoresBySeat: { ...round.cumulativeScoresBySeat }
        })),
        cumulativeScoresBySeat: { ...cumulativeScores }
      };

      choicesBySeat[seat] = strategy.decide(gameState, random);
    }

    const payoffsBySeat = resolveRoundPayoffs(choicesBySeat, multiplier);

    for (const seat of SEATS) {
      cumulativeScores[seat] += payoffsBySeat[seat];
    }

    history.push({
      roundNumber,
      multiplier,
      choicesBySeat,
      payoffsBySeat,
      cumulativeScoresBySeat: { ...cumulativeScores }
    });
  });

  return {
    rounds: history,
    finalScores: { ...cumulativeScores }
  };
}

export function simulateTrials(strategyIdsBySeat, trialCount, options = {}) {
  const count = Math.max(1, Math.floor(trialCount));
  const runs = [];

  for (let trialIndex = 0; trialIndex < count; trialIndex += 1) {
    runs.push(simulateGame(strategyIdsBySeat, options));
  }

  return {
    representativeRun: runs[0],
    summaryBySeat: summarizeRuns(runs),
    runs
  };
}

export function summarizeRuns(runs) {
  return Object.fromEntries(
    SEATS.map((seat) => {
      const scores = runs
        .map((run) => run.finalScores[seat])
        .sort((left, right) => left - right);
      const sum = scores.reduce((total, score) => total + score, 0);

      return [
        seat,
        {
          mean: sum / scores.length,
          median: median(scores),
          min: scores[0],
          max: scores[scores.length - 1]
        }
      ];
    })
  );
}

export function anyStrategyIsStochastic(strategyIdsBySeat) {
  return Object.values(strategyIdsBySeat).some(
    (strategyId) => STRATEGIES[strategyId]?.isStochastic
  );
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
  }

  return sortedValues[middle];
}
