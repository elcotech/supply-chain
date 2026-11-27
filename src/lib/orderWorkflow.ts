import { LegacyOrderStatus, Order, OrderStatus, UserRole, WorkflowOrderStatus } from '../types';

export type DisplayOrderStatus = WorkflowOrderStatus | 'cancelled';

export const ORDER_WORKFLOW_STATUSES: WorkflowOrderStatus[] = [
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
];

export const WORKFLOW_STATUS_LABELS: Record<DisplayOrderStatus, string> = {
  submitted: 'Submitted',
  supplier_reviewing: 'Supplier reviewing',
  supplier_quotation_received: 'Supplier quotation received',
  proforma_approved: 'Customer approves proforma',
  payment_confirmed: 'Payment confirmed or agreed terms',
  materials_preparing: 'Supplier prepares materials',
  transporter_assigned: 'Transporter assigned',
  delivery_in_transit: 'Delivery in transit',
  customer_confirmed_receipt: 'Customer confirms receipt',
  order_completed: 'Order completed',
  cancelled: 'Cancelled',
};

const STATUS_INDEX: Record<WorkflowOrderStatus, number> = ORDER_WORKFLOW_STATUSES.reduce(
  (acc, status, index) => ({ ...acc, [status]: index }),
  {} as Record<WorkflowOrderStatus, number>
);

const LEGACY_TO_WORKFLOW: Record<LegacyOrderStatus, DisplayOrderStatus> = {
  pending: 'submitted',
  confirmed: 'supplier_quotation_received',
  shipped: 'delivery_in_transit',
  delivered: 'order_completed',
  cancelled: 'cancelled',
};

const WORKFLOW_TO_LEGACY: Record<WorkflowOrderStatus, LegacyOrderStatus> = {
  submitted: 'pending',
  supplier_reviewing: 'pending',
  supplier_quotation_received: 'confirmed',
  proforma_approved: 'confirmed',
  payment_confirmed: 'confirmed',
  materials_preparing: 'confirmed',
  transporter_assigned: 'shipped',
  delivery_in_transit: 'shipped',
  customer_confirmed_receipt: 'delivered',
  order_completed: 'delivered',
};

const STATUS_ACTORS: Record<WorkflowOrderStatus, UserRole[]> = {
  submitted: ['company', 'admin'],
  supplier_reviewing: ['company', 'admin'],
  supplier_quotation_received: ['customer', 'admin'],
  proforma_approved: ['customer', 'admin'],
  payment_confirmed: ['company', 'admin'],
  materials_preparing: ['company', 'admin'],
  transporter_assigned: ['transporter', 'admin'],
  delivery_in_transit: ['customer', 'admin'],
  customer_confirmed_receipt: ['admin'],
  order_completed: [],
};

const isWorkflowStatus = (status: string): status is WorkflowOrderStatus =>
  Object.prototype.hasOwnProperty.call(STATUS_INDEX, status);

const isLegacyStatus = (status: string): status is LegacyOrderStatus =>
  Object.prototype.hasOwnProperty.call(LEGACY_TO_WORKFLOW, status);

export const workflowStatusOf = (
  orderOrStatus: Order | OrderStatus | string | null | undefined
): DisplayOrderStatus => {
  if (!orderOrStatus) return 'submitted';
  if (typeof orderOrStatus === 'object') {
    if (orderOrStatus.workflowStatus) return orderOrStatus.workflowStatus;
    return workflowStatusOf(orderOrStatus.status);
  }
  if (isWorkflowStatus(orderOrStatus)) return orderOrStatus;
  if (isLegacyStatus(orderOrStatus)) return LEGACY_TO_WORKFLOW[orderOrStatus];
  return 'submitted';
};

export const legacyOrderStatusOf = (status: DisplayOrderStatus): LegacyOrderStatus =>
  status === 'cancelled' ? 'cancelled' : WORKFLOW_TO_LEGACY[status];

export const workflowStatusLabel = (status: DisplayOrderStatus): string =>
  WORKFLOW_STATUS_LABELS[workflowStatusOf(status)];

export const workflowStatusIndex = (status: DisplayOrderStatus): number => {
  const normalized = workflowStatusOf(status);
  return normalized === 'cancelled' ? -1 : STATUS_INDEX[normalized];
};

export const workflowProgress = (status: DisplayOrderStatus): number => {
  const index = workflowStatusIndex(status);
  return index < 0 ? 0 : ((index + 1) / ORDER_WORKFLOW_STATUSES.length) * 100;
};

export const nextWorkflowStatus = (status: DisplayOrderStatus): WorkflowOrderStatus | null => {
  const normalized = workflowStatusOf(status);
  if (normalized === 'cancelled') return null;
  const index = STATUS_INDEX[normalized];
  return ORDER_WORKFLOW_STATUSES[index + 1] || null;
};

export const nextWorkflowStatusForRole = (
  status: DisplayOrderStatus,
  role: UserRole | null | undefined
): WorkflowOrderStatus | null => {
  const next = nextWorkflowStatus(status);
  if (!next || !role) return null;
  if (role === 'admin') return next;
  const normalized = workflowStatusOf(status);
  if (normalized === 'cancelled') return null;
  return STATUS_ACTORS[normalized].includes(role) ? next : null;
};

export const canAdvanceWorkflowStatus = (
  from: DisplayOrderStatus,
  to: DisplayOrderStatus,
  role: UserRole | null | undefined
): boolean => {
  if (from === 'cancelled' || to === 'cancelled') return false;
  const normalizedTo = workflowStatusOf(to);
  return nextWorkflowStatusForRole(from, role) === normalizedTo;
};
