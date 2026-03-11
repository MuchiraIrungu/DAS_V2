"use client";

import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface GrateTrendData {
    grade: string,
    absences: number,
    percentage:number,
}

interface GradeProps{
    gradeData: GrateTrendData[];
}

const COLORS = ['#023e8a', '#3fa34d', '#fb8b24', '#7209b7'];

export default function GradeAttendanceComponent({gradeData}:GradeProps) {
    const totalAbsences = gradeData.reduce((sum, item) => sum + item.absences, 0);

    const data = {
        labels: gradeData.map(d => d.grade),
        datasets: [{
            data: [45, 25, 15, 15],
            backgroundColor: gradeData.map((_, i) => COLORS[i % COLORS.length]),
            hoverOffset: 4,
            borderWidth: 0,
            cutout: '65%',
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between p-2 lg:p-4 h-full w-full gap-4 lg:gap-10 items-center">
            <div className="relative shrink-0 mx-auto sm:mx-0" style={{ width: '160px', height: '160px' }}>
                <Doughnut data={data} options={options} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-xl lg:text-2xl font-bold text-slate-800 leading-none tracking-tight">{totalAbsences}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-tight">
                        Total<br />Absences
                    </span>
                </div>
            </div>

            <div className="flex-1 space-y-3 lg:space-y-4 w-full sm:w-auto">
                {gradeData.map((item, i) => (
                    <div key={i} className="flex items-center justify-start gap-2 lg:gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-2xl shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs lg:text-sm font-semibold text-slate-600">{item.grade}</span>
                        </div>
                        <span className="text-xs lg:text-sm font-bold text-slate-800">({item.percentage}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}