import { useEffect } from "react";
import type { Payment } from "./PaymentForm";
import type { Student } from "@/pages/students/StudentForm";

interface PrintReceiptProps {
  payment: Payment;
  student: Student;
}

const PLAN_LABELS: Record<Payment["planType"], string> = {
  "one-time": "One-time",
  semester: "Semester",
  monthly: "Monthly",
};

export default function PrintReceipt({ payment, student }: PrintReceiptProps) {
  useEffect(() => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Payment Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; }
    .receipt { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 24px; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #666; margin-top: 5px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { font-weight: 600; color: #444; }
    .value { color: #1a1a1a; }
    .total { font-size: 20px; font-weight: 700; border-top: 2px solid #1a1a1a; margin-top: 20px; padding-top: 20px; }
    .footer { text-align: center; margin-top: 40px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Payment Receipt</h1>
      <p>Student Manager System</p>
    </div>
    <div class="row">
      <span class="label">Student Name</span>
      <span class="value">${student.fullName}</span>
    </div>
    <div class="row">
      <span class="label">Program</span>
      <span class="value">${student.program}</span>
    </div>
    <div class="row">
      <span class="label">Phone</span>
      <span class="value">${student.phone}</span>
    </div>
    <div class="row">
      <span class="label">Email</span>
      <span class="value">${student.email}</span>
    </div>
    <div class="row">
      <span class="label">Plan Type</span>
      <span class="value">${PLAN_LABELS[payment.planType]}</span>
    </div>
    <div class="row">
      <span class="label">Date</span>
      <span class="value">${payment.date}</span>
    </div>
    <div class="row total">
      <span class="label">Amount Paid</span>
      <span class="value">${payment.amount.toFixed(2)}</span>
    </div>
    <div class="footer">Thank you for your payment.</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=700,height=900");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  }, [payment, student]);

  return null;
}
