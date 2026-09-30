import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { FieldError } from "react-hook-form";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { cn } from "@shared/lib/utils";

type AuthFormFieldProps = {
 error?: FieldError;
 label: string;
 registration: React.ComponentProps<typeof Input>;
 type?: "email" | "password" | "text";
 placeholder?: string;
 autoComplete?: string;
 inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
 maxLength?: number;
};

export function AuthFormField({
 error,
 label,
 registration,
 type = "text",
 placeholder,
 autoComplete,
 inputMode,
 maxLength,
}: AuthFormFieldProps) {
 const [showPassword, setShowPassword] = useState(false);
 const isPassword = type === "password";
 const errorId = registration.id ? `${registration.id}-error` : undefined;

 return (
 <div className="space-y-2">
 <Label htmlFor={registration.id}>{label}</Label>
 <div className="relative">
 <Input
 {...registration}
 aria-describedby={error ? errorId : undefined}
 aria-invalid={Boolean(error)}
 autoComplete={autoComplete}
 className={cn(isPassword && "pr-11", error && "border-destructive focus-visible:ring-destructive/20")}
 inputMode={inputMode}
 maxLength={maxLength}
 placeholder={placeholder}
 type={isPassword && showPassword ? "text" : type}
 />
 {isPassword && (
 <Button
 aria-label={showPassword ? "Hide password" : "Show password"}
 className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
 onClick={() => setShowPassword((value) => !value)}
 size="icon"
 type="button"
 variant="ghost"
 >
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </Button>
 )}
 </div>
 {error && (
 <p className="text-xs font-medium text-destructive" id={errorId} role="alert">
 {error.message}
 </p>
 )}
 </div>
 );
}
