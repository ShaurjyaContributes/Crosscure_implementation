"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";

// ponytail: gate all children on rehydration so page auth-guards don't
// read a null user on first load and bounce a logged-in user to /login.
// Server + client first paint both render the loader (no hydration mismatch),
// then swap to content once localStorage is loaded.
export default function StoreHydration({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-crosscure-50 to-teal-50">
        <div className="w-6 h-6 border-3 border-crosscure-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
