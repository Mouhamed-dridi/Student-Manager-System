import { useEffect } from "react";
import type { Payment } from "./PaymentForm";

interface PrintTicketProps {
  payment: Payment;
}

export default function PrintTicket({ payment }: PrintTicketProps) {
  useEffect(() => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Payment Ticket</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      display: flex;
      justify-content: center;
      padding: 20px;
    }
    .ticket {
      width: 280px;
      border: 2px dashed #333;
      padding: 16px;
      text-align: center;
    }
    .title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px dashed #999;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 4px 0;
    }
    .label { color: #666; }
    .amount {
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0;
      border-top: 1px dashed #999;
      border-bottom: 1px dashed #999;
      padding: 6px 0;
    }
    .footer {
      font-size: 10px;
      color: #999;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="title">Payment Ticket</div>
    <div class="row">
      <span class="label">Student</span>
      <span>${payment.studentName}</span>
    </div>
    <div class="amount">${payment.amount.toFixed(2)}</div>
    <div class="row">
      <span class="label">Date</span>
      <span>${payment.date}</span>
    </div>
    <div class="footer">Student Manager System</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=400,height=500");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  }, [payment]);

  return null;
}
