"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    LayoutDashboard,
    BookOpenCheck,
    Users,
    FileChartColumn,
    Settings,
    Menu,
    X,
    LogOut,
    Shield,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { API_PATH } from "../lib/path";

const adminItems = [
    { index: 1, icon: LayoutDashboard, name: "Dashboard", href: "/dashboard" },
    { index: 2, icon: BookOpenCheck, name: "Attendance", href: "/attendance" },
    { index: 3, icon: Users, name: "Students", href: "/students" },
    { index: 4, icon: FileChartColumn, name: "Reports", href: "/reports" },
    { index: 5, icon: Settings, name: "Settings", href: "/settings" },
    { index: 6, icon: Shield, name: "Django Admin", href: `${API_PATH}/admin/` },
];

const teacherItems = [
    { index: 1, icon: BookOpenCheck, name: "Attendance", href: "/attendance" },
    { index: 2, icon: Users, name: "Students", href: "/students" },
    { index: 3, icon: Settings, name: "Settings", href: "/settings" },
];

function LogoutOverlay() {
    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{
                backgroundColor: "#d4e3f3",
            }}
        >
            {/* Animated logo area */}
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <Image
                        src="/logo2.jpg"
                        alt="logo"
                        width={90}
                        height={90}
                        className="rounded-2xl object-cover"
                        priority
                    />
                    {/* Pulse ring around logo */}
                    <span
                        className="absolute inset-0 rounded-2xl animate-ping"
                        style={{
                            backgroundColor: "rgba(30, 136, 229, 0.18)",
                            animationDuration: "1.2s",
                        }}
                    />
                </div>

                {/* Spinner */}
                <div className="relative w-12 h-12">
                    <svg
                        className="animate-spin w-12 h-12"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 48 48"
                    >
                        <circle
                            cx="24" cy="24" r="20"
                            stroke="#b7d9f5"
                            strokeWidth="4"
                            fill="none"
                        />
                        <path
                            d="M44 24a20 20 0 00-20-20"
                            stroke="#1e88e5"
                            strokeWidth="4"
                            strokeLinecap="round"
                            fill="none"
                        />
                    </svg>
                </div>

                <div className="text-center font-lexend">
                    <p className="text-[#1e3a5f] font-semibold text-base tracking-wide">
                        Signing you out...
                    </p>
                    <p className="text-[#5a7fa8] text-sm mt-1">
                        See you next time
                    </p>
                </div>

                {/* Animated dots */}
                <div className="flex gap-2 mt-1">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-[#1e88e5] animate-bounce"
                            style={{ animationDelay: `${i * 0.18}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Sidebar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null;
    const isAdmin = role === "Admin" || role === "admin";
    const SidebarItems = isAdmin ? adminItems : teacherItems;

    const handleLogout = async () => {
        setMobileOpen(false);
        setLoggingOut(true);

        try {
            const csrfRes = await fetch(`${API_PATH}/api/auth/csrf/`, {
                credentials: "include",
            });
            const { csrfToken } = await csrfRes.json();

            const res = await fetch(`${API_PATH}/api/auth/logout/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
            });

            if (res.status === 200) {
                localStorage.removeItem("role");
                // Small delay so the animation feels intentional
                await new Promise((resolve) => setTimeout(resolve, 800));
                router.push("/auth/login");
            } else {
                setLoggingOut(false);
            }
        } catch {
            setLoggingOut(false);
        }
    };

    return (
        <>
            {/* Full-screen logout overlay */}
            {loggingOut && <LogoutOverlay />}

            {/* Mobile menu toggle */}
            <button
                className="lg:hidden fixed top-3 left-3 z-50 bg-white shadow-md rounded-lg p-2 text-gray-700"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Toggle sidebar"
            >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-30 bg-black/30"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <section
                className={`
                    text-black bg-white h-screen p-5 flex flex-col
                    fixed top-0 left-0 z-40 transition-transform duration-300 ease-in-out
                    w-55
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:translate-x-0 lg:static lg:z-auto lg:w-[15%] lg:min-w-10 lg:max-w-55
                    sidebar
                `}
            >
                <Image
                    className="bg-white mb-2 lg:mb-2 mt-6 lg:mt-0 mx-auto rounded-2xl object-cover shrink-0"
                    src="/logo2.jpg"
                    alt="logo"
                    width={130}
                    height={60}
                    priority
                />

                <nav className="text-gray-700 flex flex-col font-lexend mt-4 lg:mt-8 flex-1">
                    <ul className="flex flex-col gap-5 lg:gap-8">
                        {SidebarItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.index}>
                                    {item.href.startsWith("http") ? (
                                        <a
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setMobileOpen(false)}
                                            className={`flex flex-row gap-2 items-center h-[5vh] min-h-10 w-full pl-2 rounded-xl text-sm lg:text-base transition-colors
                                                ${isActive
                                                    ? "text-green-800 bg-green-100 font-medium"
                                                    : "hover:text-green-800 hover:bg-green-50"
                                                }`}
                                        >
                                            <Icon size={18} className="shrink-0" />
                                            {item.name}
                                        </a>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            onClick={() => setMobileOpen(false)}
                                            className={`flex flex-row gap-2 items-center h-[5vh] min-h-10 w-full pl-2 rounded-xl text-sm lg:text-base transition-colors
                                                ${isActive
                                                    ? "text-green-800 bg-green-100 font-medium"
                                                    : "hover:text-green-800 hover:bg-green-50"
                                                }`}
                                        >
                                            <Icon size={18} className="shrink-0" />
                                            {item.name}
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex flex-row gap-2 items-center w-full pl-2 h-[5vh] min-h-10 rounded-xl text-sm lg:text-base text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors font-lexend disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <LogOut size={18} className="shrink-0" />
                        {loggingOut ? "Signing out..." : "Logout"}
                    </button>
                </div>
            </section>
        </>
    );
}