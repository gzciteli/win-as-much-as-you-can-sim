# Win As Much As You Can Simulator

Static GitHub Pages simulator for Harvard Law School's "Win as Much as You Can" negotiation exercise.

## What it does

- Simulates the 10-round, 4-seat game with the published payoff schedule.
- Supports one strategy per seat: `always_x`, `always_y`, and `random`.
- Treats `Seat A` as the primary seat and visually separates it in the results table.
- Shows each round as `choice payoff (cumulative)`.
- If any chosen strategy is stochastic, supports repeated trials and reports final-score summary stats by seat:
  - mean
  - median
  - min
  - max

## Strategy model

Each strategy is defined as a function that receives the current game state and returns either `"X"` or `"Y"`. The game state includes:

- current round number
- acting seat
- all seat ids
- prior round history, including choices and payoffs by seat
- cumulative scores so far

This keeps the first release simple while making it easy to add adaptive strategies later.

## GitHub Pages

Once Pages is enabled, the live site will be available at:

`https://gzciteli.github.io/win-as-much-as-you-can-sim/`
