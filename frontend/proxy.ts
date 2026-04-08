// app/proxy.ts
import { redirect } from "next/navigation";

const roleRoutes: Record<string, string[]> = {
  admin: ["/dashboard", "/attendance", "/reports", "/students"],
  teacher: ["/dashboard", "/attendance", "/students"],
};

export default function proxy(request: Request) {
  // Parse cookies manually (Edge runtime)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [k, v] = c.split("=");
      return [k, v];
    })
  );

  const sessionid = cookies["sessionid"];
  const userRole = cookies["user_role"];

  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. Public / static passthrough
  if (pathname.startsWith("/auth") || pathname === "/unauthorized" || pathname.startsWith("/_next")) {
    return; // allow
  }

  // 2. Root redirect
  if (pathname === "/") {
    if (sessionid) {
      throw redirect("/dashboard");
    } else {
      throw redirect("/auth/login");
    }
  }

  // 3. Auth guard
  if (!sessionid) {
    throw redirect("/auth/login");
  }

  // 4. RBAC
  const allowed = roleRoutes[userRole ?? ""] || [];
  if (!allowed.some((route) => pathname.startsWith(route))) {
    throw redirect("/unauthorized");
  }

  // 5. allow access
  return;
}

// No matcher needed; Proxy runs automatically for all routes