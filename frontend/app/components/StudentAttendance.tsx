"use client";
import React, { useEffect, useState } from "react";
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

type HeroKey = string | number;

interface Student {
    id: number;
    image: string;
    name: string;
    studentId: string;
    status: 'present' | 'absent' | null;
}

interface APIStudent {
    id: number;
    admission_number: string;
    name: string;
    photo_url:string | null;

}


export default function StudentAttendanceRecords() {
    const [allRows, setAllRows] = useState<Student[]>([]);
    const [students, setStudents] = useState<Student[]>(allRows);

    const setStatus = (id: number, newStatus: 'present' | 'absent') => {
        setStudents(prev => prev.map(s =>
            s.id === id ? { ...s, status: newStatus } : s
        ));
    };

    useEffect(() => {

        const attendanceData = () => {
            const data = localStorage.getItem('attendance_data');
            if (data) {
                try {
                    const parsed = JSON.parse(data);

                    if (Array.isArray(parsed)){
                        const mapped: Student[] = parsed.map((s: APIStudent, i: number) => ({
                            id: i + 1,
                            image: s.photo_url || "/image1.jpg",
                            name: s.name,
                            studentId: s.admission_number,
                            status: "present",
                        }));
                        setAllRows(mapped);
                        setStudents(mapped);
                    }else{
                        console.error("Data is not an array, clearing storage...");
                        localStorage.removeItem('attendance_data');
                    }
                } catch (e) {
                    console.error("Failed to parse attendance_data", e);
                }
            }
        };

        attendanceData();
        window.addEventListener('storage', attendanceData);
        return () => window.removeEventListener('storage', attendanceData);
    }, []);

    const renderCell = (item: Student, columnKey: HeroKey) => {
        switch (columnKey) {
            case "image":
                return (
                    <Image
                        src={item.image}
                        alt={item.name}
                        width={36}
                        height={36}
                        className="rounded-full aspect-square object-cover border border-gray-200 w-8 h-8 lg:w-10 lg:h-10"
                    />
                );
            case "name":
                return (
                    <div className="flex flex-col">
                        <p className="font-bold text-gray-900 text-sm lg:text-base">{item.name}</p>
                        <p className="text-[10px] lg:text-xs text-gray-400 hidden sm:block">Student ID : {item.studentId}</p>
                    </div>
                );
            case "status":
                return (
                    <div className="flex flex-row justify-center">
                        <div className="flex flex-row w-auto sm:w-[60%] lg:w-[40%] h-10 lg:h-12 bg-gray-100 gap-1 lg:gap-3 justify-center items-center rounded-2xl px-1">
                            <button
                                onClick={() => setStatus(item.id, 'present')}
                                className={`px-2 lg:px-4 py-2 lg:py-3 rounded-lg text-[10px] lg:text-xs font-bold transition-all ${
                                    item.status === 'present'
                                        ? 'bg-white text-green-600'
                                        : 'text-black'
                                }`}
                            >
                                PRESENT
                            </button>
                            <button
                                onClick={() => setStatus(item.id, 'absent')}
                                className={`px-2 lg:px-4 py-2 lg:py-3 rounded-lg text-[10px] lg:text-xs font-bold transition-all ${
                                    item.status === 'absent'
                                        ? 'bg-white text-red-600'
                                        : 'text-black'
                                }`}
                            >
                                ABSENT
                            </button>
                        </div>
                    </div>
                );
            default:
                return getKeyValue(item, columnKey as string);
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="grow overflow-y-auto overflow-x-auto text-gray-600">
                <Table
                    aria-label="Student Attendance Table"
                    removeWrapper
                    className="min-w-full"
                >
                    <TableHeader className="bg-gray-400">
                        <TableColumn key="image" className="bg-gray-100 h-10 rounded-tl-2xl text-xs pl-6 lg:text-sm">PHOTO</TableColumn>
                        <TableColumn key="name" className="bg-gray-100 h-10 text-xs pl-20 lg:text-sm">STUDENT NAME</TableColumn>
                        <TableColumn key="status" className="bg-gray-100 h-10 rounded-tr-2xl pl-14 text-center text-xs lg:text-sm">ATTENDANCE STATUS</TableColumn>
                    </TableHeader>
                    <TableBody items={students}>
                        {(item) => (
                            <TableRow key={item.id} className="border-b border-gray-100 last:border-0 h-14 lg:h-16 ">
                                {(columnKey) => (
                                    <TableCell className="pl-20 first:pl-6">{renderCell(item, columnKey as HeroKey)}</TableCell>
                                )}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="pt-3 border-t mt-auto bg-gray-100 rounded-b-xl p-3">
                <p className="text-xs lg:text-sm text-gray-900 italic">
                    Showing <span className="font-bold text-gray-800">{students.length}</span> students from Grade 3-A.{' '}
                    <span className="ml-1 text-blue-500 underline decoration-dotted">Scroll to see all. Scroll further down to submit</span>
                </p>
            </div>
        </div>
    );
}