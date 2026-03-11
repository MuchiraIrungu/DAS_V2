"use client";

import React from "react";
import { 
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell, 
    getKeyValue
} from "@heroui/table";

interface AttendanceTableData{
    teacher:string;
    class_name:string;
    submission_time:string;
    present: number;
    total:number;
    status:"completed" |  "pending";
}

interface PageProps{
    submissionTable:AttendanceTableData[]
}

export default function AttendanceTable({submissionTable}:PageProps) {

    console.log("Raw Prop:", submissionTable); // Is this an array?
    
    
    const rowData =(submissionTable || []).map((item,index) =>({
        key:(index + 1).toString(),
        Teacher:item.teacher,
        class:item.class_name,
        submission_time:item.status === 'pending' ? '--:--' : item.submission_time,
        present:item.status === 'pending' ? '__' : `${item.present}/${item.total}`,
        status:item.status.charAt(0).toUpperCase() + item.status.slice(1)
    })) 

    console.log("Mapped RowData:", rowData); 

    const columns = [
        {
            key:"Teacher",
            label:'TEACHER',
        },
        {
            key:"class",
            label:'CLASS',
        },
        {
            key:"submission_time",
            label:'SUBMISSION TIME',
        },
        {
            key:"present",
            label:'PRESENT',
        },
        {
            key:"status",
            label:'STATUS',
        }
    ]

    return (
        <div className="overflow-x-auto w-full">
            <Table aria-label="attendance submission" className="min-w-120">
                <TableHeader columns={columns}>
                    {(col) => (
                        <TableColumn
                            className="bg-gray-200 text-[10px] lg:text-xs whitespace-nowrap"
                            key={col.key}
                        >
                            {col.label}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody items={rowData}>
                    {(item) => (
                        <TableRow key={item.key} className="border-b border-gray-200 py-3 lg:py-4">
                            {(columnKey) => (
                                <TableCell className="text-xs lg:text-sm">
                                    {columnKey === "status" ? (
                                        <span className={`font-semibold ${
                                            item.status === 'Pending' ? 'text-orange-500' : 'text-green-600'
                                        }`}>
                                            {item.status}
                                        </span>
                                    ) : (
                                        getKeyValue(item, columnKey)
                                    )}
                                </TableCell>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}