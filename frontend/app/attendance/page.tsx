"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Bell, CalendarCheck, History, Printer, SendHorizonal, SquareArrowDownLeft, CheckCircle, XCircle, Loader2, Router } from "lucide-react";
import ScannerPage from "../components/AttendanceComponents/QrCodeScannerComponent";
import PreviousAttendanceRecords from "../components/AttendanceComponents/PreviousAttendance";
import StudentWeeklyAttendance from "../components/AttendanceComponents/IndividualStudentAttendance";


interface ClassOption {
    id: number;
    name: string;
}

interface SubjectOption {
    id: number;
    name: string;
}

interface AttendanceStudent {
    id: number;
    admission_number: string;
    full_name: string;
    photo_url: string | null;
    status: "P" | "A";
}

interface IndividualStudent{
    id: number,
    name:string,
    photo:string | null,
}


const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
};


export default function Attendance() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [qrAttendance, showQrAttendance] = useState(false);
    const [selectedClasses, setSelectedClasses] = useState<ClassOption | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
    const [students, setStudents] = useState<AttendanceStudent[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<IndividualStudent | null>(null);
    const [showRecord, setShowRecord] = useState(false)

    const presentCount = students.filter((s) => s.status === "P").length;
    const absentCount = students.filter((s) => s.status === "A").length;


    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await fetch("http://localhost:8000/api/classes/", { credentials: "include" });
                const data = await res.json();
                if (data.success) {
                    const list: ClassOption[] = (data.data.results ?? data.data).map(
                        (c: { id: number; name: string }) => ({ id: c.id, name: c.name })
                    );
                    setClasses(list);
                    if (list.length > 0) setSelectedClasses(list[0]);
                }
            } catch {
                console.error("Failed to fetch classes");
            }
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        if (!selectedClasses) return;
        const fetchSubjects = async () => {
            setLoadingSubjects(true);
            setSubjects([]);
            setSelectedSubject(null);
            try {
                const res = await fetch(
                    `http://localhost:8000/api/subjects/?grade_id=${selectedClasses.id}`,
                    { credentials: "include" }
                );
                const data = await res.json();
                if (data.success) {
                    const list: SubjectOption[] = (data.data.results ?? data.data).map(
                        (s: { id: number; name: string }) => ({ id: s.id, name: s.name })
                    );
                    setSubjects(list);
                    if (list.length > 0) setSelectedSubject(list[0]);
                }
            } catch {
                console.error("Failed to fetch subjects");
            } finally {
                setLoadingSubjects(false);
            }
        };
        fetchSubjects();
    }, [selectedClasses]);

    const fetchStudents = useCallback(async () => {
        if (!selectedClasses?.id) {
            console.log("No class selected — skipping");
            setStudents([]);
            setLoadingStudents(false);
            return;
        }

        setLoadingStudents(true);
        setSubmitSuccess(null);
        setSubmitError(null);

        const url = `http://localhost:8000/api/students/?current_class=${selectedClasses.id}`;
        console.log("FETCHING STUDENTS FROM →", url);

        try {
            const res = await fetch(url, { credentials: "include" });
            console.log("STATUS:", res.status);

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`HTTP ${res.status}: ${err}`);
            }

            const data = await res.json();
            console.log("RESPONSE:", data);

            const rawList = data.results || (data.success && data.data?.results) || [];

            if (!Array.isArray(rawList)) {
                throw new Error("No student array found in response");
            }

            const mapped: AttendanceStudent[] = (rawList as Array<{
                id: number;
                admission_number: string;
                full_name?: string;
                first_name?: string;
                last_name?: string;
                photo?: string | null;
                photo_url?: string | null;
            }>).map((s) => ({
                id: s.id,
                admission_number: s.admission_number,
                full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
                photo_url: s.photo || s.photo_url || null,
                status: "A" as const,
            }));

            const filtered = mapped.filter((s) => {
                const raw = rawList.find((r) => r.id === s.id);
                return raw?.current_class === selectedClasses?.id;
            })

            setStudents(filtered);
            console.log(`SUCCESS — Loaded ${mapped.length} students`);

            if (mapped.length === 0) {
                setSubmitError("No students found in this class. Add some or check class assignment.");
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setSubmitError("Failed to load students — see console");
        } finally {
            setLoadingStudents(false);
        }
    }, [selectedClasses]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // QR scan callback
    const handleQrSuccess = useCallback((admissionNumber: string) => {
        setStudents((prev) => {
            const alreadyPresent = prev.find(
                (s) => s.admission_number === admissionNumber && s.status === "P"
            );
            if (alreadyPresent) return prev; 
            return prev.map((s) =>
                s.admission_number === admissionNumber ? { ...s, status: "P" } : s
            );
        });
        setLastScanned(admissionNumber);
        setTimeout(() => setLastScanned(null), 3000);
    }, []);

    const toggleStatus = (studentId: number) => {
        setStudents((prev) =>
            prev.map((s) =>
                s.id === studentId ? { ...s, status: s.status === "P" ? "A" : "P" } : s
            )
        );
    };

    const handleSubmit = async () => {
        if (!selectedClasses || students.length === 0) return;
        setSubmitting(true);
        setSubmitSuccess(null);
        setSubmitError(null);

        const submitData = {
            class_id: selectedClasses?.id,
            date: selectedDate,
            marked_by: 1, // TODO: replace with logged in teacher id from /api/auth/me/

            // subject_id included when a subject is selected — per workflow doc
            ...(selectedSubject ? { subject_id: selectedSubject.id } : {}),
            attendance: students.map((s) => ({
                student_id: String(s.id),
                status: s.status,
            })),
        };

        try {
            const res = await fetch("http://localhost:8000/api/attendance/mark/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify(submitData),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitSuccess(data.message || "Attendance saved successfully!");
                setTimeout(()=>{
                    setSubmitSuccess(null);
                }, 3000)
        
            } else {
                setSubmitError(data.error || "Failed to save attendance.");
                setTimeout(()=>{
                    setSubmitError(null);
                }, 3000)
            }
        } catch {
            setSubmitError("Network error. Please try again.");
            setTimeout(()=>{
                setSubmitError(null);
            },3000)
        } finally {
            setSubmitting(false);
        }
    };

    const routes = () => {
        const role = typeof window !== "undefined" ? localStorage.getItem("role") : null;
        if (role === "Admin" || role === "admin") {
            return <a href="/dashboard">Dashboard</a>;
        } else {
            return <a href="/students">Students</a>;
        }
    };


    return (
        <main className="flex flex-col overflow-hidden overflow-y-scroll bg-[#dee2e6] w-screen min-h-screen attendance">

            {/* ── Nav ── */}
            <section className="nav min-h-[10vh] bg-gray-50 shadow-xl justify-between items-center flex flex-row p-3 px-4 sm:px-6 lg:px-10 sticky top-0 z-50">
                <div className="flex flex-row gap-3 lg:gap-5 items-center">
                    <Image
                        className="bg-green-500 rounded-lg object-contain shrink-0"
                        src={'/logo2.jpg'}
                        alt="EduTrack"
                        width={44}
                        height={44}
                        priority
                    />
                    <div className="flex flex-col">
                        <h1 className="text-gray-900 font-bold text-lg lg:text-2xl leading-tight">EduTrack</h1>
                        <span className="text-gray-400 font-medium text-[10px] lg:text-sm hidden sm:block">PRIMARY SCHOOL SYSTEM</span>
                    </div>
                </div>
                <div className="flex flex-row gap-3 lg:gap-6 justify-center items-center">
                    <div className="flex flex-col justify-center items-end sm:flex">
                        <h3 className="text-gray-900 font-bold text-sm lg:text-lg leading-tight">Mrs. Sarah Jenkins</h3>
                        <span className="text-gray-500 text-xs lg:text-sm">Science Teacher</span>
                    </div>
                    <Image
                        className="bg-gray-800 rounded-full shrink-0 aspect-square object-cover"
                        src={'/image1.jpg'}
                        alt="Profile"
                        width={44}
                        height={44}
                        priority
                    />
                    <Bell color="black" size={20} className="cursor-pointer" />
                    <span className="flex flex-row items-center gap text-gray-900"><SquareArrowDownLeft size={18}/> {routes()}</span>
                </div>
            </section>

            <section className="page-content flex flex-col mt-4 lg:mt-6 justify-center items-center pb-6">

                {/* ── Controls card ── */}
                <div className="register w-[95%] lg:w-[90%] bg-gray-50 rounded-xl p-4 lg:p-7 shadow-sm">
                    <div className="flex flex-row justify-between items-center gap-2 mb-5 lg:mb-8">
                        <div className="flex flex-row items-center gap-2">
                            <CalendarCheck size={22} className="text-gray-600 shrink-0" />
                            <h1 className="font-bold text-lg lg:text-xl text-gray-900">Take Attendance</h1>
                        </div>
                        <div>
                            <button
                                onClick={() => showQrAttendance(true)}
                                className="text-gray-900 bg-green-400 px-4 py-4 rounded-xl cursor-pointer">
                                Take QR Attendance
                            </button>

                            <ScannerPage
                                isOpen={qrAttendance}
                                onClose={() => showQrAttendance(false)}
                                onSuccess={() => {}}
                                onQrSuccess={handleQrSuccess}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row lg:justify-between lg:items-end gap-4 lg:gap-6">

                        {/* Class */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase ml-3 tracking-wider">Select Class</h4>
                            <select
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full"
                                value={selectedClasses?.id ?? ""}
                                onChange={(e) => {
                                    const found = classes.find((c) => c.id === Number(e.target.value));
                                    setSelectedClasses(found ?? null);
                                }}
                            >
                                {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subject — required per workflow doc */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase ml-3 tracking-wider">Select Subject</h4>
                            <select
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full disabled:opacity-50"
                                value={selectedSubject?.id ?? ""}
                                disabled={loadingSubjects || subjects.length === 0}
                                onChange={(e) => {
                                    const found = subjects.find((s) => s.id === Number(e.target.value));
                                    setSelectedSubject(found ?? null);
                                }}
                            >
                                {loadingSubjects && <option>Loading...</option>}
                                {!loadingSubjects && subjects.length === 0 && <option>No subjects</option>}
                                {subjects.map((sub) => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Date</h4>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                            />
                        </div>

                        {/* Stats */}
                        <div className="flex flex-row gap-3 col-span-2 sm:col-span-3 lg:col-auto lg:gap-4 lg:ml-auto">
                            <div className="flex flex-col items-center justify-center bg-gray-100 border rounded-xl h-16 lg:h-20 flex-1 lg:flex-none lg:px-8">
                                <h2 className="text-2xl lg:text-3xl font-black text-blue-600">{students.length}</h2>
                                <span className="text-[9px] lg:text-[10px] font-bold text-blue-500 uppercase">Total Students</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-gray-100 border rounded-xl h-16 lg:h-20 flex-1 lg:flex-none lg:px-4">
                                <h2 className="text-2xl lg:text-3xl font-black text-green-600">{presentCount}</h2>
                                <span className="text-[9px] lg:text-[10px] font-bold text-green-500 uppercase">Present</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-gray-100 border rounded-xl h-16 lg:h-20 flex-1 lg:flex-none lg:px-4">
                                <h2 className="text-2xl lg:text-3xl font-black text-red-600">{absentCount}</h2>
                                <span className="text-[9px] lg:text-[10px] font-bold text-red-500 uppercase">Absent</span>
                            </div>
                        </div> 
                    </div>
                </div>

                {/* ── Student list ── */}
                <div className="manual-attendance w-[95%] lg:w-[90%] bg-white shadow-xl rounded-xl mt-6 lg:mt-9" style={{ minHeight: '50vh' }}>

                    {/* Table header */}
                    <div className="grid grid-cols-12 bg-green-50 px-4 py-3 rounded-t-xl text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-1">#</div>
                        <div className="col-span-6 sm:col-span-5">Student</div>
                        <div className="col-span-3 hidden sm:block">Admission No.</div>
                        <div className="col-span-5 sm:col-span-3 text-center">Status</div>
                    </div>

                    {/* Loading */}
                    {loadingStudents && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 size={28} className="animate-spin text-blue-400" />
                            <p className="text-sm text-gray-400 font-medium">Loading students...</p>
                        </div>
                    )}

                    {/* Empty */}
                    {!loadingStudents && students.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <p className="text-sm text-gray-400 font-medium">Select a class to load students.</p>
                        </div>
                    )}

                    {/* Rows */}
                    {!loadingStudents && students.map((student, idx) => {
                        const isPresent = student.status === "P";
                        const justScanned = lastScanned === student.admission_number;
                        return (
                            <div
                                key={student.id}
                                className={`grid grid-cols-12 px-4 py-3 items-center border-b border-gray-100 last:border-0 transition-colors ${
                                    justScanned ? "bg-green-50" : isPresent ? "bg-white" : "bg-red-50/30"
                                }`}
                            >
                                <div className="col-span-1 text-xs text-gray-400 font-mono">{idx + 1}</div>

                                <div className="col-span-6 sm:col-span-5 flex items-center gap-2 lg:gap-3">
                                    {student.photo_url ? (
                                        <Image
                                            src={student.photo_url}
                                            alt={student.full_name}
                                            width={34}
                                            height={34}
                                            className="rounded-full aspect-square object-cover border border-gray-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                            {student.full_name.charAt(0)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs lg:text-sm font-semibold text-gray-900 truncate">{student.full_name}</p>
                                        {justScanned && (
                                            <p className="text-[10px] text-green-600 font-semibold">✓ Just scanned</p>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-3 hidden sm:block text-xs font-medium text-gray-500">
                                    #{student.admission_number}
                                </div>

                                <div className="col-span-5 sm:col-span-3 flex justify-center gap-10">
                                    <button
                                        onClick={() => toggleStatus(student.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                            isPresent
                                                ? "bg-green-100 text-green-700  border-gray-100 hover:bg-green-200"
                                                : "bg-red-50 text-red-500 border-gray-100  hover:bg-red-100"
                                        }`}
                                    >
                                        {isPresent
                                            ? <><CheckCircle size={13} /> Present</>
                                            : <><XCircle size={13} /> Absent</>
                                        }
                                    </button>

                                    <button
                                        onClick={() => setSelectedStudent({ id: student.id, name: student.full_name, photo: student.photo_url })}
                                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition-colors border border-blue-100"
                                        title="View attendance history"
                                    >
                                        <History size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Footer actions ── */}
                <div className="flex flex-col sm:flex-row w-[95%] lg:w-[90%] gap-4 justify-between items-center py-6 lg:py-0 lg:h-[20vh]">

                    {submitSuccess && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-semibold">
                            <CheckCircle size={16} /> {submitSuccess}
                        </div>
                    )}
                    {submitError && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-semibold">
                            <XCircle size={16} /> {submitError}
                        </div>
                    )}

                    {!submitSuccess && !submitError && (
                        <div className="flex flex-row text-gray-900 font-medium gap-3 lg:gap-6 w-full sm:w-auto">
                           <div className="items-center justify-center">
                                <button 
                                    onClick={() => setShowRecord(true)}
                                    className="flex flex-row bg-white shadow-xl px-4 lg:px-6 py-3 gap-2 lg:gap-3 rounded-xl text-sm lg:text-base flex-1 sm:flex-none justify-center">
                                    <History size={20} color="#0077b6"/> Previous Records
                                </button>

                                 <PreviousAttendanceRecords 
                                        isOpen={showRecord}
                                        onClose={() => setShowRecord(false)}
                                        onSuccess={() => {}}
                                        selectedClassId={selectedClasses?.id ?? null}
                                    />
                           </div>
                            <button className="flex flex-row bg-white shadow-xl px-4 lg:px-6 py-3 gap-2 lg:gap-3 rounded-xl text-sm lg:text-base flex-1 sm:flex-none justify-center">
                                <Printer size={20} color="#0077b6" /> Print Sheet
                            </button>
                        </div>
                    )}

                    <div className="w-full sm:w-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || students.length === 0}
                            className="flex flex-row bg-[#0077b6] font-bold text-base lg:text-xl shadow-2xl px-5 lg:px-6 py-3 gap-3 rounded-2xl w-full sm:w-auto justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? <><Loader2 size={22} className="animate-spin" /> Saving...</>
                                : <>Save Attendance <SendHorizonal size={22} color="#fff" /></>
                            }
                        </button>
                    </div>
                </div>
            </section>

            {selectedStudent && (
                <StudentWeeklyAttendance
                    isOpen={!!selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    studentId={selectedStudent.id}
                    studentName={selectedStudent.name}
                    studentPhoto={selectedStudent.photo}
                    selectedClassId={selectedClasses?.id ?? null}
                />
            )}
        </main>
    );
}