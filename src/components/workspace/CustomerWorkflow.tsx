import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DeliveryEstimate,
  LiveGpsPosition,
  Material,
  OrderReceipt,
  WorkflowPaymentMethod,
  WorkflowSelection,
} from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { jobStatus, TRANSPORT_STATUS_LABELS } from '../../lib/transport';
import useLocalCollection from '../../hooks/useLocalCollection';
import {
  EmptyState, Kpi, KpiGrid, Modal, Panel, ProgressBar, SectionHeader,
  StatusPill, toneFor,
} from './ui';
import { WorkspaceProps } from './types';

type FindMode = 'category' | 'supplier' | 'city';

const STEPS = [
  { id: 'finding', label: 'Finding', detail: 'Category | Supplier | City' },
  { id: 'order', label: 'Order', detail: 'Select items | Quantity | Review' },
  { id: 'gps', label: 'GPS & Delivery', detail: 'Route | Distance | Transport cost' },
  { id: 'payment', label: 'Payment', detail: 'Total | Method | Confirmation' },
  { id: 'tracking', label: 'Tracking', detail: 'Status | Live GPS | Completion' },
] as const;

const CustomerWorkflow: React.FC<WorkspaceProps> = props => {
  const {
    user, companies, materials, orders, settings, transporterProfiles,
    onNotify, onOpenMap, onSaveMyLocation, onUpdateOrderStatus,
    onRefreshCatalog, onPrepareWorkflowOrder, onSubmitWorkflowOrder,
    onEstimateDelivery, onGetLiveGps,
  } = props;

  const [stage, setStage] = useState(0);
  const [findMode, setFindMode] = useState<FindMode>('category');
  const [findTerm, setFindTerm] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<WorkflowPaymentMethod>('bank');
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(Date.now());
  const [receipt, setReceipt] = useLocalCollection<OrderReceipt | null>(`workflow_receipt_${user.id}`, null);
  const [liveGps, setLiveGps] = useState<LiveGpsPosition | null>(null);
  const estimateRef = useRef(onEstimateDelivery);
  useEffect(() => { estimateRef.current = onEstimateDelivery; }, [onEstimateDelivery]);

  const money = (value: number) => formatCurrency(Math.round(value * 100) / 100);
  const supplier = companies.find(company => company.id === supplierId) || null;
  const supplierProducts = useMemo(
    () => materials.filter(material => material.companyId === supplierId),
    [materials, supplierId]
  );
  const myOrders = useMemo(
    () => orders.filter(order => order.customerId === user.id).sort((a, b) => Date.parse(b.orderDate) - Date.parse(a.orderDate)),
    [orders, user.id]
  );

  const categories = useMemo(
    () => Array.from(new Set(materials.map(material => material.category).filter(Boolean))).sort(),
    [materials]
  );
  const cities = useMemo(
    () => Array.from(new Set(companies.map(company => company.city).filter(Boolean))).sort(),
    [companies]
  );

  const matchingSuppliers = useMemo(() => {
    const term = findTerm.trim().toLowerCase();
    if (!term) return companies;
    if (findMode === 'supplier') {
      return companies.filter(company => `${company.name} ${company.description || ''}`.toLowerCase().includes(term));
    }
    if (findMode === 'city') {
      return companies.filter(company => `${company.city} ${company.location || ''}`.toLowerCase().includes(term));
    }
    const productSupplierIds = new Set(
      materials
        .filter(material => `${material.category} ${material.name} ${material.description || ''}`.toLowerCase().includes(term))
        .map(material => material.companyId)
    );
    return companies.filter(company => productSupplierIds.has(company.id));
  }, [companies, findTerm, findMode, materials]);

  const selections: WorkflowSelection[] = useMemo(
    () => supplierProducts
      .filter(material => Number(selectedQty[material.id]) > 0)
      .map(material => ({
        materialId: material.id,
        quantity: Math.floor(Number(selectedQty[material.id])),
        includeDelivery: true,
        distanceKm: estimate?.distanceKm,
      })),
    [supplierProducts, selectedQty, estimate]
  );

  const subtotal = selections.reduce((sum, line) => {
    const material = materials.find(item => item.id === line.materialId);
    return sum + (material ? material.price * line.quantity : 0);
  }, 0);
  const vatRate = settings.vat.enabled ? settings.vat.rate || 0 : 0;
  const vat = Math.round(subtotal * vatRate) / 100;
  const transportCost = estimate?.transportCost || 0;
  const grandTotal = Math.round((subtotal + vat + transportCost) * 100) / 100;
  const selectedCount = selections.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    if (!supplierId || !estimateRef.current) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    void estimateRef.current(supplierId)
      .then(result => { if (!cancelled) setEstimate(result); })
      .catch(() => { if (!cancelled) setEstimate(null); })
      .finally(() => { if (!cancelled) setEstimateLoading(false); });
    return () => { cancelled = true; };
  }, [supplierId, refreshedAt]);

  useEffect(() => {
    if (!onGetLiveGps) return;
    const readPosition = () => {
      const active = myOrders.find(order =>
        order.transporterId &&
        ['shipped', 'confirmed'].includes(order.status) &&
        order.status !== 'delivered'
      );
      setLiveGps(active?.transporterId ? onGetLiveGps(active.transporterId) : null);
    };
    readPosition();
    const timer = window.setInterval(readPosition, 5000);
    return () => window.clearInterval(timer);
  }, [myOrders, onGetLiveGps]);

  const chooseSupplier = (id: string) => {
    setSupplierId(id);
    setSelectedQty({});
    setEstimate(null);
  };

  const refreshPrices = async () => {
    if (onRefreshCatalog) await onRefreshCatalog();
    setRefreshedAt(Date.now());
    onNotify('Available items and prices refreshed.', 'success');
  };

  const setQuantity = (material: Material, quantity: number) => {
    const next = Math.max(0, Math.min(Math.floor(quantity || 0), Math.max(0, material.quantity)));
    setSelectedQty(prev => ({ ...prev, [material.id]: next }));
  };

  const goToStage = (next: number) => {
    if (next > 0 && !supplier && !receipt) {
      onNotify('Select a supplier first.', 'warning');
      setStage(0);
      return;
    }
    if (next >= 1 && selections.length === 0 && !receipt) {
      onNotify('Select at least one item to continue.', 'warning');
      return;
    }
    setStage(next);
  };

  const submitOrder = async () => {
    if (selections.length === 0) {
      onNotify('Select at least one item before submitting.', 'warning');
      return;
    }
    if (!onPrepareWorkflowOrder || !onSubmitWorkflowOrder) {
      onNotify('Order submission is not configured for this account.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const lines = await onPrepareWorkflowOrder(selections);
      if (!lines || lines.length === 0) return;
      const result = await onSubmitWorkflowOrder(lines, paymentMethod);
      if (!result) return;
      setReceipt(result);
      setPreviewOpen(false);
      setSelectedQty({});
      setStage(4);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepNav = () => (
    <div className="ws-workflow-steps" role="tablist" aria-label="Customer workflow stages">
      {STEPS.map((step, index) => (
        <button
          key={step.id}
          type="button"
          role="tab"
          aria-selected={stage === index}
          className={'ws-workflow-step' + (stage === index ? ' active' : '') + (index < stage ? ' done' : '')}
          onClick={() => goToStage(index)}
        >
          <span className="ws-workflow-step-no">{index + 1}</span>
          <span><strong>{step.label}</strong><small>{step.detail}</small></span>
        </button>
      ))}
    </div>
  );

  const renderFinding = () => (
    <>
      <div className="ws-workflow-filters">
        {(['category', 'supplier', 'city'] as FindMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            className={'btn btn-sm ' + (findMode === mode ? 'btn-primary' : 'btn-secondary')}
            onClick={() => { setFindMode(mode); setFindTerm(''); }}
          >
            Search by {mode === 'city' ? 'City' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
        <input
          list={'workflow-' + findMode}
          value={findTerm}
          onChange={event => setFindTerm(event.target.value)}
          placeholder={findMode === 'category' ? 'Cement, steel, aggregates...' : findMode === 'supplier' ? 'Supplier name' : 'City'}
          aria-label={`Search by ${findMode}`}
        />
        <datalist id="workflow-category">
          {categories.map(category => <option key={category} value={category} />)}
        </datalist>
        <datalist id="workflow-supplier">
          {companies.map(company => <option key={company.id} value={company.name} />)}
        </datalist>
        <datalist id="workflow-city">
          {cities.map(city => <option key={city} value={city} />)}
        </datalist>
      </div>
      <p className="ws-muted">{matchingSuppliers.length} supplier{matchingSuppliers.length === 1 ? '' : 's'} found</p>
      {matchingSuppliers.length === 0 ? (
        <EmptyState icon="" title="No suppliers found" text="Try another category, supplier name or city." />
      ) : (
        <div className="ws-supplier-grid">
          {matchingSuppliers.map(company => {
            const products = materials.filter(material => material.companyId === company.id);
            const categoriesForSupplier = Array.from(new Set(products.map(material => material.category)));
            return (
              <div key={company.id} className={'ws-supplier' + (supplierId === company.id ? ' ws-selected' : '')}>
                <div className="ws-supplier-head">
                  <strong>{company.name}</strong>
                  <StatusPill label={company.complianceStatus || 'pending'} tone={toneFor(company.complianceStatus || 'pending')} />
                </div>
                <p>{company.description || 'No supplier description provided.'}</p>
                <ul className="ws-detail-list">
                  <li><span>City</span><strong>{company.city}</strong></li>
                  <li><span>Categories</span><strong>{categoriesForSupplier.slice(0, 3).join(', ') || '-'}</strong></li>
                  <li><span>Items</span><strong>{products.length}</strong></li>
                  <li><span>Location</span><strong>{company.location || 'Not provided'}</strong></li>
                </ul>
                <div className="ws-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap(company.id)}>GPS map</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => chooseSupplier(company.id)}>
                    {supplierId === company.id ? 'Selected' : 'Select supplier'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {supplier && (
        <Panel title={`Selected supplier: ${supplier.name}`} subtitle="Continue to browse this supplier's live catalogue">
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-primary" onClick={() => goToStage(1)}>Continue to order</button>
          </div>
        </Panel>
      )}
    </>
  );

  const renderOrder = () => {
    if (!supplier) {
      return <Panel><EmptyState icon="" title="No supplier selected" text="Find and select a supplier first." action={<button className="btn btn-primary" onClick={() => setStage(0)}>Find suppliers</button>} /></Panel>;
    }
    return (
      <>
        <Panel
          title={`Available items from ${supplier.name}`}
          subtitle={`Refreshed ${new Date(refreshedAt).toLocaleTimeString()} - tick each item and set its quantity`}
          actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { void refreshPrices(); }}>Refresh items & prices</button>}
        >
          {supplierProducts.length === 0 ? (
            <EmptyState icon="" title="No available items" text="This supplier has no published catalogue." />
          ) : (
            <div className="table-scroll-container">
              <table className="data-table ws-table">
                <thead>
                  <tr><th>Select</th><th>Item</th><th>Description</th><th>Price</th><th>Stock</th><th>Quantity</th><th>Line total</th><th /></tr>
                </thead>
                <tbody>
                  {supplierProducts.map(material => {
                    const quantity = Number(selectedQty[material.id]) || 0;
                    return (
                      <tr key={material.id} className={quantity > 0 ? 'ws-selected-row' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={quantity > 0}
                            aria-label={'Select ' + material.name}
                            onChange={event => setQuantity(material, event.target.checked ? Math.max(1, material.minOrder || 1) : 0)}
                          />
                        </td>
                        <td><strong>{material.name}</strong><small className="ws-block">{material.category}</small></td>
                        <td>{material.description || material.specifications?.grade || '-'}</td>
                        <td>{money(material.price)} / {material.unit}</td>
                        <td>{material.quantity} {material.unit}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={material.quantity}
                            value={quantity}
                            disabled={quantity === 0}
                            aria-label={'Quantity for ' + material.name}
                            onChange={event => setQuantity(material, parseInt(event.target.value, 10))}
                          />
                        </td>
                        <td><strong>{money(material.price * quantity)}</strong></td>
                        <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailMaterial(material)}>Details</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Selected items" subtitle={`${selections.length} line(s), ${selectedCount} unit(s)`}>
          {selections.length === 0 ? <EmptyState icon="" title="Nothing selected" text="Tick the checkbox beside each item you want to order." /> : (
            <>
              <div className="table-scroll-container">
                <table className="data-table ws-table">
                  <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {selections.map(line => {
                      const material = materials.find(item => item.id === line.materialId);
                      if (!material) return null;
                      return (
                        <tr key={line.materialId}>
                          <td>{material.name}</td>
                          <td>{line.quantity} {material.unit}</td>
                          <td>{money(material.price)}</td>
                          <td><strong>{money(material.price * line.quantity)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="ws-detail-list ws-workflow-totals">
                <li><span>Subtotal</span><strong>{money(subtotal)}</strong></li>
                <li><span>VAT ({vatRate}%)</span><strong>{money(vat)}</strong></li>
                <li><span>Transport estimate</span><strong>{estimateLoading ? 'Calculating...' : money(transportCost)}</strong></li>
                <li className="ws-total-row"><span>Grand total</span><strong>{money(grandTotal)}</strong></li>
              </ul>
            </>
          )}
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStage(0)}>Back to finding</button>
            <button type="button" className="btn btn-primary" disabled={selections.length === 0} onClick={() => setPreviewOpen(true)}>Preview & review</button>
          </div>
        </Panel>

        {previewOpen && <Modal title="Order preview & review" onClose={() => setPreviewOpen(false)} wide footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPreviewOpen(false)}>Keep editing</button>
            <button type="button" className="btn btn-primary" onClick={() => { setPreviewOpen(false); goToStage(2); }}>Approve & continue to delivery</button>
          </>
        }>
            <div className="ws-workflow-review">
              <ul className="ws-detail-list">
                <li><span>Supplier</span><strong>{supplier.name}</strong></li>
                <li><span>Deliver to</span><strong>{user.address || '-'}, {user.city}</strong></li>
                <li><span>Road distance</span><strong>{estimate ? `${estimate.distanceKm.toFixed(1)} km` : 'Not measured'}</strong></li>
                <li><span>Transport cost</span><strong>{money(transportCost)}</strong></li>
              </ul>
              <table className="data-table ws-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {selections.map(line => {
                    const material = materials.find(item => item.id === line.materialId);
                    if (!material) return null;
                    return <tr key={line.materialId}><td>{material.name}</td><td>{line.quantity}</td><td>{money(material.price)}</td><td>{money(material.price * line.quantity)}</td></tr>;
                  })}
                </tbody>
              </table>
              <ul className="ws-detail-list ws-workflow-totals">
                <li><span>Goods subtotal</span><strong>{money(subtotal)}</strong></li>
                <li><span>VAT</span><strong>{money(vat)}</strong></li>
                <li><span>Transport</span><strong>{money(transportCost)}</strong></li>
                <li className="ws-total-row"><span>Grand total</span><strong>{money(grandTotal)}</strong></li>
              </ul>
            </div>
        </Modal>}

        {detailMaterial && <Modal title={detailMaterial.name} onClose={() => setDetailMaterial(null)} footer={
          <button type="button" className="btn btn-primary" onClick={() => setDetailMaterial(null)}>Close</button>
        }>
            <ul className="ws-detail-list">
              <li><span>Category</span><strong>{detailMaterial.category}</strong></li>
              <li><span>Price</span><strong>{money(detailMaterial.price)} / {detailMaterial.unit}</strong></li>
              <li><span>Description</span><strong>{detailMaterial.description || '-'}</strong></li>
              <li><span>Brand / grade</span><strong>{detailMaterial.brand || detailMaterial.specifications?.grade || '-'}</strong></li>
              <li><span>Available</span><strong>{detailMaterial.quantity} {detailMaterial.unit}</strong></li>
              <li><span>Last updated</span><strong>{formatDate(detailMaterial.lastUpdated)}</strong></li>
            </ul>
        </Modal>}
      </>
    );
  };

  const renderGps = () => (
    <>
      <KpiGrid>
        <Kpi label="Road distance" value={estimate ? `${estimate.distanceKm.toFixed(1)} km` : '-'} icon="" tone="accent" />
        <Kpi label="Estimated drive" value={estimate ? `${Math.round(estimate.durationMin)} min` : '-'} icon="" />
        <Kpi label="Transport cost" value={money(transportCost)} icon="" tone="good" />
        <Kpi label="Est. delivery" value={estimate ? new Date(Date.now() + estimate.durationMin * 60000).toLocaleDateString('en-GB') : '-'} icon="" />
      </KpiGrid>
      <div className="ws-grid-2">
        <Panel title="Delivery route" subtitle="Supplier location to your delivery destination">
          <ul className="ws-detail-list">
            <li><span>Supplier</span><strong>{supplier?.name || '-'}</strong></li>
            <li><span>From</span><strong>{supplier?.location || supplier?.city || '-'} {estimate ? `(${estimate.destination.lat.toFixed(5)}, ${estimate.destination.lng.toFixed(5)})` : ''}</strong></li>
            <li><span>To</span><strong>{user.address || '-'}, {user.city} {estimate ? `(${estimate.origin.lat.toFixed(5)}, ${estimate.origin.lng.toFixed(5)})` : ''}</strong></li>
            <li><span>Route</span><strong>{estimateLoading ? 'Measuring road route...' : estimate ? `${estimate.distanceKm.toFixed(1)} km road route` : 'Location required'}</strong></li>
          </ul>
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-primary" onClick={() => supplier && onOpenMap(supplier.id)} disabled={!supplier}>Display route on GPS map</button>
            <button type="button" className="btn btn-secondary" onClick={onSaveMyLocation}>Update delivery location</button>
          </div>
          {!estimate && !estimateLoading && (
            <p className="ws-note">Set your delivery location to measure the road distance and calculate the transport cost automatically.</p>
          )}
        </Panel>
        <Panel title="Delivery information" subtitle="Calculated from the measured route">
          <ul className="ws-detail-list">
            <li><span>Items</span><strong>{selectedCount} unit(s) in {selections.length} line(s)</strong></li>
            <li><span>Goods value</span><strong>{money(subtotal)}</strong></li>
            <li><span>Transport cost</span><strong>{money(transportCost)}</strong></li>
            <li><span>VAT</span><strong>{money(vat)}</strong></li>
            <li className="ws-total-row"><span>Estimated payable</span><strong>{money(grandTotal)}</strong></li>
          </ul>
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStage(1)}>Back to order</button>
            <button type="button" className="btn btn-primary" onClick={() => setStage(3)}>Continue to payment</button>
          </div>
        </Panel>
      </div>
    </>
  );

  const renderPayment = () => (
    <>
      <KpiGrid>
        <Kpi label="Selected items total" value={money(subtotal)} icon="" />
        <Kpi label="Transport cost" value={money(transportCost)} icon="" />
        <Kpi label="VAT" value={money(vat)} icon="" />
        <Kpi label="Grand total" value={money(grandTotal)} icon="" tone="accent" />
      </KpiGrid>
      <div className="ws-grid-2">
        <Panel title="Payment option" subtitle="Choose how this order will be settled">
          <div className="ws-workflow-payment">
            {([
              ['wallet', 'E-SCON Wallet', `Instant payment - ${money(props.wallets[user.id] || 0)} available`],
              ['bank', 'Bank transfer', 'Pay from your bank account'],
              ['cod', 'Cash on delivery', 'Pay the transporter on arrival'],
            ] as [WorkflowPaymentMethod, string, string][]).map(([value, label, hint]) => (
              <label key={value} className={paymentMethod === value ? 'active' : ''}>
                <input type="radio" name="workflow-payment" checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} />
                <span><strong>{label}</strong><small>{hint}</small></span>
              </label>
            ))}
          </div>
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStage(2)}>Back to delivery</button>
            <button type="button" className="btn btn-primary" disabled={submitting || selections.length === 0} onClick={() => { void submitOrder(); }}>
              {submitting ? 'Submitting order...' : 'Confirm & submit order'}
            </button>
          </div>
        </Panel>
        <Panel title="Payment summary" subtitle="Auto-calculated from items, VAT and road distance">
          <ul className="ws-detail-list">
            <li><span>Supplier</span><strong>{supplier?.name || '-'}</strong></li>
            <li><span>Items</span><strong>{selections.length} line(s)</strong></li>
            <li><span>Distance</span><strong>{estimate ? `${estimate.distanceKm.toFixed(1)} km` : '-'}</strong></li>
            <li><span>Transport</span><strong>{money(transportCost)}</strong></li>
            <li className="ws-total-row"><span>Grand total</span><strong>{money(grandTotal)}</strong></li>
          </ul>
          <p className="ws-note">Your order is committed through the same VAT, delivery, wallet and cloud-sync path used by the main checkout.</p>
        </Panel>
      </div>
      {receipt && (
        <Panel title="Payment confirmation" subtitle="Latest transaction from this workflow">
          <ul className="ws-detail-list">
            <li><span>Transaction ID</span><strong>{receipt.transactionId}</strong></li>
            <li><span>Order number(s)</span><strong>{receipt.orderNumbers.join(', ')}</strong></li>
            <li><span>Method</span><strong>{receipt.paymentMethod}</strong></li>
            <li><span>Amount</span><strong>{money(receipt.total)}</strong></li>
            <li><span>Status</span><strong>{receipt.paid ? 'Paid' : 'Awaiting settlement'}</strong></li>
            <li><span>Date</span><strong>{new Date(receipt.createdAt).toLocaleString()}</strong></li>
          </ul>
          <div className="ws-workflow-inline-actions">
            <button type="button" className="btn btn-primary" onClick={() => setStage(4)}>Track this order</button>
          </div>
        </Panel>
      )}
    </>
  );

  const renderTracking = () => {
    const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
    return (
      <>
        <SectionHeader
          eyebrow="Customers"
          title="Tracking & Delivery"
          hint="Follow order status, live vehicle GPS, delivery progress and completion confirmation."
        />
        {myOrders.length === 0 ? (
          <Panel><EmptyState icon="" title="No orders to track" text="Your placed orders will appear here." action={<button className="btn btn-primary" onClick={() => setStage(0)}>Start an order</button>} /></Panel>
        ) : (
          <div className="ws-track-list">
            {myOrders.slice(0, 8).map(order => {
              const index = Math.max(0, steps.indexOf(order.status));
              const progress = [10, 35, 75, 100][index];
              const transporter = transporterProfiles.find(profile => profile.userId === order.transporterId);
              const position = order.transporterId ? liveGps : null;
              return (
                <div key={order.id} className="ws-track">
                  <div className="ws-track-head">
                    <div>
                      <strong>{order.orderNumber || order.invoiceNumber}</strong>
                      <small>{materials.find(material => material.id === order.materialId)?.name || 'Order'} - {order.quantity} units - {supplier?.name || companies.find(company => company.id === order.companyId)?.name || 'Supplier'}</small>
                    </div>
                    <StatusPill label={order.status} tone={toneFor(order.status)} />
                  </div>
                  <div className="ws-timeline">
                    {steps.map((step, stepIndex) => (
                      <div key={step} className={'ws-step' + (stepIndex <= index ? ' done' : '')}>
                        <span>{stepIndex <= index ? '*' : 'o'}</span>
                        {step.charAt(0).toUpperCase() + step.slice(1)}
                      </div>
                    ))}
                  </div>
                  <ProgressBar value={progress} tone={order.status === 'delivered' ? 'good' : 'blue'} />
                  <ul className="ws-detail-list ws-workflow-totals">
                    <li><span>Order status</span><strong>{order.status}</strong></li>
                    <li><span>Delivery status</span><strong>{order.transportStatus ? TRANSPORT_STATUS_LABELS[jobStatus(order)] : 'Not assigned'}</strong></li>
                    <li><span>Transporter</span><strong>{transporter?.companyName || 'Not assigned'}</strong></li>
                    <li><span>Transport cost</span><strong>{money(order.transportCost || 0)}</strong></li>
                    <li><span>Destination</span><strong>{order.address}</strong></li>
                    <li>
                      <span>Live GPS</span>
                      <strong>
                        {position?.sharing && position.lat !== null && position.lng !== null
                          ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} - ${position.updatedAt ? new Date(position.updatedAt).toLocaleTimeString() : 'live'}`
                          : 'Not shared'}
                      </strong>
                    </li>
                    {order.transportPod && <li><span>Received by</span><strong>{order.transportPod.receivedBy}</strong></li>}
                  </ul>
                  <div className="ws-workflow-inline-actions">
                    {supplier && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenMap(supplier.id)}>Delivery route map</button>}
                    {order.status !== 'delivered' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => onUpdateOrderStatus(order.id, 'delivered')}>Confirm successful delivery</button>
                    )}
                    {order.status === 'delivered' && <StatusPill label="Order completed" tone="good" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <SectionHeader
        eyebrow="Customers"
        title="Customer Workflow"
        hint="Find a supplier, select and review items, measure the delivery route, pay and follow the order to completion."
      />
      {renderStepNav()}
      <div className="ws-workflow-body">
        {stage === 0 && renderFinding()}
        {stage === 1 && renderOrder()}
        {stage === 2 && renderGps()}
        {stage === 3 && renderPayment()}
        {stage === 4 && renderTracking()}
      </div>
      <div className="ws-workflow-inline-actions ws-workflow-footer">
        <button type="button" className="btn btn-secondary" disabled={stage === 0} onClick={() => setStage(stage - 1)}>Previous</button>
        {stage < 4 && <button type="button" className="btn btn-primary" onClick={() => goToStage(stage + 1)}>Next: {STEPS[stage + 1].label}</button>}
      </div>
    </>
  );
};

export default CustomerWorkflow;
