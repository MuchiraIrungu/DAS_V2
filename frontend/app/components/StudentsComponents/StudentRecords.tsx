"use client";

import React, { useEffect,useState } from "react";
import Image from "next/image";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    getKeyValue,
} from "@heroui/react";
import { Pencil, Trash2 } from "lucide-react";

type HeroKey = string | number;

interface Student {
    index: number;
    id: number;
    name: string;
    email: string;
    photo: string;
    studentId: string;
    grade: string;
    status: "active" | "inactive" | "on_leave";
    parentContact: string;
    parentName: string;
    raw: APIStudent;
}

interface APIStudent {
    id: number;
    admission_number: string;
    full_name: string;
    first_name: string;
    last_name: string;
    email: string | null;
    photo: string | null;
    status: "active" | "inactive" | "on_leave";
    current_class: { id: number; name: string } | null;
    age: number;
    parent_name: string;
    parent_phone: string;
}

interface StudentRecordsProps {
    onEdit?: (student: APIStudent) => void;
    onDelete?: (studentId: number) => void;
    deleteConfirmId?: number | null;
    refetchKey?: number;
    search?:string;
    statusFilter?: string;
    gradeFilter?:string;
}

export default function StudentRecords({ onEdit, onDelete, deleteConfirmId, refetchKey, search, gradeFilter, statusFilter }: StudentRecordsProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [allRows, setAllRows] = useState<Student[]>([]);

    const PAGE_SIZE = 6;
    const TOTAL_PAGES = Math.ceil(allRows.length / PAGE_SIZE);
    const paginatedRows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
    const endRecord = Math.min(currentPage * PAGE_SIZE, allRows.length);

    useEffect(() => {
        const fetchUserData = async () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
            if (gradeFilter && gradeFilter !== 'all') params.append('grade', gradeFilter);

            const res = await fetch(`http://localhost:8000/api/students/?${params.toString()}`, {
                method: "GET",
                credentials: "include",
            });

            const data = await res.json();
            if (res.status === 200) {
                const mapped: Student[] = data.results.map((s: APIStudent, i: number) => ({
                    index: i + 1,
                    id: s.id,
                    name: `${s.first_name} ${s.last_name}`,
                    email: s.email || 'N/A',
                    photo: s.photo || '/image1.jpg',
                    studentId: `#${s.admission_number}`,
                    grade: s.current_class?.name || 'N/A',
                    status: s.status,
                    parentContact: s.parent_phone,
                    parentName: s.parent_name,
                    raw: s,
                }));
                setAllRows(mapped);
                setCurrentPage(1);
            }
        };

        fetchUserData();
    }, [refetchKey, search, statusFilter, gradeFilter]);

    const renderCell = (item: Student, columnKey: HeroKey) => {
        switch (columnKey) {
            case "studentName":
                return (
                    <div className="flex flex-row items-center gap-2 lg:gap-3">
                        <Image
                            src={item.photo}
                            alt={item.name}
                            width={32}
                            height={32}
                            className="rounded-full aspect-square object-cover border border-green-200 shrink-0 w-8 h-8 lg:w-9 lg:h-9"
                        />
                        <div className="flex flex-col min-w-0">
                            <p className="font-semibold text-gray-900 text-xs lg:text-sm leading-tight truncate">{item.name}</p>
                            <p className="text-[10px] lg:text-xs text-gray-400 truncate hidden sm:block">{item.email}</p>
                        </div>
                    </div>
                );
            case "studentId":
                return <span className="text-[10px] lg:text-xs font-mono text-gray-700">{item.studentId}</span>;
            case "grade":
                return <span className="text-[10px] lg:text-xs font-medium text-gray-700">{item.grade}</span>;
            case "status":
                return (
                    <span className={`inline-block px-2 lg:px-3 py-1 rounded-full text-[10px] lg:text-xs font-semibold ${
                        item.status === "active"
                            ? "text-green-700 bg-green-50"
                            : item.status === "on_leave"
                            ? "text-yellow-700 bg-yellow-50"
                            : "text-red-500 bg-red-50"
                    }`}>
                        * {item.status === "on_leave" ? "On Leave" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                );
            case "parentContact":
                return (
                    <div className="flex flex-col">
                        <p className="text-[10px] lg:text-xs font-medium text-gray-800">{item.parentContact}</p>
                        <p className="text-[10px] lg:text-xs text-gray-400 hidden sm:block">{item.parentName}</p>
                    </div>
                );
            case "actions":
                return (
                    <div className="flex flex-row gap-1 lg:gap-2">
                        {/* Edit */}
                        <button
                            onClick={() => onEdit?.(item.raw)}
                            className="p-1.5 text-xs font-semibold rounded-lg text-blue-500 hover:bg-blue-50 transition-all"
                            title="Edit student"
                        >
                            <Pencil size={16} />
                        </button>

                        {/* Delete — two-click confirm */}
                        <button
                            onClick={() => onDelete?.(item.id)}
                            title={deleteConfirmId === item.id ? "Click again to confirm deletion" : "Delete student"}
                            className={`text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                                deleteConfirmId === item.id
                                    ? "bg-red-500 text-white px-2 py-1"
                                    : "p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-400"
                            }`}
                        >
                            <Trash2 size={16} />
                            {deleteConfirmId === item.id && (
                                <span className="text-[10px]">Confirm?</span>
                            )}
                        </button>
                    </div>
                );
            default:
                return getKeyValue(item, columnKey as string);
        }
    };

    const columns = [
        { key: "studentName", label: "STUDENT NAME" },
        { key: "studentId", label: "ID NUMBER" },
        { key: "grade", label: "GRADE" },
        { key: "status", label: "STATUS" },
        { key: "parentContact", label: "PARENT CONTACT" },
        { key: "actions", label: "ACTIONS" },
    ];

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (TOTAL_PAGES <= 7) {
            for (let i = 1; i <= TOTAL_PAGES; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(TOTAL_PAGES - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < TOTAL_PAGES - 2) pages.push("...");
            pages.push(TOTAL_PAGES);
        }
        return pages;
    };

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden">
            <div className="flex-1 overflow-y-auto overflow-x-auto">
                <Table
                    aria-label="Student Records Table"
                    removeWrapper
                    className="min-w-140"
                >
                    <TableHeader>
                        {columns.map((col) => (
                            <TableColumn
                                key={col.key}
                                className="bg-green-50 text-gray-600 text-[12px] lg:text-md font-bold h-9 lg:h-10 first:rounded-tl-lg last:rounded-tr-lg whitespace-nowrap"
                            >
                                {col.label}
                            </TableColumn>
                        ))}
                    </TableHeader>
                    <TableBody items={paginatedRows}>
                        {(item) => (
                            <TableRow key={item.index} className="border-b border-gray-100 last:border-0 h-12 lg:h-14 hover:bg-green-50 transition-colors">
                                {(columnKey) => (
                                    <TableCell className="py-1 lg:py-2">
                                        {renderCell(item, columnKey as HeroKey)}
                                    </TableCell>
                                )}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 lg:px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg shrink-0 gap-2 sm:gap-0">
                <p className="text-[10px] lg:text-xs text-gray-500">
                    Showing <span className="font-bold text-gray-800">{startRecord}</span> to{" "}
                    <span className="font-bold text-gray-800">{endRecord}</span> of{" "}
                    <span className="font-bold text-gray-800">{allRows.length}</span> records
                </p>

                <div className="flex flex-row items-center gap-1">
                    {getPageNumbers().map((page, idx) =>
                        page === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page as number)}
                                className={`w-6 h-6 lg:w-7 lg:h-7 text-[10px] lg:text-xs rounded-md font-semibold transition-all ${
                                    currentPage === page
                                        ? "bg-green-600 text-white"
                                        : "text-gray-600 hover:bg-green-100"
                                }`}
                            >
                                {page}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, TOTAL_PAGES))}
                        disabled={currentPage === TOTAL_PAGES}
                        className="ml-1 flex items-center gap-1 px-2 py-1 text-[10px] lg:text-xs rounded-md font-semibold text-gray-600 hover:bg-green-100 disabled:opacity-40 transition-all"
                    >
                        Next <span>›</span>
                    </button>
                </div>
            </div>
        </div>
    );
}