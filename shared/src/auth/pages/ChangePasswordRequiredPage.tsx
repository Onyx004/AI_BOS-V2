import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoredAuthSession, refreshSession } from "@shared/auth/auth-service";
import { ChangePasswordCard } from "@shared/auth/components/ChangePasswordCard";
import { Card } from "@shared/ui/card";

export function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const session = getStoredAuthSession();

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Set up your account</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session ? `${session.user.fullName}, ` : ""}
            set a permanent password, a 6-digit PIN and your profile photo to continue.
          </p>
        </div>

        <Card className="p-6">
          <ChangePasswordCard
            firstLogin
            onChanged={async () => {
              await refreshSession();
              navigate("/dashboard", { replace: true });
            }}
          />
        </Card>
      </div>
    </main>
  );
}
