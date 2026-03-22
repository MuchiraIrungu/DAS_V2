"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard, BookOpenCheck, Users, FileChartColumn, Settings, Menu, X, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

const adminItems = [
    { index: 1, icon: LayoutDashboard, name: 'Dashboard', href: '/dashboard' },
    { index: 2, icon: BookOpenCheck, name: 'Attendance', href: '/attendance' },
    { index: 3, icon: Users, name: 'Students', href: '/students' },
    { index: 4, icon: FileChartColumn, name: 'Reports', href: '/reports' },
    { index: 5, icon: Settings, name: 'Settings', href: '/settings' },
];

const teacherItems = [
    { index: 1, icon: BookOpenCheck, name: 'Attendance', href: '/attendance' },
    { index: 2, icon: Users, name: 'Students', href: '/students' },
    { index: 3, icon: Settings, name: 'Settings', href: '/settings' },
];

export default function Sidebar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null;
    const isAdmin = role === "Admin" || role === "admin";
    const SidebarItems = isAdmin ? adminItems : teacherItems;

    const handleLogout = async () => {
        const getCookie = (name: string): string => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
            return '';
        };

        const res = await fetch('http://localhost:8000/api/auth/logout/', {
            method: 'POST',
            credentials: "include",
            headers: {
                "Content-Type": 'application/json',
                "X-CSRFToken": getCookie('csrftoken'),
            },
        });

        if (res.status === 200) {
            localStorage.removeItem("role");
            router.push('/auth/login');
        }
    };

    return (
        <>
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
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
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
                                    <Link
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`flex flex-row gap-2 items-center h-[5vh] min-h-10 w-full pl-2 rounded-xl text-sm lg:text-base transition-colors
                                            ${isActive
                                                ? 'text-green-800 bg-green-100 font-medium'
                                                : 'hover:text-green-800 hover:bg-green-50'
                                            }`}
                                    >
                                        <Icon size={18} className="shrink-0" />
                                        {item.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={() => {
                            setMobileOpen(false);
                            handleLogout();
                        }}
                        className="flex flex-row gap-2 items-center w-full pl-2 h-[5vh] min-h-10 rounded-xl text-sm lg:text-base text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors font-lexend"
                    >
                        <LogOut size={18} className="shrink-0" />
                        Logout
                    </button>
                </div>
            </section>
        </>
    );
}