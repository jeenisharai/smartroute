import { Strategy } from './types';
import type { Gateway } from './types';
import { calculateScore } from './scoring';
import type { ScoringWeights } from './scoring';
import { CircuitBreaker } from './breaker';

export class Router {
  private roundRobinIndex = 0;
  
  private gateways: Gateway[];
  private breaker: CircuitBreaker;
  private weights: ScoringWeights;

  constructor(
    gateways: Gateway[],
    breaker: CircuitBreaker,
    weights: ScoringWeights = { w_r: 1, w_a: 1, w_l: 1, w_c: 1 }
  ) {
    this.gateways = gateways;
    this.breaker = breaker;
    this.weights = weights;
  }

  route(strategy: Strategy, time: number = Date.now()): Gateway | null {
    const availableGateways = this.gateways.filter((g) =>
      this.breaker.canExecute(g, time)
    );

    if (availableGateways.length === 0) {
      return null;
    }

    switch (strategy) {
      case Strategy.FIXED:
        return availableGateways[0];
      case Strategy.ROUND_ROBIN:
        const gateway =
          availableGateways[this.roundRobinIndex % availableGateways.length];
        this.roundRobinIndex++;
        return gateway;
      case Strategy.SMART_ROUTE:
        return availableGateways.reduce((best, current) => {
          const bestScore = calculateScore(best, this.weights);
          const currentScore = calculateScore(current, this.weights);
          return currentScore > bestScore ? current : best;
        });
      default:
        return null;
    }
  }
}
