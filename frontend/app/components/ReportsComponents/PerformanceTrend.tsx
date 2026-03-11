"use client";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    Title,
    Tooltip,
    PointElement,
    Legend,
    TooltipItem,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

interface PerformanceData {
    date: string;
    percentage: number;
}

interface PageProps {
    trendData: PerformanceData[];
}

export default function PerformanceTrendComponent({ trendData }: PageProps) {
    if (!trendData || trendData.length === 0) {
        return <div className="bg-gray-50 p-4 w-full flex items-center justify-center text-gray-400 text-sm">No trend data available</div>;
    }

    const total = trendData.length;
    const tickIndices = new Set<number>();
    [0, Math.floor(total * 0.2), Math.floor(total * 0.4), Math.floor(total * 0.6), Math.floor(total * 0.8), total - 1]
        .forEach(i => tickIndices.add(Math.min(i, total - 1)));

    const labels = trendData.map((item, idx) => {
        if (!tickIndices.has(idx)) return "";
        const d = new Date(item.date);
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
    });


    const chartValues = trendData.map(item => item.percentage);

    const data = {
        labels,
        datasets: [
            {
                label: 'Attendance %',
                data: chartValues,
                fill: true,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.4,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                pointBackgroundColor: trendData.map(item =>
                    item.percentage > 0 ? 'rgb(75, 192, 192)' : 'transparent'
                ),
                pointRadius: trendData.map(item => item.percentage > 0 ? 4 : 0),
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items: { dataIndex: number }[]) => {
                        const idx = items[0].dataIndex;
                        const d = new Date(trendData[idx].date);
                        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
                    },
                    label: (item: TooltipItem<"line">) => `Attendance: ${item.parsed.y}%`,
                },
            },
        },
        scales: {
            y: { beginAtZero: true, max: 100, display: false },
            x: {
                grid: { display: false },
                ticks: { display: true, maxRotation:0, minRotation:0 },
            },
        },
    };

    return (
        <div className="bg-gray-50 p-2 sm:p-4 lg:p-6 w-full">
            <Line data={data} options={options} />
        </div>
    );
}