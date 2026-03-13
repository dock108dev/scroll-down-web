"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function Redirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    router.replace(token ? `/reset-password?token=${token}` : "/reset-password");
  }, [token, router]);

  return null;
}

export default function AuthResetPasswordPage() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  );
}
