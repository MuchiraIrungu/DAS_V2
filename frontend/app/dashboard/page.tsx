"use client";
import React, { useEffect, useState } from "react";
import Sidebar from "../components/SidebarComponent";
import { Bell, Users2Icon, CheckCheck, Album, UserX, ChevronDown, Download } from "lucide-react";
import Image from "next/image";
import AttendanceChart from "../components/DashboardComponents/AttendanceChart";
import StaffPerformance from "../components/DashboardComponents/StaffPerformance";
import AttendanceTable from "../components/DashboardComponents/AttendanceTable";


interface User{
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
}

interface Attendance{
    percentage:number;
    status:"active" | "warning";
}
interface StatsData {
    total_students: number;
    students_change_percentage:number;
    active_classes: number;
    total_absentees_today: number;
    alert: boolean;
    todays_attendance: Attendance;
}

interface AttendanceData{
    weekly_attendance_trend:{
        day:string;
        date:string;
        percentage:number;
    }[];
    staff_performance:{
        teacher: string;
        grade:string;
        submission_status:string;
        status:"completed" |  "pending";
    }[],
    recent_submissions:{
        teacher:string;
        class_name:string;
        submission_time:string;
        present: number;
        total:number;
        status:"completed" |  "pending";
    }[],
}


export default function Dashboard() {
    const Icon = Bell;
    const [username, setUsername] = useState<User |null>(null);
    const [ tabData, setTabData] = useState<StatsData | null>(null);
    const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)


    const tabs = [
        { index: 1, icon: Users2Icon, stats: `${tabData?.students_change_percentage ?? 0} %`, name: 'Total Students', value: tabData?.total_students ?? 0, iconColor: '1976d2', bgColor: '#e3f2fd', val: 'increase' },
        { index: 2, icon: CheckCheck, stats: tabData?.todays_attendance.status ?? 'warning', name: 'Todays Attendance', value: `${tabData?.todays_attendance.percentage ?? 0} %`, iconColor: '1976d2', bgColor: '#e3f2fd' },
        { index: 3, icon: Album, stats: '', name: 'Active Classes', value: tabData?.active_classes ?? 0, iconColor: 'ff7b00', bgColor: '#ffe169', val: 'increase' },
        { index: 4, icon: UserX, stats:tabData?.alert ? 'High' : 'Normal', name: 'Total Absentees Today', value: tabData?.total_absentees_today ?? 0, iconColor: 'ba181b', bgColor: '#ff8fa3', val: 'alert' },
    ];

    useEffect(()=>{
        const fetchUser = async() =>{
            const res = await fetch('http://localhost:8000/api/auth/me',{
                method:'GET',
                credentials:"include",
            })

            const data = await res.json();

            if (res.status === 200){
                setUsername(data.user);
            }
        }

        const fetchDashboardData = async() =>{
            const res = await fetch('http://localhost:8000/api/attendance/dashboard/stats/',{
                method:'GET',
                credentials:'include'
            })

            const data = await res.json();
            console.log(data)

            if(res.status === 200 && data.success){
                setTabData(data.data.statistics);
                setAttendanceData(data.data);
            }
        }  


        fetchUser();
        fetchDashboardData();
    },[])

    return (
        <main className="bg-[#dee2e6] min-h-screen w-screen flex flex-row gap-2 lg:gap-5">
            <Sidebar />
            
            <section className="h-screen w-full lg:w-[82%] pt-4 lg:pt-6 dashboard overflow-y-scroll overflow-x-hidden">

                {/* Top navbar */}
                <div className="bg-white dash-navbar rounded-lg px-3 lg:px-5 pt-2 pb-2 mb-4 lg:mb-7 flex flex-row justify-between items-center mx-2 lg:mx-0">
                    <div className="flex flex-col text-black">
                        <h1 className="text-sm sm:text-base lg:text-xl">Maplewood Primary School</h1>
                        <span className="text-[#6c757d] text-xs sm:text-sm">Welcome back, Administrator</span>
                    </div>
                    <div className="gap-3 lg:gap-6 flex flex-row justify-center items-center">
                        <Icon size={18} color="#6c757d" />
                        <div className="w-[0.9px] h-10 bg-[#adb5bd] hidden sm:block"></div>
                        <div className="flex flex-row gap-2 lg:gap-4">
                            <div className="flex flex-col text-end  sm:flex">
                                <h3 className="text-black text-sm lg:text-lg font-bold uppercase">{username?.username || 'Maplewood Johnson'}</h3>
                                <span className="text-xs lg:text-sm text-[#6c757d] uppercase">{username?.role || ''}</span>
                            </div>
                            <Image
                                className="white:invert bg-black rounded-full"
                                src="/image1.jpg"
                                alt="Next.js logo"
                                width={50}
                                height={50}
                                priority
                            />
                        </div>
                    </div>
                </div>

                {/* Stats cards */}
                <div className="w-full p-2 lg:p-4 grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-6 mb-2">
                    {tabs.map((item) => {
                        const textBgColor = (item.val === 'alert') ? 'bg-red-100' : 'bg-green-100';
                        const textColor = (item.val === 'alert') ? 'text-red-600' : 'text-green-600';
                        return (
                            <div key={item.index} className="bg-white p-3 lg:p-4 rounded-xl flex flex-col justify-between shadow-md">
                                <div className="flex flex-row gap-2 justify-between items-center">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.bgColor }}>
                                        <item.icon size={20} style={{ color: `#${item.iconColor}` }} />
                                    </div>
                                    <div className={`px-2 h-7 rounded-xl flex items-center justify-center ${textBgColor}`}>
                                        <span className={`text-xs font-semibold ${textColor}`}>{item.stats}</span>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <p className="text-gray-500 text-xs lg:text-sm font-medium">{item.name}</p>
                                    <h3 className="text-xl lg:text-2xl font-bold text-gray-800">{item.value}</h3>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Charts section */}
                <div className="performance-tabs w-full gap-4 lg:gap-10 flex flex-col xl:flex-row mb-4 lg:mb-6 px-2 lg:px-0">
                    {/* Attendance chart */}
                    <div className="performance-graph w-full xl:w-[65%] bg-gray-50 shadow-xl p-4 lg:p-5 rounded-2xl">
                        <div className="flex items-center justify-between w-full mb-4 lg:mb-6">
                            <header className="flex flex-col">
                                <h1 className="text-base lg:text-xl font-bold text-gray-900 tracking-tight">Weekly Attendance Trend</h1>
                                <span className="text-xs lg:text-sm text-gray-500 font-medium hidden sm:block">Percentage of attendance over the school week</span>
                            </header>
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-200 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 transition-all shrink-0">
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Last 7 days</span>
                                <ChevronDown size={14} className="text-gray-500" />
                            </div>
                        </div>
                        <AttendanceChart componentData={attendanceData?.weekly_attendance_trend || []} />
                    </div>

                    {/* Staff performance */}
                    <div className="staff-performance w-full xl:w-[35%] shadow-xl bg-gray-50 p-4 lg:p-6 rounded-2xl">
                        <div>
                            <h1 className="text-base lg:text-xl font-bold text-gray-900 mb-6 mt-2 lg:mb-8">Staff Performance</h1>
                            <StaffPerformance performanceData={attendanceData?.staff_performance || []} />
                        </div>
                        <button className="flex flex-row mt-4 h-[6vh] min-h-11 w-full bg-[#007cbe] text-gray-50 justify-center items-center text-center rounded-xl p-2 gap-3 lg:gap-5">
                            <Download size={15} />
                            <span className="text-sm lg:text-base">Export Weekly Report</span>
                        </button>
                    </div>
                </div>

                {/* Attendance table */}
                <div className="w-full mb-5 px-2 lg:px-0">
                    <div className="submission-table bg-gray-50 shadow-lg rounded-2xl w-full p-2 text-gray-900">
                        <header className="justify-between items-center flex flex-row px-3 lg:px-8 p-4 lg:p-6">
                            <h3 className="text-gray-900 font-bold text-sm lg:text-xl">Recent Attendance Submissions</h3>
                            <a href="" className="text-blue-700 font-bold text-xs lg:text-md shrink-0 ml-2">View All Entries</a>
                        </header>
                        <div className="overflow-x-auto">
                            <AttendanceTable submissionTable={attendanceData?.recent_submissions || []} />
                        </div>
                    </div>
                </div>

            </section>
        </main>
    );
}