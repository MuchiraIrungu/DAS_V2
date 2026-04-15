"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Bell,
  CalendarCheck,
  History,
  Printer,
  SendHorizonal,
  LogOut,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import ScannerPage from "../components/AttendanceComponents/QrCodeScannerComponent";
import PreviousAttendanceRecords from "../components/AttendanceComponents/PreviousAttendance";
import StudentWeeklyAttendance from "../components/AttendanceComponents/IndividualStudentAttendance";
import { API_PATH } from "../lib/path";

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

interface IndividualStudent {
  id: number;
  name: string;
  photo: string | null;
}

// Shape of /api/auth/me/ — matches your actual login response structure
interface AuthMeResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: string;
    phone: string | null;
    photo: string | null;
    is_active: boolean;
    date_joined: string;
  };
}

// Shape of /api/dashboard/teacher/?teacher_id=X
interface TeacherDashboardResponse {
  success: boolean;
  data: {
    assigned_classes: Array<{ id: number; name: string; [key: string]: unknown }>;
    todays_tasks: unknown[];
  };
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
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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
  const [showRecord, setShowRecord] = useState(false);

  // ── Dynamic user & school state ──────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<AuthMeResponse["user"] | null>(null);
  const [schoolName, setSchoolName] = useState<string>("EduTrack");
  const [isClassLocked, setIsClassLocked] = useState(false);
  const [loggedInTeacherId, setLoggedInTeacherId] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const presentCount = students.filter((s) => s.status === "P").length;
  const absentCount = students.filter((s) => s.status === "A").length;

  // ── Logout handler ───────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await fetch(`${API_PATH}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
    } catch {
      // proceed even if request fails
    }
    localStorage.clear();
    window.location.href = "/login";
  };

  // ── Step 1: Fetch current user from /api/auth/me/ ───────────────────────
  // This is the single source of truth for role, name, id — no localStorage guessing.
  useEffect(() => {
    const bootstrap = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch(`${API_PATH}/api/auth/me/`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: AuthMeResponse = await res.json();

        if (!data.success) throw new Error("Not authenticated");
        const user = data.user;
        setCurrentUser(user);

        const isTeacher = user.role?.toLowerCase() === "teacher";

        if (isTeacher) {
          // ── Fetch teacher's assigned classes via teacher dashboard ──────
          // /api/dashboard/teacher/?teacher_id={id} returns assigned_classes[]
          const dashRes = await fetch(
            `${API_PATH}/api/dashboard/teacher/?teacher_id=${user.id}`,
            { credentials: "include" }
          );
          if (!dashRes.ok) throw new Error(`Teacher dashboard HTTP ${dashRes.status}`);
          const dashData: TeacherDashboardResponse = await dashRes.json();

          if (dashData.success && dashData.data.assigned_classes?.length > 0) {
            const assignedClasses: ClassOption[] = dashData.data.assigned_classes.map(
              (c) => ({ id: c.id, name: c.name })
            );
            setClasses(assignedClasses);
            setSelectedClasses(assignedClasses[0]); // default to first assigned class
            setIsClassLocked(assignedClasses.length === 1); // lock only if exactly one class
            setLoggedInTeacherId(user.id);
          } else {
            setSubmitError(
              "You don't have an assigned class yet. Please contact your headteacher."
            );
          }
        } else {
          // ── Admin / Headteacher — load all classes & school name ────────
          setLoggedInTeacherId(user.id);
          await fetchAllClasses();
          await fetchSchoolName();
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setSubmitError("Could not load your profile. Please refresh the page.");
      } finally {
        setLoadingProfile(false);
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllClasses = async () => {
    try {
      const res = await fetch(`${API_PATH}/api/classes/`, {
        credentials: "include",
      });
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

  // School name comes from the admin dashboard response
  const fetchSchoolName = async () => {
    try {
      const res = await fetch(`${API_PATH}/api/dashboard/admin/`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.data?.school_name) {
        setSchoolName(data.data.school_name);
      }
    } catch {
      // non-critical — keep default
    }
  };

  // ── Step 2: Load subjects whenever selected class changes ────────────────
  useEffect(() => {
    if (!selectedClasses) return;
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      setSubjects([]);
      setSelectedSubject(null);
      try {
        const res = await fetch(
          `${API_PATH}/api/subjects/?grade_id=${selectedClasses.id}`,
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

  // ── Step 3: Load students for the selected class ─────────────────────────
  const fetchStudents = useCallback(async () => {
    if (!selectedClasses?.id) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    const url = `${API_PATH}/api/students/?current_class=${selectedClasses.id}`;

    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json();
      const rawList =
        data.results || (data.success && data.data?.results) || [];

      if (!Array.isArray(rawList)) throw new Error("No student array found");

      const mapped: AttendanceStudent[] = (
        rawList as Array<{
          id: number;
          admission_number: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
          photo?: string | null;
          photo_url?: string | null;
          current_class?: number;
        }>
      ).map((s) => ({
        id: s.id,
        admission_number: s.admission_number,
        full_name:
          s.full_name || `${s.first_name || ""} ${s.last_name || ""}`.trim(),
        photo_url: s.photo || s.photo_url || null,
        status: "A" as const,
      }));

      const filtered = mapped.filter((s) => {
        const raw = rawList.find(
          (r: { id: number; current_class?: number }) => r.id === s.id
        );
        return raw?.current_class === selectedClasses.id;
      });

      setStudents(filtered);

      if (filtered.length === 0) {
        setSubmitError(
          "No students found in this class. Add some or check class assignment."
        );
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setSubmitError("Failed to load students — see console");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClasses]);

  useEffect(() => {
    if (loadingProfile) return;
    fetchStudents();
  }, [fetchStudents, loadingProfile]);

  // ── QR scan handler ──────────────────────────────────────────────────────
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
        s.id === studentId
          ? { ...s, status: s.status === "P" ? "A" : "P" }
          : s
      )
    );
  };

  const handleSubmit = async () => {
    if (!selectedClasses || students.length === 0) return;
    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    const submitData = {
      class_id: selectedClasses.id,
      date: selectedDate,
      // Use the actual logged-in user's id instead of the hardcoded 1
      marked_by: loggedInTeacherId,
      ...(selectedSubject ? { subject_id: selectedSubject.id } : {}),
      attendance: students.map((s) => ({
        student_id: String(s.id),
        status: s.status,
      })),
    };

    try {
      const res = await fetch(`${API_PATH}/api/attendance/mark/`, {
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
        setTimeout(() => setSubmitSuccess(null), 3000);
      } else {
        setSubmitError(data.error || "Failed to save attendance.");
        setTimeout(() => setSubmitError(null), 3000);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setTimeout(() => setSubmitError(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Full-page loader while resolving profile ─────────────────────────────
  if (loadingProfile) {
    return (
      <main className="flex items-center justify-center w-screen min-h-screen bg-[#dee2e6]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-400" />
          <p className="text-sm text-gray-500 font-medium">
            Loading your profile...
          </p>
        </div>
      </main>
    );
  }

  // ── Derive display values from live data ─────────────────────────────────
  const displayName = currentUser?.full_name ?? "—";
  const displayRole =
    currentUser?.role
      ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
      : "—";
  const displayPhoto = currentUser?.photo ?? null;

  return (
    <main className="flex flex-col overflow-hidden overflow-y-scroll bg-[#dee2e6] w-screen min-h-screen attendance">

      {/* ── Nav ── */}
      <section className="nav min-h-[10vh] bg-gray-50 shadow-xl justify-between items-center flex flex-row p-3 px-4 sm:px-6 lg:px-10 sticky top-0 z-50">
        <div className="flex flex-row gap-3 lg:gap-5 items-center">
          <Image
            className="bg-green-500 rounded-lg object-contain shrink-0"
            src={"/logo2.jpg"}
            alt="EduTrack"
            width={44}
            height={44}
            priority
          />
          <div className="flex flex-col">
            <h1 className="text-gray-900 font-bold text-lg lg:text-2xl leading-tight">
              {schoolName}
            </h1>
            <span className="text-gray-400 font-medium text-[10px] lg:text-sm hidden sm:block">
              PRIMARY SCHOOL SYSTEM
            </span>
          </div>
        </div>

        <div className="flex flex-row gap-3 lg:gap-6 justify-center items-center">
          <div className="flex flex-col justify-center items-end sm:flex">
            <h3 className="text-gray-900 font-bold text-sm lg:text-lg leading-tight">
              {displayName}
            </h3>
            <span className="text-gray-500 text-xs lg:text-sm">
              {displayRole}
            </span>
          </div>

          {displayPhoto ? (
            <Image
              className="bg-gray-800 rounded-full shrink-0 aspect-square object-cover"
              src={displayPhoto}
              alt="Profile"
              width={44}
              height={44}
              priority
            />
          ) : (
            // Fallback avatar with initials when no photo is set
            <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {currentUser?.first_name?.charAt(0) ?? "?"}
            </div>
          )}

          <Bell color="black" size={20} className="cursor-pointer" />

          {/* Logout — replaces the old students/dashboard link */}
          <button
            onClick={handleLogout}
            className="flex flex-row items-center gap-1.5 text-gray-700 hover:text-red-500 transition-colors text-sm font-medium"
            title="Logout"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </section>

      <section className="page-content flex flex-col mt-4 lg:mt-6 justify-center items-center pb-6">

        {/* ── Controls card ── */}
        <div className="register w-[95%] lg:w-[90%] bg-gray-50 rounded-xl p-4 lg:p-7 shadow-sm">
          <div className="flex flex-row justify-between items-center gap-2 mb-5 lg:mb-8">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-row items-center gap-2">
                <CalendarCheck size={22} className="text-gray-600 shrink-0" />
                <h1 className="font-bold text-lg lg:text-xl text-gray-900">
                  Take Attendance
                </h1>
              </div>
              {isClassLocked && selectedClasses && (
                <span className="text-xs text-blue-500 font-medium ml-8">
                  Locked to: {selectedClasses.name}
                </span>
              )}
            </div>
            <div>
              <button
                onClick={() => showQrAttendance(true)}
                className="text-gray-900 bg-green-400 px-4 py-4 rounded-xl cursor-pointer"
              >
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

            {/* Class selector — disabled when teacher has only one class */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase ml-3 tracking-wider">
                Select Class
              </h4>
              <select
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full disabled:opacity-60 disabled:cursor-not-allowed"
                value={selectedClasses?.id ?? ""}
                disabled={isClassLocked}
                onChange={(e) => {
                  const found = classes.find(
                    (c) => c.id === Number(e.target.value)
                  );
                  setSelectedClasses(found ?? null);
                }}
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase ml-3 tracking-wider">
                Select Subject
              </h4>
              <select
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full disabled:opacity-50"
                value={selectedSubject?.id ?? ""}
                disabled={loadingSubjects || subjects.length === 0}
                onChange={(e) => {
                  const found = subjects.find(
                    (s) => s.id === Number(e.target.value)
                  );
                  setSelectedSubject(found ?? null);
                }}
              >
                {loadingSubjects && <option>Loading...</option>}
                {!loadingSubjects && subjects.length === 0 && (
                  <option>No subjects</option>
                )}
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Current Date
              </h4>
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
                <h2 className="text-2xl lg:text-3xl font-black text-blue-600">
                  {students.length}
                </h2>
                <span className="text-[9px] lg:text-[10px] font-bold text-blue-500 uppercase">
                  Total Students
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-gray-100 border rounded-xl h-16 lg:h-20 flex-1 lg:flex-none lg:px-4">
                <h2 className="text-2xl lg:text-3xl font-black text-green-600">
                  {presentCount}
                </h2>
                <span className="text-[9px] lg:text-[10px] font-bold text-green-500 uppercase">
                  Present
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-gray-100 border rounded-xl h-16 lg:h-20 flex-1 lg:flex-none lg:px-4">
                <h2 className="text-2xl lg:text-3xl font-black text-red-600">
                  {absentCount}
                </h2>
                <span className="text-[9px] lg:text-[10px] font-bold text-red-500 uppercase">
                  Absent
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Student list ── */}
        <div
          className="manual-attendance w-[95%] lg:w-[90%] bg-white shadow-xl rounded-xl mt-6 lg:mt-9"
          style={{ minHeight: "50vh" }}
        >
          <div className="grid grid-cols-12 bg-green-50 px-4 py-3 rounded-t-xl text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-6 sm:col-span-5">Student</div>
            <div className="col-span-3 hidden sm:block">Admission No.</div>
            <div className="col-span-5 sm:col-span-3 text-center">Status</div>
          </div>

          {loadingStudents && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <p className="text-sm text-gray-400 font-medium">
                Loading students...
              </p>
            </div>
          )}

          {!loadingStudents && students.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-gray-400 font-medium">
                {isClassLocked
                  ? "No students found in your assigned class."
                  : "Select a class to load students."}
              </p>
            </div>
          )}

          {!loadingStudents &&
            students.map((student, idx) => {
              const isPresent = student.status === "P";
              const justScanned = lastScanned === student.admission_number;
              return (
                <div
                  key={student.id}
                  className={`grid grid-cols-12 px-4 py-3 items-center border-b border-gray-100 last:border-0 transition-colors ${
                    justScanned
                      ? "bg-green-50"
                      : isPresent
                      ? "bg-white"
                      : "bg-red-50/30"
                  }`}
                >
                  <div className="col-span-1 text-xs text-gray-400 font-mono">
                    {idx + 1}
                  </div>

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
                      <p className="text-xs lg:text-sm font-semibold text-gray-900 truncate">
                        {student.full_name}
                      </p>
                      {justScanned && (
                        <p className="text-[10px] text-green-600 font-semibold">
                          ✓ Just scanned
                        </p>
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
                          ? "bg-green-100 text-green-700 border-gray-100 hover:bg-green-200"
                          : "bg-red-50 text-red-500 border-gray-100 hover:bg-red-100"
                      }`}
                    >
                      {isPresent ? (
                        <>
                          <CheckCircle size={13} /> Present
                        </>
                      ) : (
                        <>
                          <XCircle size={13} /> Absent
                        </>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        setSelectedStudent({
                          id: student.id,
                          name: student.full_name,
                          photo: student.photo_url,
                        })
                      }
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
                  className="flex flex-row bg-white shadow-xl px-4 lg:px-6 py-3 gap-2 lg:gap-3 rounded-xl text-sm lg:text-base flex-1 sm:flex-none justify-center"
                >
                  <History size={20} color="#0077b6" /> Previous Records
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
              {submitting ? (
                <>
                  <Loader2 size={22} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  Save Attendance <SendHorizonal size={22} color="#fff" />
                </>
              )}
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