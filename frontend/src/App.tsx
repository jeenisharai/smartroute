import { useState, useEffect } from 'react';
import './App.css';
import {
  Strategy,
  TransactionStatus,
  CircuitBreaker,
  IdempotencyManager,
  Router,
  calculateScore
} from './engine';
import type { Gateway, Transaction } from './engine';

const initialGateways: Gateway[] = [
  {
    id: 'g1',
    name: 'Stripe',
    successRate: 0.99,
    availability: 0.999,
    latencyMs: 200,
    costPerTx: 2.9,
    failureCount: 0,
    state: 'CLOSED',
  },
  {
    id: 'g2',
    name: 'PayPal',
    successRate: 0.95,
    availability: 0.99,
    latencyMs: 400,
    costPerTx: 1.5,
    failureCount: 0,
    state: 'CLOSED',
  },
  {
    id: 'g3',
    name: 'Square',
    successRate: 0.9,
    availability: 0.95,
    latencyMs: 300,
    costPerTx: 2.0,
    failureCount: 0,
    state: 'CLOSED',
  },
];

const breaker = new CircuitBreaker(3, 5000); // 3 failures, 5s cooldown
const idempotency = new IdempotencyManager();

export default function App() {
  const [gateways, setGateways] = useState<Gateway[]>(initialGateways);
  const [strategy, setStrategy] = useState<Strategy>(Strategy.SMART_ROUTE);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Weights for Smart Routing
  const [weights, setWeights] = useState({ w_r: 1, w_a: 1, w_l: 1, w_c: 1 });
  const [router, setRouter] = useState(new Router(initialGateways, breaker, weights));

  useEffect(() => {
    setRouter(new Router(gateways, breaker, weights));
  }, [gateways, weights]);

  // Update breaker state periodically to reflect HALF_OPEN transitions
  useEffect(() => {
    const interval = setInterval(() => {
      setGateways(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTransaction = () => {
    const time = Date.now();
    const targetGateway = router.route(strategy, time);
    const txId = `tx_${time}_${Math.floor(Math.random() * 1000)}`;

    if (!targetGateway) {
      const failedTx: Transaction = {
        idempotencyKey: txId,
        status: TransactionStatus.HARD_DECLINE,
        timestamp: time
      };
      setTransactions(prev => [failedTx, ...prev]);
      return;
    }

    const tx: Transaction = {
      idempotencyKey: txId,
      gatewayId: targetGateway.id,
      status: TransactionStatus.PENDING,
      timestamp: time
    };

    idempotency.register(txId, tx);
    setTransactions(prev => [tx, ...prev]);

    // Simulate network delay and result
    setTimeout(() => {
      // Simulate success/failure based on gateway stats
      const isSuccess = Math.random() < targetGateway.successRate;
      
      const newGateways = [...gateways];
      const gIndex = newGateways.findIndex(g => g.id === targetGateway.id);
      
      if (isSuccess) {
        breaker.recordSuccess(newGateways[gIndex]);
        idempotency.updateStatus(txId, TransactionStatus.SUCCESS);
      } else {
        breaker.recordFailure(newGateways[gIndex], Date.now());
        idempotency.updateStatus(txId, TransactionStatus.SOFT_FAILURE);
      }

      setGateways(newGateways);
      setTransactions(prev => [...prev]); // trigger re-render to update status
    }, targetGateway.latencyMs);
  };

  const simulateFailure = (gatewayId: string) => {
    const newGateways = [...gateways];
    const gIndex = newGateways.findIndex(g => g.id === gatewayId);
    if (gIndex !== -1) {
       breaker.recordFailure(newGateways[gIndex], Date.now());
       setGateways(newGateways);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>SmartRoute Application</h1>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '8px', flex: 1 }}>
          <h3>Routing Configuration</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>Strategy: </label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
              <option value={Strategy.SMART_ROUTE}>Smart Route</option>
              <option value={Strategy.ROUND_ROBIN}>Round Robin</option>
              <option value={Strategy.FIXED}>Fixed</option>
            </select>
          </div>
          
          {strategy === Strategy.SMART_ROUTE && (
            <div>
              <h4>Scoring Weights</h4>
              <label>Success (w_r): <input type="number" step="0.1" value={weights.w_r} onChange={(e) => setWeights({...weights, w_r: parseFloat(e.target.value)})} /></label><br/>
              <label>Availability (w_a): <input type="number" step="0.1" value={weights.w_a} onChange={(e) => setWeights({...weights, w_a: parseFloat(e.target.value)})} /></label><br/>
              <label>Latency (w_l): <input type="number" step="0.1" value={weights.w_l} onChange={(e) => setWeights({...weights, w_l: parseFloat(e.target.value)})} /></label><br/>
              <label>Cost (w_c): <input type="number" step="0.1" value={weights.w_c} onChange={(e) => setWeights({...weights, w_c: parseFloat(e.target.value)})} /></label>
            </div>
          )}

          <button 
            onClick={handleSendTransaction} 
            style={{ marginTop: '15px', padding: '10px 20px', fontSize: '16px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Send Transaction
          </button>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '8px', flex: 2 }}>
          <h3>Gateways</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th>Name</th>
                <th>State</th>
                <th>Failures</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gateways.map(g => (
                <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{g.name}</td>
                  <td style={{ color: g.state === 'OPEN' ? 'red' : g.state === 'HALF_OPEN' ? 'orange' : 'green' }}>
                    {g.state}
                  </td>
                  <td>{g.failureCount}</td>
                  <td>{calculateScore(g, weights).toFixed(2)}</td>
                  <td>
                    <button onClick={() => simulateFailure(g.id)}>Force Fail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '8px' }}>
        <h3>Transactions Log</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee', position: 'sticky', top: 0, backgroundColor: '#f9f9f9' }}>
                <th>ID</th>
                <th>Time</th>
                <th>Gateway</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                // Determine color
                let color = 'black';
                if (tx.status === TransactionStatus.SUCCESS) color = 'green';
                if (tx.status === TransactionStatus.PENDING) color = 'orange';
                if (tx.status === TransactionStatus.SOFT_FAILURE || tx.status === TransactionStatus.HARD_DECLINE) color = 'red';
                
                return (
                  <tr key={tx.idempotencyKey} style={{ borderBottom: '1px solid #eee' }}>
                    <td>{tx.idempotencyKey}</td>
                    <td>{new Date(tx.timestamp).toLocaleTimeString()}</td>
                    <td>{gateways.find(g => g.id === tx.gatewayId)?.name || 'N/A'}</td>
                    <td style={{ color }}>{tx.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
