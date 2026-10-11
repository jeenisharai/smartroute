import type { Gateway } from './types';

export class CircuitBreaker {
  failureThreshold: number;
  cooldownWindowMs: number;

  constructor(
    failureThreshold: number,
    cooldownWindowMs: number
  ) {
    this.failureThreshold = failureThreshold;
    this.cooldownWindowMs = cooldownWindowMs;
  }

  recordFailure(gateway: Gateway, time: number = Date.now()) {
    gateway.failureCount++;
    gateway.lastFailureTime = time;
    if (gateway.failureCount >= this.failureThreshold) {
      gateway.state = 'OPEN';
    }
  }

  recordSuccess(gateway: Gateway) {
    gateway.failureCount = 0;
    gateway.state = 'CLOSED';
  }

  canExecute(gateway: Gateway, time: number = Date.now()): boolean {
    if (gateway.state === 'CLOSED') {
      return true;
    }
    if (gateway.state === 'OPEN') {
      if (
        gateway.lastFailureTime !== undefined &&
        time - gateway.lastFailureTime > this.cooldownWindowMs
      ) {
        gateway.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    if (gateway.state === 'HALF_OPEN') {
      // Allows exactly one attempt
      return true;
    }
    return false;
  }
}
