import type { Gateway } from './types';

export interface ScoringWeights {
  w_r: number; // weight for success rate
  w_a: number; // weight for availability
  w_l: number; // weight for latency
  w_c: number; // weight for cost
}

export function calculateScore(gateway: Gateway, weights: ScoringWeights): number {
  // Normalize latency and cost (lower is better, so we invert or penalize)
  // Assuming a max latency of 5000ms and max cost of 100 for normalization
  const normL = Math.max(0, 1 - gateway.latencyMs / 5000);
  const normC = Math.max(0, 1 - gateway.costPerTx / 100);

  return (
    weights.w_r * gateway.successRate +
    weights.w_a * gateway.availability +
    weights.w_l * normL +
    weights.w_c * normC
  );
}
