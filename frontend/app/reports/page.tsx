"use client";
import React, { useEffect, useState } from "react";
import Sidebar from "../components/SidebarComponent";
import { Calendar, ChevronDown, CopyIcon, Copyright, Dot, File, ListFilter, MoveRight, TrendingUp, TriangleAlert, Users } from "lucide-react";
import PerformanceTrendComponent from "../components/ReportsComponents/PerformanceTrend";
import GradeAttendanceComponent from "../components/ReportsComponents/GradeTrend";
import ClassPerformanceComponent from "../components/ReportsComponents/ClassPerformanceTable";
import { API_PATH } from "../lib/path";


interface ReportsData{
    avg_attendance:number,
    flagged_absences:number,
    total_students:number,

    attendance_trends:{
        date : string,
        percentage:number,
    }[],
    attendance_by_grade:{
        grade: string,
        absences: number,
        percentage:number,
    }[],
    classroom_performance:{
        classroom:string,
        teacher:string,
        students:number,
        attendance_percentage:number,
        status:'exemplary'|'on_track'|'review_needed',
    }[],

}

export default function StudentReports() {
    const [range, setRange] = useState('30');
    const [grade, setGrade] = useState('All Grades');
    const [reportsData, setReportsData] = useState<ReportsData | null>(null)
    const currentYear = new Date().getFullYear();

    useEffect(()=>{
        const fetchReportsData = async() =>{
            const res = await fetch(`${API_PATH}/api/attendance/reports/attendance-summary/`,{
                method:'GET',
                credentials:'include'
            })

            const data = await res.json()
            console.log(data)

            if(res.status === 200){
                setReportsData(data.data)
            }
        }

        fetchReportsData();
    },[])

    const tabs = [
        { index: 1, icon: Users, title: 'Total Students', value:`${reportsData?.total_students}`, color: 'text-blue-800', bgColor: 'bg-blue-100' },
        { index: 2, icon: TrendingUp, title: 'Avg. Attendance', value: `${reportsData?.avg_attendance}`, color: 'text-green-800', bgColor: 'bg-green-100' },
        { index: 3, icon: TriangleAlert, title: 'Flagged Abscences', value: `${reportsData?.flagged_absences}`, color: 'text-red-800', bgColor: 'bg-red-100' },
    ];

    return (
        <main className="min-h-screen w-screen bg-gray-200 flex flex-row reports overflow-hidden gap-2 lg:gap-5">
            <Sidebar />
            <section className="w-full lg:w-[82%]  h-screen shrink-0 flex flex-col overflow-y-scroll items-center px-2 lg:px-0">

                <div className="page-info flex flex-col sm:flex-row h-auto sm:h-[10vh] min-h-16 w-full mt-2 rounded-xl justify-between items-start sm:items-center p-3 lg:p-5 gap-3 sm:gap-0">
                    <header className="flex flex-col">
                        <h1 className="text-gray-900 font-bold text-lg lg:text-2xl">Attendance Reports</h1>
                        <span className="text-sm lg:text-md text-gray-700">Review analytics and student attendance performance</span>
                    </header>
                    <div className="buttons flex flex-row gap-3 lg:gap-4 w-full sm:w-auto">
                        <button className="bg-white flex-1 sm:flex-none sm:w-28 h-9 lg:h-10 rounded-lg cursor-pointer text-gray-800 gap-2 flex flex-row justify-center items-center shadow-sm shadow-gray-600 text-sm">
                            <File size={16} /> Excel
                        </button>
                        <button className="bg-blue-800 gap-2 rounded-lg cursor-pointer text-white flex-1 sm:flex-none sm:w-34 h-9 lg:h-10 flex flex-row justify-center items-center shadow-sm shadow-blue-500 text-sm px-3">
                            <CopyIcon size={16} /> Export PDF
                        </button>
                    </div>
                </div>

                <div className="select-tab flex flex-col sm:flex-row h-auto sm:h-[13vh] min-h-20 w-full mt-2 bg-gray-50 rounded-xl shadow-lg shadow-gray-300 justify-between items-start sm:items-center p-4 lg:p-5 gap-4 sm:gap-0">
                    <div className="flex flex-row flex-wrap gap-5 lg:gap-10">
                        <div className="flex flex-col text-gray-700">
                            <h3 className="text-xs lg:text-sm font-semibold mb-1">DATE RANGE</h3>
                            <div className="relative flex items-center bg-gray-200 text-gray-800 px-3 lg:px-4 py-2 rounded-xl cursor-pointer gap-2">
                                <Calendar size={16} />
                                <select
                                    value={range}
                                    onChange={(e) => setRange(e.target.value)}
                                    className="appearance-none bg-transparent font-semibold text-slate-700 text-sm pr-2 focus:outline-none cursor-pointer z-10"
                                >
                                    <option value="7">Last 7 Days</option>
                                    <option value="30">Last 30 Days</option>
                                    <option value="90">Last 90 Days</option>
                                    <option value="365">Last Year</option>
                                </select>
                                <ChevronDown size={16} />
                            </div>
                        </div>

                        <div className="flex flex-col text-gray-700">
                            <h3 className="text-xs lg:text-sm font-semibold mb-1">GRADE LEVEL</h3>
                            <div className="relative flex items-center bg-gray-200 text-gray-800 px-3 lg:px-4 py-2 rounded-lg cursor-pointer gap-2">
                                <ListFilter size={16} />
                                <select
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    className="appearance-none bg-transparent font-semibold text-slate-700 text-sm pr-4 focus:outline-none cursor-pointer z-10"
                                >
                                    <option value="7">All Grades</option>
                                    <option value="30">Grade 3B</option>
                                    <option value="90">Grade 4C</option>
                                    <option value="365">Grade 5G</option>
                                </select>
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    <button className="bg-gray-300 text-gray-700 px-4 py-2 font-bold rounded-lg text-sm w-full sm:w-auto">
                        Reset Filters
                    </button>
                </div>


                <div className="select-tab grid grid-cols-1 sm:grid-cols-3 h-auto w-full mt-2 rounded-xl gap-3 p-2 lg:p-0 lg:gap-2 lg:flex lg:flex-row lg:justify-between lg:items-center lg:px-4 lg:py-2">
                    {tabs.map((item, index) => (
                        <div key={index} className="w-full lg:w-[30%] flex flex-row bg-gray-50 gap-3 lg:gap-4 shadow-lg shadow-gray-300 rounded-xl justify-start items-center p-4 lg:p-5 lg:px-9">
                            <div className={`${item.bgColor} px-3 lg:px-4 py-2 lg:py-3 rounded-full shrink-0`}>
                                <item.icon size={18} className={`${item.color}`} />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-gray-500 font-bold text-sm lg:text-base">{item.title}</h1>
                                <span className="text-gray-900 font-bold text-xl lg:text-2xl">{item.value}</span>
                            </div>
                        </div>
                    ))}
                </div>

           
                <div className="graphs flex flex-col xl:flex-row gap-4 lg:gap-5 w-full mt-4 rounded-xl">
                    <div className="flex flex-col w-full xl:w-[50%] bg-white rounded-lg shadow-lg shadow-blue-100" style={{ minHeight: '300px' }}>
                        <div className="flex flex-row justify-between p-4">
                            <div className="flex flex-col">
                                <h3 className="text-gray-900 font-bold text-sm lg:text-md">Attendance Trends</h3>
                                <span className="text-gray-500 font-medium text-xs">Daily average percentage over the last month</span>
                            </div>
                            <div>
                                <span className="text-gray-600 flex flex-row justify-center items-center gap-1 text-xs lg:text-sm">
                                    <Dot strokeWidth={16} className="text-blue-600" size={16} /> Current Period
                                </span>
                            </div>
                        </div>
                        <PerformanceTrendComponent trendData={reportsData?.attendance_trends || []} />
                    </div>

                    <div className="flex flex-col w-full xl:w-[50%] overflow-hidden bg-white shadow-lg shadow-blue-100 rounded-lg gap-2 p-4 lg:p-6" style={{ minHeight: '300px' }}>
                        <div className="flex flex-col">
                            <h3 className="text-gray-900 font-bold text-sm lg:text-md">Attendance by Grade</h3>
                            <span className="text-gray-500 font-medium text-xs">Distribution of absences by grade level</span>
                        </div>
                        <GradeAttendanceComponent gradeData={reportsData?.attendance_by_grade || []} />
                    </div>
                </div>

                <div className="flex flex-col bg-white w-full mt-5 rounded-lg shrink-0" style={{ minHeight: '320px' }}>
                    <header className="flex flex-col sm:flex-row w-full px-4 lg:px-6 py-3 lg:py-2 justify-between items-start sm:items-center gap-2 sm:h-20">
                        <h1 className="text-gray-900 font-bold text-base lg:text-xl">Classroom Performance Breakdown</h1>
                        <a href="" className="text-blue-500 flex flex-row items-center gap-2 font-bold text-sm shrink-0">
                            View Detailed Log <MoveRight size={16} />
                        </a>
                    </header>
                    <div className="overflow-x-auto">
                        <ClassPerformanceComponent performanceData={reportsData?.classroom_performance || []} />
                    </div>
                </div>

                <div className="flex flex-row h-[10vh] shrink-0 w-full mt-5 justify-center items-center">
                    <span className="text-gray-700 flex flex-row flex-wrap justify-center items-center text-xs lg:text-sm text-center gap-1">
                        <Copyright size={14} /> {currentYear} EduTrack Systems <Dot size={14} /> All reports are based on synchronized school daily logs
                    </span>
                </div>
            </section>
        </main>
    );
}