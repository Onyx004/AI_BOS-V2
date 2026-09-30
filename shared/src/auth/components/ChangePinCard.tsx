import { useState, type FormEvent } from "react";
import { changePin } from "@shared/auth/auth-service";
import { Button } from "@shared/ui/button";
import { Label } from "@shared/ui/label";
import { PasswordInput } from "@shared/ui/password-input";
import { useToast } from "@shared/ui/toast-context";

/** Set or change the 6-digit sign-in PIN; confirmed with the account password. */
export function ChangePinCard() {
 const { toast } = useToast();
 const [currentPassword, setCurrentPassword] = useState("");
 const [pin, setPin] = useState("");
 const [confirmPin, setConfirmPin] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);

 const onSubmit = async (event: FormEvent) => {
 event.preventDefault();
 setError(null);
 if (!currentPassword) return setError("Enter your current password");
 if (!/^\d{6}$/.test(pin)) return setError("PIN must be exactly 6 digits");
 if (pin !== confirmPin) return setError("PINs do not match");
 setSaving(true);
 try {
 await changePin(currentPassword, pin);
 toast({ title: "PIN saved", description: "You can now sign in with your 6-digit PIN.", type: "success" });
 setCurrentPassword("");
 setPin("");
 setConfirmPin("");
 } catch (err) {
 setError((err as Error).message);
 } finally {
 setSaving(false);
 }
 };

 return (
 <form className="space-y-4" onSubmit={onSubmit}>
 <div className="space-y-2">
 <Label htmlFor="pinCurrentPassword">Current password</Label>
 <PasswordInput id="pinCurrentPassword" onChange={(event) => setCurrentPassword(event.target.value)} value={currentPassword} />
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="newPin">New 6-digit PIN</Label>
 <PasswordInput autoComplete="off" id="newPin" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value)} value={pin} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirmNewPin">Confirm PIN</Label>
 <PasswordInput autoComplete="off" id="confirmNewPin" inputMode="numeric" maxLength={6} onChange={(event) => setConfirmPin(event.target.value)} value={confirmPin} />
 </div>
 </div>
 {error && <p className="text-xs font-medium text-destructive">{error}</p>}
 <Button disabled={saving} type="submit">
 {saving ? "Saving..." : "Save PIN"}
 </Button>
 </form>
 );
}
