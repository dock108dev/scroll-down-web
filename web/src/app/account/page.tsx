"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/stores/session";
import { AccountContent } from "@/components/account/AccountContent";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

export default function AccountPage() {
  const { status, email } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?redirect=/account");
    }
  }, [status, router]);

  if (status === "loading" || status === "anonymous") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
        <LoadingSkeleton count={4} variant="timelineRow" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6" data-testid="account-page">
      <h1 className="text-xl font-bold text-neutral-100">Account</h1>
      <AccountContent email={email} />
    </div>
  );
}
