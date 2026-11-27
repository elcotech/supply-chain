import {
  ORDER_WORKFLOW_STATUSES,
  canAdvanceWorkflowStatus,
  legacyOrderStatusOf,
  nextWorkflowStatus,
  nextWorkflowStatusForRole,
  workflowProgress,
  workflowStatusLabel,
  workflowStatusOf,
} from './orderWorkflow';

describe('order workflow helpers', () => {
  it('exposes the ten required statuses in order', () => {
    expect(ORDER_WORKFLOW_STATUSES).toEqual([
      'submitted',
      'supplier_reviewing',
      'supplier_quotation_received',
      'proforma_approved',
      'payment_confirmed',
      'materials_preparing',
      'transporter_assigned',
      'delivery_in_transit',
      'customer_confirmed_receipt',
      'order_completed',
    ]);
  });

  it('normalizes legacy statuses and explicit workflow statuses', () => {
    expect(workflowStatusOf('pending')).toBe('submitted');
    expect(workflowStatusOf('confirmed')).toBe('supplier_quotation_received');
    expect(workflowStatusOf('shipped')).toBe('delivery_in_transit');
    expect(workflowStatusOf('delivered')).toBe('order_completed');
    expect(workflowStatusOf('cancelled')).toBe('cancelled');
    expect(workflowStatusOf({ status: 'pending', workflowStatus: 'transporter_assigned' } as any)).toBe('transporter_assigned');
  });

  it('mirrors workflow statuses to legacy statuses for existing dashboards', () => {
    expect(legacyOrderStatusOf('submitted')).toBe('pending');
    expect(legacyOrderStatusOf('payment_confirmed')).toBe('confirmed');
    expect(legacyOrderStatusOf('transporter_assigned')).toBe('shipped');
    expect(legacyOrderStatusOf('order_completed')).toBe('delivered');
    expect(legacyOrderStatusOf('cancelled')).toBe('cancelled');
  });

  it('labels each status with the documented wording', () => {
    expect(workflowStatusLabel('supplier_quotation_received')).toBe('Supplier quotation received');
    expect(workflowStatusLabel('payment_confirmed')).toBe('Payment confirmed or agreed terms');
    expect(workflowStatusLabel('customer_confirmed_receipt')).toBe('Customer confirms receipt');
  });

  it('walks the lifecycle and reports progress', () => {
    expect(nextWorkflowStatus('submitted')).toBe('supplier_reviewing');
    expect(nextWorkflowStatus('order_completed')).toBeNull();
    expect(workflowProgress('submitted')).toBe(10);
    expect(workflowProgress('order_completed')).toBe(100);
    expect(workflowProgress('cancelled')).toBe(0);
  });

  it('only advances to the next step for the responsible role', () => {
    expect(nextWorkflowStatusForRole('supplier_quotation_received', 'customer')).toBe('proforma_approved');
    expect(nextWorkflowStatusForRole('supplier_quotation_received', 'company')).toBeNull();
    expect(nextWorkflowStatusForRole('transporter_assigned', 'transporter')).toBe('delivery_in_transit');
    expect(nextWorkflowStatusForRole('delivery_in_transit', 'admin')).toBe('customer_confirmed_receipt');
    expect(canAdvanceWorkflowStatus('submitted', 'supplier_reviewing', 'company')).toBe(true);
    expect(canAdvanceWorkflowStatus('submitted', 'order_completed', 'company')).toBe(false);
    expect(canAdvanceWorkflowStatus('submitted', 'order_completed', 'admin')).toBe(false);
  });
});
