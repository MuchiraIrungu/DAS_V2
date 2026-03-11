"use client";
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/SidebarComponent";
import { Bell, Cake, TrendingUp, UserPlus, UserRound } from "lucide-react";
import Image from "next/image";
import StudentRecords from "../components/StudentsComponents/StudentRecords";
import AddStudentModal, { StudentData } from "../components/StudentsComponents/AddStudentsComponent";


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

    // Delete state
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tabs = [
        { index: 1, title: 'Total Active Students', value: tabData?.total_active.toString() || '0', icon: UserRound },
        { index: 2, title: 'Avg. Attendance', value: tabData?.avg_attendance ? `${tabData.avg_attendance}%` : '...', icon: TrendingUp },
        { index: 3, title: 'Birthdays Today', value: tabData?.birthdays_today.toString() || '0', icon: Cake },
    ];

    useEffect(() => {
        const buildUrl = () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (gradeFilter !== 'all') params.append('grade', gradeFilter);
            return `http://localhost:8000/api/students/?${params.toString()}`;
        };

        const fetchTabData = async () => {
            const res = await fetch(buildUrl(), {
                method: 'GET',
                credentials: 'include'
            });
            const data = await res.json();
            if (res.status === 200) {
                setTabData(data.statistics);
            }
        };

        const timer = setTimeout(() => {
            fetchTabData();
        }, 500);

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
                    if (res.status === 200 || res.status === 204) {
                        setRefetchKey((k) => k + 1);
                    }
                })
                .finally(() => {
                    setDeleting(false);
                    setDeleteConfirmId(null);
                });
        } else {
            // First click → arm
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

                {/* Filters + Add button */}
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
                            <select
                                value={gradeFilter}
                                onChange={(e) => setGradeFilter(e.target.value)}
                                className="bg-white text-gray-800 px-3 lg:px-4 py-1.5 rounded-lg border shadow-md border-green-200 text-xs lg:text-sm flex-1 sm:flex-none"
                            >
                                <option value="all">All Grades</option>
                                <option value="1">Grade 1</option>
                                <option value="2">Grade 2</option>
                                <option value="3">Grade 3</option>
                                <option value="4">Grade 4</option>
                                <option value="5">Grade 5</option>
                                <option value="6">Grade 6</option>
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
                        <div className="new-user w-full sm:w-auto">
                            <button
                                className="bg-green-400 text-gray-900 items-center justify-center cursor-pointer flex flex-row px-3 lg:px-4 text-xs lg:text-sm py-2 shadow-lg rounded-lg gap-2 w-full sm:w-auto"
                                onClick={() => setShowAddStudent(true)}
                            >
                                <UserPlus size={14} /> Add New Student
                            </button>
                        </div>
                    </div>
                </div>

                {/* Student Table — layout identical, just wired with props */}
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

            {/* Single modal — handles both Add and Edit */}
            <AddStudentModal
                key={editingStudent?.id ?? 'new'}
                isOpen={showAddStudent || !!editingStudent}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                student={editingStudent}
            />
        </main>
    );
}