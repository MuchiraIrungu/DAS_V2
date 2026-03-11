"use client";

import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AttendanceTrendData{
    day:string;
    date:string;
    percentage:number;
}

interface ChartProps{
    componentData: AttendanceTrendData[];
}

export default function AttendanceChart({componentData}:ChartProps) {

    const data = {
        labels: componentData.map(item => item.day),
        datasets: [
            {
                label: 'Attendance',
                data: componentData.map(item => item.percentage ),
                backgroundColor: 'bg-gray-400',
                borderRadius: 6,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true, max: 100, display: false },
            x: {
                grid: { display: false },
                ticks: { display: true },
            },
        },
    };

    return (
        <div className="bg-gray-50 p-2 sm:p-4 lg:p-6 w-full">
            <Bar data={data} options={options} />
        </div>
    );
}