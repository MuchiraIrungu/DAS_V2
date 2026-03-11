"use client";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";


interface PerformanceData{
    classroom:string,
    teacher:string,
    students:number,
    attendance_percentage:number,
    status:'exemplary'|'on_track'|'review_needed',
}

interface PageProps{
    performanceData:PerformanceData[];
}


export default function ClassPerformanceComponent({performanceData}:PageProps) {

    const getStatus = (status: string): string => {
        if (status === 'exemplary') return "Exemplary";
        if (status === 'on_track') return "On Track";
        return "Review Needed";
    };

    const rowData=(performanceData || []).map((item,index)=>({
        id: (index + 1).toString(),
        class: item.classroom,
        teacher:item.teacher,
        students: item.students,
        attendance:item.attendance_percentage,
        status:getStatus(item.status)
    }))

    return (
        <div className="w-full h-full overflow-x-auto flex flex-col">
            <Table
                aria-label="Class Performance Table"
                removeWrapper
                className="min-w-130"
            >
                <TableHeader className="px-5 bg-gray-400">
                    <TableColumn className="text-gray-500 bg-green-50 text-xs lg:text-[15px] font-bold px-3 lg:px-6 uppercase">Class</TableColumn>
                    <TableColumn className="text-gray-500 bg-green-50 text-xs lg:text-[15px] font-bold uppercase">Lead Teacher</TableColumn>
                    <TableColumn className="text-gray-500 bg-green-50 text-xs lg:text-[15px] font-bold uppercase">Students</TableColumn>
                    <TableColumn className="text-gray-500 bg-green-50 text-xs lg:text-[15px] font-bold uppercase">Attendance</TableColumn>
                    <TableColumn className="text-gray-500 bg-green-50 text-xs lg:text-[15px] font-bold uppercase">Status</TableColumn>
                </TableHeader>

                <TableBody>
                    {(rowData).map((item) => (
                        <TableRow key={item.id} className="border-b border-gray-100 h-11 lg:h-12">
                            <TableCell className="font-bold text-gray-800 text-xs lg:text-sm px-3 lg:px-6">{item.class}</TableCell>
                            <TableCell className="text-gray-600 text-xs lg:text-sm">{item.teacher}</TableCell>
                            <TableCell className="text-gray-600 text-xs lg:text-sm pl-3 lg:pl-6">{item.students}</TableCell>

                            <TableCell>
                                <div className="flex flex-row gap-2 w-24 lg:w-32 justify-center items-center">
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${
                                                (item.attendance) >= 90
                                                    ? 'bg-green-600'
                                                    : (item.attendance) >= 80
                                                        ? 'bg-blue-400'
                                                        : 'bg-amber-400'
                                            }`}
                                            style={{ width: `${item.attendance}%` }}
                                        />
                                    </div>
                                    <span className={`text-[10px] lg:text-xs font-bold whitespace-nowrap ${
                                        (item.attendance) >= 90
                                            ? 'text-green-700'
                                            :(item.attendance) >= 80
                                                ? 'text-blue-700'
                                                : 'text-amber-600'
                                    }`}>
                                        {item.attendance}%
                                    </span>
                                </div>
                            </TableCell>

                            <TableCell>
                                <span className={`px-2 lg:px-3 py-1 rounded-full text-[9px] lg:text-[10px] font-bold ${
                                    getStatus(item.status) === 'Exemplary'
                                        ? 'bg-green-100 text-green-700'
                                        : getStatus(item.status) === 'On Track'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {getStatus(item.status)}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}