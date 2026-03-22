"use client";

import React, { useState, useEffect } from "react";
import { XCircle, Loader2 } from "lucide-react";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
    getKeyValue
} from "@heroui/table";
import { API_PATH } from "@/app/lib/path";

interface PageProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    selectedClassId?: number | null;
}

interface AttendanceRecord {
    date: string;
    present: number;
    absent: number;
    total: number;
    percentage: number;
}

export default function PreviousAttendanceRecords({
    isOpen,
    onClose,
    selectedClassId
}: PageProps) {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !selectedClassId) {
            setRecords([]);
            setError(null);
            return;
        }

        const fetchRecords = async () => {
            setLoading(true);
            setError(null);

            try {
                const url = `${API_PATH}/api/attendance/previous/?class_id=${selectedClassId}&limit=10`;
                const res = await fetch(url, { credentials: "include" });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                if (data.success) {
                    setRecords(data.data || []);
                } else {
                    setError(data.error || "Failed to load previous records");
                }
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [isOpen, selectedClassId]);

    const columns = [
        { key: "date", label: "DATE" },
        { key: "present", label: "PRESENT" },
        { key: "absent", label: "ABSENT" },
        { key: "total", label: "TOTAL" },
        { key: "percentage", label: "PERCENTAGE" },
    ];

    // Format date nicely (e.g., "7 March 2026")
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                            Previous Attendance Records
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Last 10 submissions for selected class
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <XCircle size={24} className="text-gray-500 hover:text-gray-700" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-gray-600">Loading previous records...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-red-600">
                            <XCircle size={48} className="mb-4" />
                            <p className="text-lg font-medium">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <p className="text-lg">No previous attendance records found.</p>
                            <p className="mt-2">Attendance may not have been taken yet for this class.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table aria-label="Previous attendance records">
                                <TableHeader columns={columns}>
                                    {(col) => (
                                        <TableColumn
                                            key={col.key}
                                            className="bg-gray-100 text-xs lg:text-sm font-semibold uppercase tracking-wider py-3 px-4"
                                        >
                                            {col.label}
                                        </TableColumn>
                                    )}
                                </TableHeader>

                                <TableBody items={records}>
                                    {(item) => (
                                        <TableRow
                                            key={item.date}
                                            className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                                        >
                                            {(columnKey) => (
                                                <TableCell className="py-3 px-4 text-sm text-gray-800">
                                                    {columnKey === "date" ? (
                                                        formatDate(item.date)
                                                    ) : columnKey === "percentage" ? (
                                                        <span
                                                            className={`font-medium ${
                                                                item.percentage >= 90
                                                                    ? "text-green-600"
                                                                    : item.percentage >= 75
                                                                    ? "text-yellow-600"
                                                                    : "text-red-600"
                                                            }`}
                                                        >
                                                            {item.percentage}%
                                                        </span>
                                                    ) : (
                                                        getKeyValue(item, columnKey)
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* Footer */}
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