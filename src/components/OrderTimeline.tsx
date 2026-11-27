import React from 'react';
import {
  ORDER_WORKFLOW_STATUSES,
  DisplayOrderStatus,
  workflowStatusIndex,
  workflowStatusLabel,
  workflowStatusOf,
} from '../lib/orderWorkflow';

export type OrderProgressStatus = DisplayOrderStatus | string;

interface OrderTimelineProps {
  status: OrderProgressStatus;
  size?: 'sm' | 'md';
}

const SHORT_LABELS: Record<DisplayOrderStatus, string> = {
  submitted: 'Submitted',
  supplier_reviewing: 'Reviewing',
  supplier_quotation_received: 'Quotation',
  proforma_approved: 'Proforma',
  payment_confirmed: 'Payment',
  materials_preparing: 'Preparing',
  transporter_assigned: 'Assigned',
  delivery_in_transit: 'In transit',
  customer_confirmed_receipt: 'Receipt',
  order_completed: 'Completed',
  cancelled: 'Cancelled',
};

const NOTES: Record<DisplayOrderStatus, string> = {
  submitted: 'Order submitted - awaiting supplier review.',
  supplier_reviewing: 'Supplier is reviewing the requested materials.',
  supplier_quotation_received: 'Quotation received - awaiting proforma approval.',
  proforma_approved: 'Proforma approved - waiting for payment confirmation.',
  payment_confirmed: 'Payment confirmed or agreed terms - supplier is preparing materials.',
  materials_preparing: 'Supplier is preparing the ordered materials.',
  transporter_assigned: 'Transporter assigned - delivery being arranged.',
  delivery_in_transit: 'Delivery in transit - on its way to your project location.',
  customer_confirmed_receipt: 'Receipt confirmed - order is ready for completion.',
  order_completed: 'Order completed - thank you for buying with E-SCON.',
  cancelled: 'Order cancelled - no delivery in progress.',
};

const OrderTimeline: React.FC<OrderTimelineProps> = ({ status, size = 'md' }) => {
  const currentStatus = workflowStatusOf(status);
  const current = workflowStatusIndex(currentStatus);
  const cancelled = currentStatus === 'cancelled';
  const position = current < 0 ? 0 : current + 1;

  return (
    <div className={'m-progress m-progress-' + size}>
      {cancelled ? (
        <div className="m-progress-cancelled">
          <span className="m-progress-cancel-icon"></span>
          <span>Order cancelled{size === 'sm' ? '' : ' - no delivery in progress'}</span>
        </div>
      ) : (
        <>
          <div className="m-progress-track">
            {ORDER_WORKFLOW_STATUSES.map((step, i) => {
              const reached = i <= current;
              const active = i === current;
              return (
                <div
                  key={step}
                  className={
                    'm-progress-step' +
                    (reached ? ' reached' : '') +
                    (active ? ' active' : '') +
                    (i === ORDER_WORKFLOW_STATUSES.length - 1 ? ' last' : '')
                  }
                >
                  <div className="m-progress-dot">
                    <span className="m-progress-icon">{reached ? String(i + 1) : '-'}</span>
                  </div>
                  {size === 'md' && <span className="m-progress-label">{SHORT_LABELS[step]}</span>}
                  {i < ORDER_WORKFLOW_STATUSES.length - 1 && <span className="m-progress-line" />}
                </div>
              );
            })}
          </div>
          <div className="m-progress-note">
            Step {position} of {ORDER_WORKFLOW_STATUSES.length}: {workflowStatusLabel(currentStatus)}. {NOTES[currentStatus]}
          </div>
        </>
      )}
    </div>
  );
};

export default OrderTimeline;
