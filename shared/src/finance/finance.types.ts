export type FinanceModule = "income" | "expenses" | "invoices" | "payments" | "taxes" | "budgets";

export type InvoiceFormInput = {
 customer: string;
 email: string;
 issueDate: string;
 dueDate: string;
 itemDescription: string;
 quantity: number;
 rate: number;
 taxRate: number;
};
