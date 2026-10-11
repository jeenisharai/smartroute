import type { Transaction, TransactionStatus } from './types';

export class IdempotencyManager {
  private store: Map<string, Transaction> = new Map();

  register(key: string, transaction: Transaction) {
    this.store.set(key, transaction);
  }

  get(key: string): Transaction | undefined {
    return this.store.get(key);
  }

  updateStatus(key: string, status: TransactionStatus) {
    const tx = this.store.get(key);
    if (tx) {
      tx.status = status;
    }
  }

  queryStatus(key: string): TransactionStatus | undefined {
    return this.store.get(key)?.status;
  }
}
