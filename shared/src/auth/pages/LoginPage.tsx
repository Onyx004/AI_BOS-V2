import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import {
 clearAuthSession,
 clearRememberedEmail,
 getRememberedEmail,
 getRememberedLoginMethod,
 login,
 setRememberedEmail,
 setRememberedLoginMethod,
} from "@shared/auth/auth-service";

import { AuthFormField } from "@shared/auth/components/AuthFormField";
import { AuthLayout } from "@shared/auth/components/AuthLayout";
import { loginSchema, type LoginFormValues } from "@shared/auth/schemas";
import type { AuthRole } from "@shared/auth/types";
import { Button } from "@shared/ui/button";

type LoginPageProps = {
 redirectTo?: string;
 eyebrow?: string;
 title?: string;
 subtitle?: string;
 /** Purely informational — tells the visitor who this portal is for. Not a picker; role always comes from the account. */
 intendedFor?: readonly AuthRole[];
  allowedRoles?: readonly AuthRole[];
  secondaryAction?: ReactNode;
};

export function LoginPage({
 redirectTo = "/dashboard",
 eyebrow = "Login",
 title = "Welcome back",
 subtitle = "Access your business command center.",
 intendedFor,
 allowedRoles = intendedFor,
 secondaryAction,
}: LoginPageProps) {
 const [loginError, setLoginError] = useState("");
 const [loginMethod, setLoginMethod] = useState<"password" | "pin">(getRememberedLoginMethod);
 const navigate = useNavigate();
 const rememberedEmail = getRememberedEmail();
 const {
 formState: { errors, isSubmitting },
 handleSubmit,
 register,
 resetField,
 setError,
 } = useForm<LoginFormValues>({
 resolver: zodResolver(loginSchema),
 defaultValues: {
 email: rememberedEmail ?? "",
 password: "",
 rememberMe: rememberedEmail !== null,
 },
 });

 const onSubmit: SubmitHandler<LoginFormValues> = async (values) => {
 setLoginError("");
 if (loginMethod === "pin" && !/^\d{6}$/.test(values.password)) {
 setError("password", { message: "PIN must be exactly 6 digits" });
 return;
 }
 try {
 // "Remember me" here only ever controls the email prefill below — it must
 // never cause the session/tokens to persist in localStorage across an app
 // restart, so the session-persistence flag is always false.
 const session = await login(values.email, values.password, false, loginMethod);
 if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
 clearAuthSession();
 setLoginError(`This ${session.user.role} account is not allowed on this login page.`);
 return;
 }
 setRememberedLoginMethod(loginMethod);
 if (values.rememberMe) {
 setRememberedEmail(values.email);
 } else {
 clearRememberedEmail();
 }
 navigate(redirectTo);
 } catch (error) {
 setLoginError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
 }
 };

 return (
 <AuthLayout eyebrow={eyebrow} subtitle={subtitle} title={title}>
 {loginError && (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="mb-5 flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
 initial={{ opacity: 0, y: -8 }}
 role="alert"
 >
 <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
 <span>{loginError}</span>
 </motion.div>
 )}

 <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
 <AuthFormField
 autoComplete="email"
 error={errors.email}
 label="Email"
 placeholder="you@company.com"
 registration={{ id: "email", ...register("email") }}
 type="email"
 />

 <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm font-semibold">
 {(["password", "pin"] as const).map((method) => (
 <button
 className={loginMethod === method ? "rounded bg-background px-3 py-1.5 shadow-sm" : "rounded px-3 py-1.5 text-muted-foreground"}
 key={method}
 onClick={() => {
 setLoginMethod(method);
 setLoginError("");
 resetField("password");
 }}
 type="button"
 >
 {method === "password" ? "Password" : "6-digit PIN"}
 </button>
 ))}
 </div>

 <AuthFormField
 autoComplete={loginMethod === "pin" ? "off" : "current-password"}
 error={errors.password}
 inputMode={loginMethod === "pin" ? "numeric" : undefined}
 label={loginMethod === "pin" ? "PIN" : "Password"}
 maxLength={loginMethod === "pin" ? 6 : undefined}
 placeholder={loginMethod === "pin" ? "Enter your 6-digit PIN" : "Enter your password"}
 registration={{ id: "password", ...register("password") }}
 type="password"
 />

 <div className="flex items-center justify-between gap-4">
 <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
 <input
 className="h-4 w-4 rounded border-input accent-primary"
 type="checkbox"
 {...register("rememberMe")}
 />
 Remember me
 </label>
 <Link className="text-sm font-semibold text-primary hover:underline" to="/forgot-password">
 Forgot password?
 </Link>
 </div>

 <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
 {isSubmitting ? "Signing in..." : "Login"}
 <ArrowRight className="h-4 w-4" />
 </Button>
 </form>
 {secondaryAction}
 </AuthLayout>
 );
}
