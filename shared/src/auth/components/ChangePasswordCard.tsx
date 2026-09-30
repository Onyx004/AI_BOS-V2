import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { changePassword, updateStoredSessionUser } from "@shared/auth/auth-service";
import { updateOwnProfile } from "@shared/profile/own-profile.api";
import { Button } from "@shared/ui/button";
import { Label } from "@shared/ui/label";
import { PasswordInput } from "@shared/ui/password-input";
import { useToast } from "@shared/ui/toast-context";

const changePasswordFormSchema = z
 .object({
 currentPassword: z.string().min(1, "Enter your current password"),
 newPassword: z
 .string()
 .min(12, "Password must be at least 12 characters")
 .regex(/[A-Z]/, "Password needs one uppercase letter")
 .regex(/[a-z]/, "Password needs one lowercase letter")
 .regex(/[0-9]/, "Password needs one number")
 .regex(/[^A-Za-z0-9]/, "Password needs one special character"),
 confirmPassword: z.string().min(1, "Confirm your new password"),
 pin: z.string().optional(),
 confirmPin: z.string().optional(),
 })
 .refine((data) => data.newPassword === data.confirmPassword, {
 message: "Passwords do not match",
 path: ["confirmPassword"],
 });

type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

/** `firstLogin` adds the one-time account setup on top of the password change: a 6-digit sign-in PIN and a profile photo. */
export function ChangePasswordCard({ onChanged, firstLogin = false }: { onChanged?: () => void | Promise<void>; firstLogin?: boolean }) {
 const { toast } = useToast();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
 const [avatarError, setAvatarError] = useState<string | null>(null);
 const {
 formState: { errors, isSubmitting },
 handleSubmit,
 register,
 reset,
 setError,
 } = useForm<ChangePasswordFormValues>({
 resolver: zodResolver(changePasswordFormSchema),
 defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "", pin: "", confirmPin: "" },
 });

 const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 event.target.value = "";
 if (!file) return;
 setAvatarError(null);
 if (!file.type.startsWith("image/")) {
 setAvatarError("Please choose an image file.");
 return;
 }
 if (file.size > 2_000_000) {
 setAvatarError("Photo is too large. Please choose an image under 2MB.");
 return;
 }
 const reader = new FileReader();
 reader.onload = () => setAvatarPreview(String(reader.result));
 reader.onerror = () => setAvatarError("Could not read that image. Please try another.");
 reader.readAsDataURL(file);
 };

 const onSubmit: SubmitHandler<ChangePasswordFormValues> = async (values) => {
 if (firstLogin) {
 if (!/^\d{6}$/.test(values.pin ?? "")) {
 setError("pin", { message: "PIN must be exactly 6 digits" }, { shouldFocus: true });
 return;
 }
 if (values.pin !== values.confirmPin) {
 setError("confirmPin", { message: "PINs do not match" }, { shouldFocus: true });
 return;
 }
 }
 try {
 await changePassword(values.currentPassword, values.newPassword, firstLogin ? values.pin : undefined);
 if (firstLogin && avatarPreview) {
 try {
 const updated = await updateOwnProfile({ avatar: avatarPreview });
 updateStoredSessionUser({ avatar: updated.avatar?.startsWith("data:image/") ? updated.avatar : undefined });
 } catch (error) {
 toast({ title: "Photo not saved", description: `${(error as Error).message} You can add it later from your profile.`, type: "error" });
 }
 }
 toast({ title: "Password changed", description: "Use your new password next time you sign in.", type: "success" });
 reset();
 await onChanged?.();
 } catch (error) {
 const message = (error as Error).message;
 if (message.toLowerCase().includes("current password")) {
 setError("currentPassword", { message }, { shouldFocus: true });
 return;
 }
 toast({ title: "Could not change password", description: message, type: "error" });
 }
 };

 return (
 <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
 <div className="space-y-2">
 <Label htmlFor="currentPassword">{firstLogin ? "Temporary password" : "Current password"}</Label>
 <PasswordInput id="currentPassword" {...register("currentPassword")} />
 {errors.currentPassword && <p className="text-xs font-medium text-destructive">{errors.currentPassword.message}</p>}
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="newPassword">New password</Label>
 <PasswordInput id="newPassword" {...register("newPassword")} />
 {errors.newPassword && <p className="text-xs font-medium text-destructive">{errors.newPassword.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirmPassword">Confirm new password</Label>
 <PasswordInput id="confirmPassword" {...register("confirmPassword")} />
 {errors.confirmPassword && <p className="text-xs font-medium text-destructive">{errors.confirmPassword.message}</p>}
 </div>
 </div>

 {firstLogin && (
 <>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="pin">6-digit PIN</Label>
 <PasswordInput autoComplete="off" id="pin" inputMode="numeric" maxLength={6} {...register("pin")} />
 {errors.pin && <p className="text-xs font-medium text-destructive">{errors.pin.message}</p>}
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirmPin">Confirm PIN</Label>
 <PasswordInput autoComplete="off" id="confirmPin" inputMode="numeric" maxLength={6} {...register("confirmPin")} />
 {errors.confirmPin && <p className="text-xs font-medium text-destructive">{errors.confirmPin.message}</p>}
 </div>
 </div>
 <div className="space-y-2">
 <Label>Profile photo</Label>
 <div className="flex items-center gap-4">
 <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
 {avatarPreview ? <img alt="Profile preview" className="h-full w-full object-cover" src={avatarPreview} /> : <Camera className="h-5 w-5" />}
 </span>
 <input accept="image/*" className="hidden" onChange={handleAvatarChange} ref={fileInputRef} type="file" />
 <Button onClick={() => fileInputRef.current?.click()} type="button" variant="outline">
 {avatarPreview ? "Change photo" : "Upload photo"}
 </Button>
 </div>
 {avatarError && <p className="text-xs font-medium text-destructive">{avatarError}</p>}
 </div>
 </>
 )}

 <Button disabled={isSubmitting} type="submit">
 {isSubmitting ? "Saving..." : firstLogin ? "Save and continue" : "Change password"}
 </Button>
 </form>
 );
}
