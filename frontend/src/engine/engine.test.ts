import { describe, it, expect, beforeEach } from 'vitest';
import {
  Strategy,
  TransactionStatus,
} from './types';
import type { Gateway } from './types';
import { Random } from './random';
import { CircuitBreaker } from './breaker';
import { IdempotencyManager } from './idempotency';
import { calculateScore } from './scoring';
import { Router } from './router';

describe('TypeScript Engine', () => {
  describe('Random (PRNG)', () => {
    it('should be deterministic based on seed', () => {
      const prng1 = new Random(123);
      const prng2 = new Random(123);
      const prng3 = new Random(456);

      const val1 = prng1.next();
      expect(val1).toBe(prng2.next());
      expect(val1).not.toBe(prng3.next());
    });
  });

  describe('Circuit Breaker', () => {
    let breaker: CircuitBreaker;
    let gateway: Gateway;

    beforeEach(() => {
      breaker = new CircuitBreaker(3, 5000);
      gateway = {
        id: 'g1',
        name: 'Gateway 1',
        successRate: 0.9,
        availability: 0.99,
        latencyMs: 100,
        costPerTx: 10,
        failureCount: 0,
        state: 'CLOSED',
      };
    });

    it('should trip after K failures', () => {
      expect(breaker.canExecute(gateway)).toBe(true);
      breaker.recordFailure(gateway);
      breaker.recordFailure(gateway);
      expect(gateway.state).toBe('CLOSED');
      expect(breaker.canExecute(gateway)).toBe(true);
      
      breaker.recordFailure(gateway);
      expect(gateway.state).toBe('OPEN');
      expect(breaker.canExecute(gateway)).toBe(false);
    });

    it('should transition to half-open after cooldown', () => {
      breaker.recordFailure(gateway);
      breaker.recordFailure(gateway);
      breaker.recordFailure(gateway, 0); // Fails at t=0
      
      expect(breaker.canExecute(gateway, 4000)).toBe(false);
      
      expect(breaker.canExecute(gateway, 5001)).toBe(true);
      expect(gateway.state).toBe('HALF_OPEN');
    });
  });

  describe('Idempotency Manager', () => {
    let manager: IdempotencyManager;

    beforeEach(() => {
      manager = new IdempotencyManager();
    });

    it('should register and retrieve transaction status', () => {
      manager.register('tx1', {
        idempotencyKey: 'tx1',
        status: TransactionStatus.PENDING,
        timestamp: Date.now(),
      });

      expect(manager.queryStatus('tx1')).toBe(TransactionStatus.PENDING);
      
      manager.updateStatus('tx1', TransactionStatus.TIMEOUT);
      expect(manager.queryStatus('tx1')).toBe(TransactionStatus.TIMEOUT);
    });
  });

  describe('Scoring & Router', () => {
    let gateway1: Gateway;
    let gateway2: Gateway;
    let router: Router;
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker(3, 5000);
      gateway1 = {
        id: 'g1',
        name: 'G1',
        successRate: 0.8,
        availability: 0.9,
        latencyMs: 1000,
        costPerTx: 50,
        failureCount: 0,
        state: 'CLOSED',
      };
      gateway2 = {
        id: 'g2',
        name: 'G2',
        successRate: 0.99,
        availability: 0.99,
        latencyMs: 200,
        costPerTx: 10,
        failureCount: 0,
        state: 'CLOSED',
      };
      router = new Router([gateway1, gateway2], breaker);
    });

    it('calculateScore should return higher score for better gateway', () => {
      const w = { w_r: 1, w_a: 1, w_l: 1, w_c: 1 };
      const score1 = calculateScore(gateway1, w);
      const score2 = calculateScore(gateway2, w);
      expect(score2).toBeGreaterThan(score1);
    });

    it('Fixed strategy should pick first available', () => {
      expect(router.route(Strategy.FIXED)?.id).toBe('g1');
    });

    it('RoundRobin should alternate', () => {
      expect(router.route(Strategy.ROUND_ROBIN)?.id).toBe('g1');
      expect(router.route(Strategy.ROUND_ROBIN)?.id).toBe('g2');
      expect(router.route(Strategy.ROUND_ROBIN)?.id).toBe('g1');
    });

    it('SmartRoute should pick highest score', () => {
      expect(router.route(Strategy.SMART_ROUTE)?.id).toBe('g2');
    });

    it('Router should skip OPEN gateways', () => {
      breaker.recordFailure(gateway2);
      breaker.recordFailure(gateway2);
      breaker.recordFailure(gateway2); // Tripped

      // SmartRoute would normally pick g2, but it's open, so picks g1
      expect(router.route(Strategy.SMART_ROUTE)?.id).toBe('g1');
    });
  });
});
