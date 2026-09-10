import { Button, Dialog, Notice } from "./ui";
import { formatInr } from "../config/product";

export type LocalCheckoutOrder = {
  orderId: string;
  amountPaise: number;
  currency: string;
};

export function LocalPaymentConsole({
  order,
  planName,
  busy,
  onApprove,
  onClose,
}: {
  order: LocalCheckoutOrder;
  planName: string;
  busy: boolean;
  onApprove: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title="Bullwave test payment" onClose={busy ? undefined : onClose}>
      <div className="local-payment-console">
        <Notice>Local test console. No card details are collected and no money is charged.</Notice>
        <div className="local-payment-summary">
          <span>Membership</span>
          <strong>{planName}</strong>
          <span>Test amount</span>
          <strong>{formatInr(order.amountPaise / 100)}</strong>
          <span>Currency</span>
          <strong>{order.currency}</strong>
        </div>
        <p className="meta">Order {order.orderId}</p>
        <div className="actions">
          <Button variant="primary" disabled={busy} onClick={onApprove}>
            {busy ? "Confirming…" : "Simulate successful payment"}
          </Button>
          <Button disabled={busy} onClick={onClose}>Cancel test</Button>
        </div>
      </div>
    </Dialog>
  );
}
