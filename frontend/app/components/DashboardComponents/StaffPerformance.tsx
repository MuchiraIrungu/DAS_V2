"use client";

import React from "react";
import { CircleCheck, Clock } from "lucide-react";
import Image from "next/image";

interface StaffPerformanceComponent{
    teacher: string;
    grade:string;
    submission_status:string;
    status:"completed" |  "pending";
}

interface PerformanceProps{
    performanceData: StaffPerformanceComponent[];
}

export default function StaffPerformance({performanceData}:PerformanceProps) {
    
    if (!performanceData || performanceData.length === 0) {
        return <div className="text-gray-500 text-sm italic">No recent performance data.</div>;
    }

    return (
        <div className="flex flex-col gap-3 lg:gap-5 w-full mt-12 overflow-auto">
            {performanceData.map((item, idx) => {
                const Icon = item.status === 'pending' ? Clock : CircleCheck;
                const iconColor = item.status === 'pending' ? 'text-gray-400' : 'text-green-800';

                return (
                    <div key={idx} className="flex flex-col">
                        <div className="flex flex-row gap-3 lg:gap-5 justify-between items-center">
                            <Image
                                className="bg-blue-200 rounded-full shrink-0"
                                src={'/image1.jpg'}
                                alt="NA"
                                width={44}
                                height={44}
                                priority
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                                <h3 className="font-bold text-sm lg:text-md text-gray-900 truncate">{item.teacher}</h3>
                                <span className="font-medium text-xs lg:text-sm text-gray-600 truncate">{item.grade} · {item.submission_status}</span>
                            </div>
                            <Icon className={`${iconColor} shrink-0`} size={22} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}