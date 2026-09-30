import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
 CircleDollarSign,
 CreditCard,
 Download,
 FileText,
 Landmark,
 Mail,
 PiggyBank,
 Plus,
 ReceiptText,
 Search,
 Send,
 TrendingDown,
 TrendingUp,
 WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@shared/ui/ThemeToggle";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Dialog } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { cn } from "@shared/lib/utils";
import {
 createInvoice,
 fetchBudgets,
 fetchFinanceStats,
 fetchFinanceTransactions,
 fetchInvoices,
 fetchPayments,
 fetchTaxRecords,
 sendInvoice,
 type BudgetRecord,
 type FinanceChartPoint,
 type FinanceStats,
 type FinanceTransactionRecord,
 type InvoiceRecord,
 type PaymentRecord,
 type TaxRecordEntry,
} from "@shared/finance/finance.api";
import { invoiceFormSchema, type InvoiceFormValues } from "./finance.schema";
import type { FinanceModule, InvoiceFormInput } from "./finance.types";
import { downloadInvoicePdf, formatMoney } from "./finance.utils";

const modules: { id: FinanceModule; label: string; icon: LucideIcon }[] = [
 { id: "income", label: "Income", icon: TrendingUp },
 { id: "expenses", label: "Expenses", icon: TrendingDown },
 { id: "invoices", label: "Invoices", icon: FileText },
 { id: "payments", label: "Payments", icon: CreditCard },
 { id: "taxes", label: "Taxes", icon: Landmark },
 { id: "budgets", label: "Budgets", icon: PiggyBank },
];

const emptyInvoiceForm: InvoiceFormInput = {
 customer: "",
 email: "",
 issueDate: new Date().toISOString().slice(0, 10),
 dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
 itemDescription: "",
 quantity: 1,
 rate: 0,
 taxRate: 18,
};

function InvoiceFormModal({
 onClose,
 onSubmit,
}: {
 onClose: () => void;
 onSubmit: (input: InvoiceFormInput) => void;
}) {
 const {
 formState: { errors },
 handleSubmit,
 register,
 watch,
 } = useForm<InvoiceFormValues>({
 resolver: zodResolver(invoiceFormSchema),
 defaultValues: emptyInvoiceForm,
 });

 const quantity = watch("quantity");
 const rate = watch("rate");
 const taxRate = watch("taxRate");
 const estimatedTotal = (Number(quantity) || 0) * (Number(rate) || 0) * (1 + (Number(taxRate) || 0) / 100);

 return (
 <Dialog as="form" className="max-w-3xl" onClose={onClose} onSubmit={handleSubmit(onSubmit)}>
 <div className="mb-6 flex items-start justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">Generate Invoice</h2>
 <p className="mt-1 text-sm text-muted-foreground">Create a customer invoice with tax and line item details.</p>
 </div>
 <Button onClick={onClose} type="button" variant="outline">
 Close
 </Button>
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="customer">Customer</Label>
 <Input id="customer" className={cn(errors.customer && "border-destructive focus-visible:ring-destructive/20")} {...register("customer")} />
 {errors.customer && <p className="text-xs font-medium text-destructive">{errors.customer.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="email">Email</Label>
 <Input id="email" type="email" className={cn(errors.email && "border-destructive focus-visible:ring-destructive/20")} {...register("email")} />
 {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="issueDate">Issue Date</Label>
 <Input id="issueDate" type="date" {...register("issueDate")} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="dueDate">Due Date</Label>
 <Input id="dueDate" type="date" {...register("dueDate")} />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="itemDescription">Line Item</Label>
 <Input
 id="itemDescription"
 className={cn(errors.itemDescription && "border-destructive focus-visible:ring-destructive/20")}
 {...register("itemDescription")}
 />
 {errors.itemDescription && <p className="text-xs font-medium text-destructive">{errors.itemDescription.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="quantity">Quantity</Label>
 <Input
 id="quantity"
 min={1}
 type="number"
 className={cn(errors.quantity && "border-destructive focus-visible:ring-destructive/20")}
 {...register("quantity", { valueAsNumber: true })}
 />
 {errors.quantity && <p className="text-xs font-medium text-destructive">{errors.quantity.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="rate">Rate</Label>
 <Input
 id="rate"
 min={0}
 type="number"
 className={cn(errors.rate && "border-destructive focus-visible:ring-destructive/20")}
 {...register("rate", { valueAsNumber: true })}
 />
 {errors.rate && <p className="text-xs font-medium text-destructive">{errors.rate.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="taxRate">Tax Rate</Label>
 <Input
 id="taxRate"
 min={0}
 type="number"
 className={cn(errors.taxRate && "border-destructive focus-visible:ring-destructive/20")}
 {...register("taxRate", { valueAsNumber: true })}
 />
 {errors.taxRate && <p className="text-xs font-medium text-destructive">{errors.taxRate.message}</p>}
 </div>
 <div className="rounded-lg border bg-muted p-4">
 <p className="text-sm text-muted-foreground">Estimated Total</p>
 <p className="mt-2 text-2xl font-bold">{formatMoney(estimatedTotal)}</p>
 </div>
 </div>
 <div className="mt-6 flex justify-end gap-3">
 <Button onClick={onClose} type="button" variant="outline">
 Cancel
 </Button>
 <Button type="submit">Generate Invoice</Button>
 </div>
 </Dialog>
 );
}

function FinanceChart({ dataKey, points, title }: { dataKey: keyof Pick<FinanceChartPoint, "revenue" | "expenses" | "profit">; points: FinanceChartPoint[]; title: string }) {
 const max = Math.max(1, ...points.map((point) => point[dataKey]));
 const color = dataKey === "revenue" ? "bg-primary" : dataKey === "expenses" ? "bg-rose-500" : "bg-emerald-500";

 return (
 <Card className="glass">
 <CardHeader>
 <CardTitle>{title}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex h-52 items-end gap-2">
 {points.map((point, index) => (
 <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={point.label}>
 <motion.div
 animate={{ height: `${(point[dataKey] / max) * 100}%` }}
 className={cn("w-full rounded-t-md", color)}
 initial={{ height: "12%" }}
 transition={{ delay: index * 0.04, duration: 0.55, ease: "easeOut" }}
 />
 <span className="text-xs text-muted-foreground">{point.label}</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}

function InvoiceCard({
 invoice,
 onDownload,
 onEmail,
}: {
 invoice: InvoiceRecord;
 onDownload: () => void;
 onEmail: () => void;
}) {
 return (
 <Card className="bg-background hover:-translate-y-1 hover:border-primary/35 hover:shadow-glass">
 <CardContent className="space-y-4 p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-xs font-semibold text-primary">{invoice.invoiceNo}</p>
 <h3 className="mt-1 font-semibold">{invoice.customer}</h3>
 <p className="mt-1 text-sm text-muted-foreground">{invoice.email}</p>
 </div>
 <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{invoice.status}</span>
 </div>
 <div className="grid gap-3 text-sm sm:grid-cols-3">
 <Metric label="Total" value={formatMoney(invoice.total)} />
 <Metric label="Issue" value={invoice.issueDate} />
 <Metric label="Due" value={invoice.dueDate} />
 </div>
 <div className="rounded-lg border bg-card p-3">
 <p className="text-xs text-muted-foreground">Last Action</p>
 <p className="mt-1 text-sm font-semibold">{invoice.lastAction}</p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button onClick={onDownload} size="sm" type="button" variant="outline">
 <Download className="h-4 w-4" />
 PDF
 </Button>
 <Button onClick={onEmail} size="sm" type="button" variant="outline">
 <Mail className="h-4 w-4" />
 Email
 </Button>
 </div>
 </CardContent>
 </Card>
 );
}

function Metric({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg border bg-card p-3">
 <p className="text-xs text-muted-foreground">{label}</p>
 <p className="mt-1 truncate text-sm font-semibold">{value}</p>
 </div>
 );
}

function DataGrid({ emptyMessage, rows, title }: { emptyMessage?: string; rows: string[][]; title: string }) {
 return (
 <Card className="glass overflow-hidden">
 <CardHeader>
 <CardTitle>{title}</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {rows.length === 0 && emptyMessage && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
 {rows.map((row) => (
 <div className="grid gap-2 rounded-lg border bg-background p-4 text-sm md:grid-cols-4" key={row.join("-")}>
 {row.map((item, index) => (
 <span className={cn(index === 0 ? "font-semibold" : "text-muted-foreground")} key={`${item}-${index}`}>
 {item}
 </span>
 ))}
 </div>
 ))}
 </CardContent>
 </Card>
 );
}

const emptyStats: FinanceStats = {
 monthlyRevenue: 0,
 expenses: 0,
 profit: 0,
 outstandingPayments: 0,
 cashFlow: 0,
 chart: [],
};

export function FinancePage() {
 const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
 const [incomeRecords, setIncomeRecords] = useState<FinanceTransactionRecord[]>([]);
 const [expenseRecords, setExpenseRecords] = useState<FinanceTransactionRecord[]>([]);
 const [payments, setPayments] = useState<PaymentRecord[]>([]);
 const [taxes, setTaxes] = useState<TaxRecordEntry[]>([]);
 const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
 const [stats, setStats] = useState<FinanceStats>(emptyStats);
 const [activeModule, setActiveModule] = useState<FinanceModule>("invoices");
 const [search, setSearch] = useState("");
 const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
 const [isLoading, setIsLoading] = useState(true);
 const [notice, setNotice] = useState("Finance workspace ready.");

 useEffect(() => {
 let cancelled = false;

 async function load() {
 setIsLoading(true);
 try {
 const [statsResult, invoicesResult, incomeResult, expenseResult, paymentsResult, taxesResult, budgetsResult] = await Promise.all([
 fetchFinanceStats(),
 fetchInvoices(),
 fetchFinanceTransactions("Income"),
 fetchFinanceTransactions("Expense"),
 fetchPayments(),
 fetchTaxRecords(),
 fetchBudgets(),
 ]);
 if (cancelled) return;
 setStats(statsResult);
 setInvoices(invoicesResult);
 setIncomeRecords(incomeResult);
 setExpenseRecords(expenseResult);
 setPayments(paymentsResult);
 setTaxes(taxesResult);
 setBudgets(budgetsResult);
 } catch (error) {
 if (!cancelled) setNotice((error as Error).message);
 } finally {
 if (!cancelled) setIsLoading(false);
 }
 }

 void load();
 return () => {
 cancelled = true;
 };
 }, []);

 const filteredInvoices = useMemo(
 () =>
 invoices.filter((invoice) =>
 `${invoice.invoiceNo} ${invoice.customer} ${invoice.email} ${invoice.status}`.toLowerCase().includes(search.toLowerCase()),
 ),
 [invoices, search],
 );

 const generateInvoice = async (input: InvoiceFormInput) => {
 try {
 const invoice = await createInvoice(input);
 setInvoices((current) => [invoice, ...current]);
 const refreshedStats = await fetchFinanceStats();
 setStats(refreshedStats);
 setActiveModule("invoices");
 setIsGeneratingInvoice(false);
 setNotice(`${invoice.invoiceNo} generated for ${invoice.customer}.`);
 } catch (error) {
 setNotice((error as Error).message);
 }
 };

 const emailInvoice = async (id: string) => {
 try {
 const updated = await sendInvoice(id);
 setInvoices((current) => current.map((invoice) => ((invoice._id ?? invoice.id) === id ? updated : invoice)));
 setNotice("Invoice email queued successfully.");
 } catch (error) {
 setNotice((error as Error).message);
 }
 };

 const statCards = [
 { label: "Monthly Revenue", value: formatMoney(stats.monthlyRevenue), icon: CircleDollarSign },
 { label: "Expenses", value: formatMoney(stats.expenses), icon: TrendingDown },
 { label: "Profit", value: formatMoney(stats.profit), icon: TrendingUp },
 { label: "Outstanding Payments", value: formatMoney(stats.outstandingPayments), icon: ReceiptText },
 { label: "Cash Flow", value: formatMoney(stats.cashFlow), icon: WalletCards },
 ];

 return (
 <main className="min-h-screen bg-enterprise">
 <header className="sticky top-0 z-40 border-b bg-background ">
 <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
 <div>
 <p className="text-sm font-semibold text-primary">Finance</p>
 <h1 className="text-2xl font-bold">Finance Management</h1>
 </div>
 <div className="flex items-center gap-2">
 <Button asChild type="button" variant="outline">
 <Link to="/dashboard">Dashboard</Link>
 </Button>
 <ThemeToggle />
 <Button onClick={() => setIsGeneratingInvoice(true)} type="button">
 <Plus className="h-4 w-4" />
 Generate Invoice
 </Button>
 </div>
 </div>
 </header>

 <div className="container space-y-6 py-6">
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
 {statCards.map((card, index) => {
 const Icon = card.icon;
 return (
 <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 16 }} key={card.label} transition={{ delay: index * 0.04 }}>
 <Card className="glass h-full">
 <CardContent className="p-5">
 <Icon className="mb-4 h-5 w-5 text-primary" />
 <p className="text-sm text-muted-foreground">{card.label}</p>
 <p className="mt-2 text-2xl font-bold">{card.value}</p>
 </CardContent>
 </Card>
 </motion.div>
 );
 })}
 </div>

 <Card className="glass">
 <CardContent className="space-y-4 p-4">
 <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input className="pl-9" placeholder="Search invoices, customers, payments..." value={search} onChange={(event) => setSearch(event.target.value)} />
 </div>
 <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
 <Send className="h-4 w-4 text-primary" />
 <span>{notice}</span>
 </div>
 </div>
 <div className="flex gap-2 overflow-x-auto pb-1">
 {modules.map((module) => {
 const Icon = module.icon;
 return (
 <Button
 className="shrink-0"
 key={module.id}
 onClick={() => setActiveModule(module.id)}
 type="button"
 variant={activeModule === module.id ? "default" : "outline"}
 >
 <Icon className="h-4 w-4" />
 {module.label}
 </Button>
 );
 })}
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 xl:grid-cols-3">
 <FinanceChart dataKey="revenue" points={stats.chart} title="Revenue" />
 <FinanceChart dataKey="expenses" points={stats.chart} title="Expenses" />
 <FinanceChart dataKey="profit" points={stats.chart} title="Profit" />
 </div>

 {isLoading && <p className="text-sm text-muted-foreground">Loading finance workspace...</p>}

 {!isLoading && activeModule === "invoices" && (
 <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
 {filteredInvoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet. Generate one to get started.</p>}
 {filteredInvoices.map((invoice) => {
 const invoiceId = invoice._id ?? invoice.id ?? invoice.invoiceNo;
 return (
 <InvoiceCard
 invoice={invoice}
 key={invoiceId}
 onDownload={() => downloadInvoicePdf(invoice)}
 onEmail={() => void emailInvoice(invoiceId)}
 />
 );
 })}
 </div>
 )}
 {!isLoading && activeModule === "income" && (
 <DataGrid emptyMessage="No income recorded yet." title="Income" rows={incomeRecords.map((record) => [record.title, record.category, record.owner, `${formatMoney(record.amount)} - ${record.status}`])} />
 )}
 {!isLoading && activeModule === "expenses" && (
 <DataGrid emptyMessage="No expenses recorded yet." title="Expenses" rows={expenseRecords.map((record) => [record.title, record.category, record.owner, `${formatMoney(record.amount)} - ${record.status}`])} />
 )}
 {!isLoading && activeModule === "payments" && (
 <DataGrid emptyMessage="No payments recorded yet." title="Payments" rows={payments.map((payment) => [payment.customer, payment.invoiceNo, payment.method, `${formatMoney(payment.amount)} - ${payment.status}`])} />
 )}
 {!isLoading && activeModule === "taxes" && (
 <DataGrid emptyMessage="No tax records yet." title="Taxes" rows={taxes.map((tax) => [tax.name, tax.period, formatMoney(tax.taxableAmount), `${formatMoney(tax.taxAmount)} - ${tax.status}`])} />
 )}
 {!isLoading && activeModule === "budgets" && (
 <DataGrid
 emptyMessage="No budgets set up yet."
 title="Budgets"
 rows={budgets.map((budget) => [
 budget.department,
 budget.owner,
 `${formatMoney(budget.spent)} spent`,
 `${budget.allocated > 0 ? Math.round((budget.spent / budget.allocated) * 100) : 0}% of ${formatMoney(budget.allocated)}`,
 ])}
 />
 )}
 </div>

 {isGeneratingInvoice && <InvoiceFormModal onClose={() => setIsGeneratingInvoice(false)} onSubmit={generateInvoice} />}
 </main>
 );
}
