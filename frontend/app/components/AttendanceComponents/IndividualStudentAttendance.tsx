"use client";

import React, { useState, useEffect } from "react";
import { XCircle, Loader2, User, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";
import { API_PATH } from "@/app/lib/path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    studentId: number | null;
    studentName?: string;
    studentPhoto?: string | null;
    selectedClassId?: number | null;
}

interface DayAttendance {
    date: string;           // "YYYY-MM-DD"
    status: "P" | "A" | "H" | null; // Present / Absent / Holiday / no school
    subject?: string | null;
}

interface WeeklyAttendanceSummary {
    student_id: number;
    student_name: string;
    admission_number: string;
    photo_url: string | null;
    week_start: string;
    week_end: string;
    days: DayAttendance[];
    present_count: number;
    absent_count: number;
    total_school_days: number;
    attendance_percentage: number;
}


const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

/** Returns Monday–Friday of the week containing `date` */
const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun … 6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
        start: toLocalDateStr(monday),
        end: toLocalDateStr(friday),
    };
};


const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

const formatDayLabel = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentWeeklyAttendance({
    isOpen,
    onClose,
    studentId,
    studentName,
    studentPhoto,
    selectedClassId,
}: PageProps) {
    const [summary, setSummary] = useState<WeeklyAttendanceSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week …

    // Derive the displayed week from the offset
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const { start: weekStart, end: weekEnd } = getWeekRange(targetDate);

    useEffect(() => {
        if (!isOpen || !studentId) {
            setSummary(null);
            setError(null);
            return;
        }

        const fetchWeeklyAttendance = async () => {
            setLoading(true);
            setError(null);

            try {
                const url =
                    `${API_PATH}/api/students/${studentId}/attendance/` +
                    `?start_date=${weekStart}&end_date=${weekEnd}` +
                    (selectedClassId ? `&class_id=${selectedClassId}` : "");

                const res = await fetch(url, { credentials: "include" });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `HTTP ${res.status}`);
                }

                const data = await res.json();

                if (data.success) {
                    // The backend returns data.data which contains student + records
                    // We normalise it into WeeklyAttendanceSummary below
                    const raw = data.data;

                    // Build a lookup: date → status from the records array
                    const recordMap: Record<string, "P" | "A"> = {};
                    (raw.records || []).forEach(
                        (r: { date: string; status: "P" | "A"; subject?: string }) => {
                            recordMap[r.date] = r.status;
                        }
                    );

                    // Build Mon–Fri day entries
                    const days: DayAttendance[] = [];
                    for (let i = 0; i < 5; i++) {
                        const d = new Date(weekStart + "T00:00:00");
                        d.setDate(d.getDate() + i);
                        const dateStr = toLocalDateStr(d);
                        days.push({
                            date: dateStr,
                            status: recordMap[dateStr] ?? null,
                        });
                    }

                    const presentCount = days.filter((d) => d.status === "P").length;
                    const schoolDays = days.filter((d) => d.status !== null).length;

                    setSummary({
                        student_id: raw.student?.id ?? studentId,
                        student_name: raw.student?.name ?? studentName ?? "Student",
                        admission_number: raw.student?.admission_number ?? "",
                        photo_url: raw.student?.photo_url ?? studentPhoto ?? null,
                        week_start: weekStart,
                        week_end: weekEnd,
                        days,
                        present_count: presentCount,
                        absent_count: schoolDays - presentCount,
                        total_school_days: schoolDays,
                        attendance_percentage:
                            schoolDays > 0
                                ? Math.round((presentCount / schoolDays) * 100)
                                : 0,
                    });
                } else {
                    setError(data.error || "Failed to load attendance data");
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Could not load weekly attendance"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchWeeklyAttendance();
    }, [isOpen, studentId, weekStart, weekEnd, selectedClassId, studentName, studentPhoto]);

    if (!isOpen) return null;

    // ── Status pill helper ──
    const StatusBadge = ({ status }: { status: DayAttendance["status"] }) => {
        if (status === "P")
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    ✓ Present
                </span>
            );
        if (status === "A")
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                    ✗ Absent
                </span>
            );
        if (status === "H")
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                    Holiday
                </span>
            );
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-400 text-xs font-medium">
                — No record
            </span>
        );
    };

    // ── Trend icon ──
    const TrendIcon = ({ pct }: { pct: number }) => {
        if (pct >= 80) return <TrendingUp size={16} className="text-green-500" />;
        if (pct >= 50) return <Minus size={16} className="text-yellow-500" />;
        return <TrendingDown size={16} className="text-red-500" />;
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                            Weekly Attendance
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {formatDate(weekStart)} – {formatDate(weekEnd)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <XCircle size={24} className="text-gray-500 hover:text-gray-700" />
                    </button>
                </div>

                {/* ── Week navigation ── */}
                <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b border-blue-100">
                    <button
                        onClick={() => setWeekOffset((w) => w - 1)}
                        className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                    >
                        ← Previous week
                    </button>
                    <span className="text-sm font-semibold text-blue-700">
                        {weekOffset === 0
                            ? "This week"
                            : weekOffset === -1
                            ? "Last week"
                            : `${Math.abs(weekOffset)} weeks ago`}
                    </span>
                    <button
                        onClick={() => setWeekOffset((w) => Math.min(w + 1, 0))}
                        disabled={weekOffset === 0}
                        className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next week →
                    </button>
                </div>

                {/* ── Content ── */}
                <div className="p-6 overflow-y-auto flex-1">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-gray-500">Loading attendance data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-red-600">
                            <XCircle size={48} className="mb-4" />
                            <p className="text-lg font-medium text-center">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    ) : summary ? (
                        <>
                            {/* Student card */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                                {summary.photo_url ? (
                                    <Image
                                        src={summary.photo_url}
                                        alt={summary.student_name}
                                        width={52}
                                        height={52}
                                        className="rounded-full aspect-square object-cover border-2 border-white shadow"
                                    />
                                ) : (
                                    <div className="w-13 h-13 rounded-full bg-blue-100 flex items-center justify-center shrink-0 w-[52px] h-[52px]">
                                        <User size={26} className="text-blue-500" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 text-base truncate">
                                        {summary.student_name}
                                    </p>
                                    {summary.admission_number && (
                                        <p className="text-xs text-gray-500 font-mono">
                                            #{summary.admission_number}
                                        </p>
                                    )}
                                </div>

                                {/* Mini stats */}
                                <div className="ml-auto flex gap-3 shrink-0">
                                    <div className="flex flex-col items-center bg-green-50 border border-green-100 rounded-xl px-4 py-2">
                                        <span className="text-2xl font-black text-green-600">
                                            {summary.present_count}
                                        </span>
                                        <span className="text-[9px] font-bold text-green-500 uppercase">
                                            Present
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                                        <span className="text-2xl font-black text-red-500">
                                            {summary.absent_count}
                                        </span>
                                        <span className="text-[9px] font-bold text-red-400 uppercase">
                                            Absent
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                                        <div className="flex items-center gap-1">
                                            <span
                                                className={`text-2xl font-black ${
                                                    summary.attendance_percentage >= 80
                                                        ? "text-green-600"
                                                        : summary.attendance_percentage >= 50
                                                        ? "text-yellow-600"
                                                        : "text-red-600"
                                                }`}
                                            >
                                                {summary.attendance_percentage}%
                                            </span>
                                            <TrendIcon pct={summary.attendance_percentage} />
                                        </div>
                                        <span className="text-[9px] font-bold text-blue-400 uppercase">
                                            Rate
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Day-by-day table */}
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-blue-50 text-left">
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                Day
                                            </th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.days.map((day, idx) => {
                                            const isToday =
                                                day.date ===
                                                toLocalDateStr(new Date());
                                            return (
                                                <tr
                                                    key={day.date}
                                                    className={`border-t border-gray-100 transition-colors ${
                                                        isToday
                                                            ? "bg-blue-50/60"
                                                            : idx % 2 === 0
                                                            ? "bg-white"
                                                            : "bg-gray-50/40"
                                                    }`}
                                                >
                                                    <td className="px-4 py-3 font-semibold text-gray-700">
                                                        {
                                                            ["Monday","Tuesday","Wednesday","Thursday","Friday"][idx]
                                                        }
                                                        {isToday && (
                                                            <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                                                Today
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                                        {formatDayLabel(day.date)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <StatusBadge status={day.status} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {summary.total_school_days === 0 && (
                                <p className="text-center text-gray-400 text-sm mt-4">
                                    No attendance has been recorded for this week yet.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <p>Select a student to view their weekly attendance.</p>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}