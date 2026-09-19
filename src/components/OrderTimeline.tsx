// ===== src/components/OrderTimeline.tsx =====
// Visual shipment progress tracker (banking-app style stepper) for the
// standard supply-chain order lifecycle:
//   Ordered → Confirmed → In Transit → Delivered
// Cancelled orders render a distinct failed state.
import React from 'react';

export type OrderProgressStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

interface OrderTimelineProps {
  status: OrderProgressStatus | string;
  size?: 'sm' | 'md';
}

const STEPS = [
  { key: 'pending', label: 'Ordered', icon: '📝' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'shipped', label: 'In Transit', icon: '🚚' },
  { key: 'delivered', label: 'Delivered', icon: '📦' },
];

const stepIndex = (status: string): number =>
  status === 'pending' ? 0 : status === 'confirmed' ? 1 : status === 'shipped' ? 2 : status === 'delivered' ? 3 : -1;

const OrderTimeline: React.FC<OrderTimelineProps> = ({ status, size = 'md' }) => {
  const cancelled = status === 'cancelled';
  const idx = stepIndex(status);
  const current = cancelled ? -1 : idx;

  return (
    <div className={'m-progress m-progress-' + size}>
      {cancelled ? (
        <div className="m-progress-cancelled">
          <span className="m-progress-cancel-icon">🚫</span>
          <span>Order cancelled{size === 'sm' ? '' : ' — no delivery in progress'}</span>
        </div>
      ) : (
        <>
          <div className="m-progress-track">
            {STEPS.map((step, i) => {
              const reached = i <= current;
              const active = i === current;
              return (
                <div
                  key={step.key}
                  className={
                    'm-progress-step' +
                    (reached ? ' reached' : '') +
                    (active ? ' active' : '') +
                    (i === STEPS.length - 1 ? ' last' : '')
                  }
                >
                  <div className="m-progress-dot">
                    <span className="m-progress-icon">{reached ? step.icon : '·'}</span>
                  </div>
                  <span className="m-progress-label">{step.label}</span>
                  {i < STEPS.length - 1 && <span className="m-progress-line" />}
                </div>
              );
            })}
          </div>
          {size === 'md' && current >= 0 && (
            <div className="m-progress-note">
              {current === 0 && '🧾 Order placed — awaiting supplier confirmation.'}
              {current === 1 && '✅ Supplier confirmed — goods are being prepared.'}
              {current === 2 && '🚚 In transit — on its way to your delivery address.'}
              {current === 3 && '📦 Delivered — thank you for buying with E-SCON!'}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OrderTimeline;