"use client";
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/SidebarComponent";
import { Bell, Cake, TrendingUp, UserPlus, UserRound, Printer, X, Loader2 } from "lucide-react";
import Image from "next/image";
import StudentRecords from "../components/StudentsComponents/StudentRecords";
import AddStudentModal, { StudentData } from "../components/StudentsComponents/AddStudentsComponent";
import jsPDF from "jspdf";

interface StudentStats {
    total_active: number;
    avg_attendance: number;
    birthdays_today: number;
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

interface ClassOption {
    id: number;
    name: string;
    grade_level: string;
}

// ==================== PRINT QR MODAL ====================

interface PrintQRModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (classId: string, className: string) => void;
    isPrinting: boolean;
    classes: ClassOption[];
    loadingClasses: boolean;
}

function PrintQRModal({ isOpen, onClose, onConfirm, isPrinting, classes, loadingClasses }: PrintQRModalProps) {
    const [selectedClassId, setSelectedClassId] = useState("all");

    useEffect(() => {
        if (!isOpen) return;
        const t = window.setTimeout(() => setSelectedClassId("all"), 0);
        return () => clearTimeout(t);
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedClassName =
        selectedClassId === "all"
            ? "All Classes"
            : classes.find((c) => String(c.id) === selectedClassId)?.name ?? "Unknown";

    {/* PRINTING QRCODES PAGE  */}        
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

                <div className="bg-green-100 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Printer size={18} className="text-gray-900" />
                        <h2 className="text-gray-800 font-bold text-lg">Print QR Codes</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isPrinting}
                        className="text-black hover:text-gray-4000 transition-colors disabled:opacity-40"
                    >
                        <X size={20} />
                    </button>
                </div>

                
                <div className="px-6 py-5 flex flex-col gap-4">
                    <p className="text-gray-500 text-sm">
                        Select a class to generate QR code cards for, or print all at once.
                    </p>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-gray-700 text-sm font-semibold">
                            Class
                            {loadingClasses && (
                                <span className="ml-2 text-gray-400 font-normal text-xs">Loading...</span>
                            )}
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            disabled={isPrinting || loadingClasses}
                            className="bg-gray-50 text-gray-800 px-4 py-2.5 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50"
                        >
                            <option value="all">All Classes</option>
                            {classes.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-gray-0 border border-green-100 rounded-lg px-4 py-3 text-xs text-green-800">
                        ℹ️ Only students with already-generated QR codes will be included. Students without QR codes will be skipped.
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isPrinting}
                        className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(selectedClassId, selectedClassName)}
                        disabled={isPrinting || loadingClasses}
                        className="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isPrinting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Generating…
                            </>
                        ) : (
                            <>
                                <Printer size={14} />
                                Generate PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ==================== MAIN PAGE ====================

const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
};

export default function StudentsPage() {
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
    const [tabData, setTabData] = useState<StudentStats | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [refetchKey, setRefetchKey] = useState(0);

    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const grades = [...new Set(classes.map((c) => c.grade_level))].sort();

    // Delete state
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Print QR state
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const tabs = [
        { index: 1, title: 'Total Active Students', value: tabData?.total_active.toString() || '0', icon: UserRound },
        { index: 2, title: 'Avg. Attendance', value: tabData?.avg_attendance ? `${tabData.avg_attendance}%` : '...', icon: TrendingUp },
        { index: 3, title: 'Birthdays Today', value: tabData?.birthdays_today.toString() || '0', icon: Cake },
    ];

    // ── Fetch all classes once on mount (your existing pattern) ──
    useEffect(() => {
        const fetchClasses = async () => {
            setLoadingClasses(true);
            try {
                const res = await fetch("http://localhost:8000/api/classes/", { credentials: "include" });
                const data = await res.json();
                if (data.success) {
                    const list: ClassOption[] = (data.data.results ?? data.data).map(
                        (c: { id: number; name: string; grade_level: string }) => ({
                            id: c.id,
                            name: c.name,
                            grade_level: c.grade_level,
                        })
                    );
                    setClasses(list);
                }
            } catch {
                console.error("Failed to fetch classes");
            } finally {
                setLoadingClasses(false);
            }
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        const buildUrl = () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (gradeFilter !== 'all') params.append('grade', gradeFilter);
            return `http://localhost:8000/api/students/?${params.toString()}`;
        };

        const fetchTabData = async () => {
            const res = await fetch(buildUrl(), { method: 'GET', credentials: 'include' });
            const data = await res.json();
            if (res.status === 200) setTabData(data.statistics);
        };

        const timer = setTimeout(fetchTabData, 400);
        return () => clearTimeout(timer);
    }, [search, statusFilter, gradeFilter, refetchKey]);


    const handleEditClick = (raw: APIStudent) => {
        setEditingStudent({
            id: raw.id,
            admission_number: raw.admission_number,
            first_name: raw.first_name,
            last_name: raw.last_name,
            email: raw.email || "",
            date_of_birth: "",
            gender: "",
            status: raw.status,
            current_class: raw.current_class?.id || "",
            parent_name: raw.parent_name,
            parent_phone: raw.parent_phone,
            parent_email: "",
            address: "",
            enrollment_date: "",
            photo: raw.photo,
        });
    };

    const handleDeleteClick = (studentId: number) => {
        if (deleteConfirmId === studentId) {
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            setDeleting(true);
            fetch(`http://localhost:8000/api/students/${studentId}/`, {
                method: "DELETE",
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
                .then((res) => {
                    if (res.status === 200 || res.status === 204) setRefetchKey((k) => k + 1);
                })
                .finally(() => {
                    setDeleting(false);
                    setDeleteConfirmId(null);
                });
        } else {
            setDeleteConfirmId(studentId);
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 3000);
        }
    };

    const handleModalClose = () => {
        setShowAddStudent(false);
        setEditingStudent(null);
    };

    const handleModalSuccess = () => {
        setRefetchKey((k) => k + 1);
        handleModalClose();
    };


    // ==================== PRINT QR CODES ====================

    const handlePrintQRCodes = async (classId: string, className: string) => {
        setIsPrinting(true);
        try {
            // Step 1: Fetch active students for selected class (or all)
            const params = new URLSearchParams();
            params.append("status", "active");
            if (classId !== "all") params.append("current_class", classId);

            const studentsRes = await fetch(
                `http://localhost:8000/api/students/?${params.toString()}`,
                { credentials: "include" }
            );
            const studentsData = await studentsRes.json();
            const students: APIStudent[] = studentsData.results ?? [];

            if (students.length === 0) {
                alert("No active students found for the selected class.");
                return;
            }

            // Step 2: Fetch QR codes for all students in parallel
            const qrResults = await Promise.allSettled(
                students.map((s) =>
                    fetch(`http://localhost:8000/api/students/${s.id}/qr-code/`, {
                        credentials: "include",
                    }).then((r) => r.json())
                )
            );

            // Step 3: Keep only students that have a QR image URL
            type QRCard = {
                student_id: number;
                admission_number: string;
                full_name: string;
                qr_code_image_url: string;
                class_name: string;
            };

            const qrCards: QRCard[] = [];
            qrResults.forEach((result, i) => {
                if (
                    result.status === "fulfilled" &&
                    result.value?.success &&
                    result.value?.data?.qr_code_image_url
                ) {
                    qrCards.push({
                        ...result.value.data,
                        class_name: students[i].current_class?.name ?? "—",
                    });
                }
            });

            if (qrCards.length === 0) {
                alert(
                    "No QR codes have been generated yet for the selected students.\nPlease generate QR codes for students first."
                );
                return;
            }

            // Step 4: Load QR images as base64 via canvas
            const loadImage = (url: string): Promise<string> =>
                new Promise((resolve, reject) => {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        canvas.getContext("2d")!.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL("image/png"));
                    };
                    img.onerror = reject;
                    img.src = url.startsWith("http") ? url : `http://localhost:8000${url}`;
                });

            const imageDataList = await Promise.allSettled(
                qrCards.map((card) => loadImage(card.qr_code_image_url))
            );

            // Step 5: Build A4 PDF — 3 cards per row
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            const pageW = 210;
            const pageH = 297;
            const margin = 12;
            const cols = 3;
            const colGap = 5;
            const rowGap = 6;
            const cardW = (pageW - margin * 2 - colGap * (cols - 1)) / cols;
            const cardH = 72;
            const cardsPerPage = cols * Math.floor((pageH - 20 - margin + rowGap) / (cardH + rowGap));

            const drawPageHeader = (pageNum?: number) => {
                doc.setFillColor(74, 180, 100);
                doc.rect(0, 0, pageW, 14, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text(
                    `STUDENT QR CODE CARDS — ${className.toUpperCase()}`,
                    pageW / 2, 6,
                    { align: "center" }
                );
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "normal");
                const rightText = pageNum
                    ? `Page ${pageNum}`
                    : `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}   |   Total: ${qrCards.length} student${qrCards.length !== 1 ? "s" : ""}`;
                doc.text(rightText, pageW / 2, 11, { align: "center" });
            };

            drawPageHeader();

            let col = 0;
            let row = 0;
            const startY = 20;

            qrCards.forEach((card, index) => {
                const cardIndex = index % cardsPerPage;

                if (index > 0 && cardIndex === 0) {
                    doc.addPage();
                    drawPageHeader(Math.floor(index / cardsPerPage) + 1);
                    col = 0;
                    row = 0;
                }

                const x = margin + col * (cardW + colGap);
                const y = startY + row * (cardH + rowGap);

                // Card shell
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(210, 235, 215);
                doc.setLineWidth(0.35);
                doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");

                // Green header bar
                doc.setFillColor(74, 180, 100);
                doc.roundedRect(x, y, cardW, 9, 3, 3, "F");
                doc.setFillColor(74, 180, 100);
                doc.rect(x, y + 4.5, cardW, 4.5, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(5.5);
                doc.setFont("helvetica", "bold");
                doc.text("STUDENT ID CARD", x + cardW / 2, y + 6, { align: "center" });

                // QR image
                const qrSize = 33;
                const qrX = x + (cardW - qrSize) / 2;
                const qrY = y + 12;
                const imgResult = imageDataList[index];

                if (imgResult.status === "fulfilled") {
                    doc.addImage(imgResult.value, "PNG", qrX, qrY, qrSize, qrSize);
                } else {
                    doc.setFillColor(245, 245, 245);
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(qrX, qrY, qrSize, qrSize, "FD");
                    doc.setTextColor(160, 160, 160);
                    doc.setFontSize(5);
                    doc.text("QR unavailable", x + cardW / 2, qrY + qrSize / 2, { align: "center" });
                }

                // Student info
                const infoY = qrY + qrSize + 4.5;
                const maxNameChars = 21;
                const displayName =
                    card.full_name.length > maxNameChars
                        ? card.full_name.substring(0, maxNameChars) + "…"
                        : card.full_name;

                doc.setTextColor(25, 25, 25);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.text(displayName, x + cardW / 2, infoY, { align: "center" });

                doc.setFontSize(6);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(90, 90, 90);
                doc.text(`Adm: ${card.admission_number}`, x + cardW / 2, infoY + 4.5, { align: "center" });

                doc.setFontSize(5.8);
                doc.setTextColor(110, 110, 110);
                doc.text(card.class_name, x + cardW / 2, infoY + 8.5, { align: "center" });

                // Divider
                doc.setDrawColor(220, 240, 225);
                doc.setLineWidth(0.25);
                doc.line(x + 5, infoY + 11, x + cardW - 5, infoY + 11);

                // Footer
                doc.setFontSize(4.8);
                doc.setTextColor(170, 170, 170);
                doc.text("Scan to mark attendance", x + cardW / 2, infoY + 14.5, { align: "center" });

                col++;
                if (col >= cols) { col = 0; row++; }
            });

            const dateStr = new Date().toISOString().split("T")[0];
            const filePart = className.toLowerCase().replace(/\s+/g, "-");
            doc.save(`qr-codes-${filePart}-${dateStr}.pdf`);

            setShowPrintModal(false);

        } catch (err) {
            console.error("QR PDF generation failed:", err);
            alert("Something went wrong while generating the PDF. Please try again.");
        } finally {
            setIsPrinting(false);
        }
    };


    return (
        <main className="flex flex-row bg-gray-300 w-screen min-h-screen students overflow-x-hidden">
            <Sidebar />
            <section className="page-content min-h-screen w-full lg:w-[85%] overflow-x-hidden flex flex-col">

                {/* Navbar */}
                <div className="navbar w-full min-h-[10vh] bg-gray-50 shadow-2xl justify-between items-center flex flex-row overflow-hidden px-4 lg:px-0 shrink-0">
                    <div className="flex flex-col p-2 pl-4 lg:pl-6 pr-4 lg:pr-10">
                        <h1 className="text-gray-900 font-bold text-lg lg:text-2xl">Student Management</h1>
                        <span className="text-gray-400 font-medium text-xs lg:text-sm hidden sm:block">
                            Manage and monitor primary student records
                        </span>
                    </div>
                    <div className="flex flex-row gap-3 lg:gap-5 justify-center items-center pr-4 lg:pr-6">
                        <Bell size={22} className="shrink-0" />
                        <div className="flex flex-col justify-end items-end sm:flex">
                            <h1 className="font-bold text-sm lg:text-lg text-gray-800">Sarah Jenkins</h1>
                            <span className="font-medium text-xs lg:text-md text-gray-500">Administrator</span>
                        </div>
                        <Image
                            className="rounded-full shrink-0 aspect-square object-cover"
                            src={'/image1.jpg'}
                            alt=".PM"
                            width={46}
                            height={46}
                            priority
                        />
                    </div>
                </div>

                {/* Filters + Buttons */}
                <div className="content1 w-full flex justify-center items-center p-3 lg:p-4 mt-2 lg:mt-3 shrink-0">
                    <div className="w-full lg:w-[95%] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-2">

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, ID or parent contact..."
                            className="bg-white w-full sm:w-[40%] lg:w-[30vw] shadow-md px-4 py-2 text-gray-900 rounded-lg text-sm border border-green-200"
                        />

                        <div className="buttons flex flex-row gap-2 lg:gap-3 w-full sm:w-auto">
                            {/* Grade filter — populated from fetched classes */}
                            <select
                                value={gradeFilter}
                                onChange={(e) => setGradeFilter(e.target.value)}
                                disabled={loadingClasses}
                                className="bg-white text-gray-800 px-3 lg:px-4 py-1.5 rounded-lg border shadow-md border-green-200 text-xs lg:text-sm flex-1 sm:flex-none disabled:opacity-60"
                            >
                                <option value="all">
                                    {loadingClasses ? "Loading…" : "All Grades"}
                                </option>
                                {grades.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white text-gray-800 px-3 lg:px-4 py-1.5 rounded-lg border shadow-md border-green-200 text-xs lg:text-sm flex-1 sm:flex-none"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="on_leave">On Leave</option>
                            </select>
                        </div>

                        <div className="new-user w-full sm:w-auto flex flex-row gap-2">
                            <button
                                className="bg-green-400 text-gray-900 items-center justify-center cursor-pointer flex flex-row px-3 lg:px-4 text-xs lg:text-sm py-2 shadow-lg rounded-lg gap-2 w-full sm:w-auto"
                                onClick={() => setShowAddStudent(true)}
                            >
                                <UserPlus size={14} /> Add New Student
                            </button>

                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="bg-white border border-green-300 text-gray-800 items-center justify-center cursor-pointer flex flex-row px-3 lg:px-4 text-xs lg:text-sm py-2 shadow-lg rounded-lg gap-2 w-full sm:w-auto hover:bg-green-50 transition-colors"
                            >
                                <Printer size={14} /> Print QR Codes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Student Table */}
                <div className="student-table w-full flex justify-center items-center px-3 lg:p-4 flex-1 min-h-0">
                    <div className="w-full lg:w-[95%] h-full flex flex-row justify-between items-center lg:p-4">
                        <StudentRecords
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                            deleteConfirmId={deleteConfirmId}
                            refetchKey={refetchKey}
                            search={search}
                            statusFilter={statusFilter}
                            gradeFilter={gradeFilter}
                        />
                    </div>
                </div>

                {/* Stats tabs */}
                <div className="student-table w-full flex justify-center items-center py-3 shrink-0">
                    <div className="w-full lg:w-[95%] grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 lg:p-4">
                        {tabs.map((item) => (
                            <div key={item.index} className="bg-white h-16 lg:h-20 gap-3 lg:gap-4 rounded-lg flex flex-row p-3 lg:p-4 justify-center items-center">
                                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center bg-green-100 shrink-0">
                                    <item.icon className="text-green-600" size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-gray-600 font-medium text-xs lg:text-sm">{item.title}</h1>
                                    <span className="text-gray-900 text-lg lg:text-xl font-bold">{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </section>

            {/* Add / Edit student modal */}
            <AddStudentModal
                key={editingStudent?.id ?? 'new'}
                isOpen={showAddStudent || !!editingStudent}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                student={editingStudent}
            />

            {/* Print QR modal */}
            <PrintQRModal
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                onConfirm={handlePrintQRCodes}
                isPrinting={isPrinting}
                classes={classes}
                loadingClasses={loadingClasses}
            />
        </main>
    );
}