import type { InvoiceRecord } from "@shared/finance/finance.api";

export function formatMoney(value: number) {
 return new Intl.NumberFormat("en-US", {
 currency: "USD",
 maximumFractionDigits: 0,
 style: "currency",
 }).format(value);
}

export function downloadInvoicePdf(invoice: InvoiceRecord) {
 const content = [
 `AI BOS Invoice ${invoice.invoiceNo}`,
 `Customer: ${invoice.customer}`,
 `Email: ${invoice.email}`,
 `Issue Date: ${invoice.issueDate}`,
 `Due Date: ${invoice.dueDate}`,
 "",
 ...invoice.items.map((item) => `${item.description} x ${item.quantity} @ ${formatMoney(item.rate)}`),
 "",
 `Subtotal: ${formatMoney(invoice.subtotal)}`,
 `Tax: ${formatMoney(invoice.tax)}`,
 `Total: ${formatMoney(invoice.total)}`,
 ].join("\n");
 const blob = new Blob([content], { type: "application/pdf" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = `${invoice.invoiceNo}.pdf`;
 anchor.click();
 URL.revokeObjectURL(url);
}
