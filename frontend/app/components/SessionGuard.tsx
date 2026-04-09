"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SessionGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const sessionActive = sessionStorage.getItem("session_active");

        if (!sessionActive) {
            // Tab was closed and reopened — wipe everything
            document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax";
            localStorage.removeItem("role");
            router.replace("/auth/login");
        }
    }, [router]);

    return <>{children}</>;
}