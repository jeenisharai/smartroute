export interface Gateway {
  id: string;
  name: string;
  successRate: number; // R_g (0-1)
  availability: number; // A_g (0-1)
  latencyMs: number; // L_g
  costPerTx: number; // C_g
  failureCount: number; // for breaker
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastFailureTime?: number;
}

export const TransactionStatus = {
  HARD_DECLINE: 'HARD_DECLINE',
  SOFT_FAILURE: 'SOFT_FAILURE',
  TIMEOUT: 'TIMEOUT',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export interface Transaction {
  idempotencyKey: string;
  gatewayId?: string;
  status: TransactionStatus;
  timestamp: number;
}

export const Strategy = {
  FIXED: 'FIXED',
  ROUND_ROBIN: 'ROUND_ROBIN',
  SMART_ROUTE: 'SMART_ROUTE',
} as const;
export type Strategy = typeof Strategy[keyof typeof Strategy];
