"use client";
import { useState } from "react";
import Image from "next/image";
import { Scanner, useDevices, outline, boundingBox, centerText } from "@yudiel/react-qr-scanner";
import { CheckCircle, XCircle, Camera, RefreshCw } from "lucide-react";

interface StudentResult {
    student_id: number;
    full_name: string;
    admission_number: string;
    photo_url: string | null;
    class: string | null;
}


interface ScannerPageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    onQrSuccess?:(admmissionNumber:string)=> void;
}

export default function ScannerPage({isOpen, onClose, onQrSuccess}:ScannerPageModalProps) {
    const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
    const [tracker, setTracker] = useState<string>("centerText");
    const [pause, setPause] = useState(false);
    const [student, setStudent] = useState<StudentResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isResseting, setIsResseting] = useState(false);

    const devices = useDevices();

    const getCookie = (name: string): string => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
        return "";
    };

    function getTracker() {
        switch (tracker) {
            case "outline": return outline;
            case "boundingBox": return boundingBox;
            case "centerText": return centerText;
            default: return undefined;
        }
    }

    const handleScan = async (rawValue: string) => {
        if (pause || loading) return;
        setPause(true);
        setLoading(true);
        setError(null);
        setStudent(null);

        try {
            const res = await fetch("http://localhost:8000/api/attendance/validate-qr/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ qr_data: rawValue }),
            });

            const data = await res.json();

            if (data.success) {
                setStudent(data.data);
                setIsResseting(true);

                if(onQrSuccess && data.data.admission_number){
                    onQrSuccess(data.data.admission_number);
                }

                try{

                    const studentData = localStorage.getItem("attendance_data");
                    let currentList = [];

                    try{
                        const parsed = JSON.parse(studentData || "[]");
                        currentList = Array.isArray(parsed) ? parsed : [];
                    }catch(e){
                        currentList = [];
                        console.log(e)
                    }

                    const newStudentData={
                        student_id : data.data.student_id,
                        name : data.data.full_name,
                        admission_number: data.data.admission_number,
                        photo_url: data.data.photo_url,
                        scan_id:Date.now()
                    };

                    //prevent duplicate 
                    const isAdded = currentList.some(
                        (s) => s.admission_number === newStudentData.admission_number
                    );

                    if (!isAdded){
                        const updatedStudentList = [newStudentData, ...currentList].slice(0, 70);
                        localStorage.setItem("attendance_data", JSON.stringify(updatedStudentList));
                        window.dispatchEvent(new Event("storage"));

                        //console.log(newStudentData)
                    }
        
                }catch(storageErr){
                    console.error('LocalStorage failed', storageErr);
                }

                setTimeout(()=>{
                    handleReset();
                    setIsResseting(false);
                }, 3000)
            } else {
                setError(data.error || "Invalid QR code");
            }
        } catch {
            setError("Network error. Please try again.");
            setIsResseting(true);
            setTimeout(()=>{
                handleReset()
                setIsResseting(false)
            },3000);
        } finally {
            setLoading(false);
        }
    };

   

    const handleReset = () => {
        setStudent(null);
        setError(null);
        setPause(false);
    };

    const handleClose = () =>{
        onClose();
    }
    if (!isOpen) return null;

    return (
        <main className="flex flex-col bg-gray-200 w-screen min-h-screen font-lexend">
        
            <section className="w-full lg:w-[85%] h-screen overflow-y-auto flex flex-col items-center justify-center px-4 py-8">
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                {/* Page header */}
                <div className="w-full max-w-2xl mb-6 text-center">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">QR Attendance Scanner</h1>
                    <p className="text-sm text-gray-200 mt-1">Point the camera at a student &rsquo QR code to mark attendance</p>
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4  w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
                        >
                        <XCircle size={25} />
                    </button>
                </div>

                {/* Main glass card */}
                <div
                    className="w-full max-w-2xl rounded-3xl overflow-hidden"
                    style={{
                        background: "rgba(255, 255, 255, 0.75)",
                        backdropFilter: "blur(40px) saturate(180%)",
                        WebkitBackdropFilter: "blur(40px) saturate(180%)",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
                        border: "1px solid rgba(255,255,255,0.6)",
                    }}
                >
                    {/* Controls bar */}
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Camera size={16} className="text-blue-500" />
                            <span className="text-sm font-semibold text-gray-700">Camera Settings</span>
                        </div>
                        <div className="flex flex-row gap-2 w-full sm:w-auto">
                            <select
                                onChange={(e) => setDeviceId(e.target.value || undefined)}
                                className="flex-1 sm:flex-none text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white/70 text-gray-700 focus:outline-none focus:border-blue-400 transition-colors"
                            >
                                <option value="">Default Camera</option>
                                {devices.map((device, index) => (
                                    <option key={index} value={device.deviceId}>
                                        {device.label || `Camera ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                            <select
                                onChange={(e) => setTracker(e.target.value)}
                                className="flex-1 sm:flex-none text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white/70 text-gray-700 focus:outline-none focus:border-blue-400 transition-colors"
                            >
                                <option value="centerText">Center Text</option>
                                <option value="outline">Outline</option>
                                <option value="boundingBox">Bounding Box</option>
                                <option value="">No Tracker</option>
                            </select>
                        </div>
                    </div>

                    {/* Scanner area */}
                    <div className="relative flex items-center justify-center bg-gray-900 overflow-hidden" style={{ minHeight: "360px" }}>
                        {!student && !error && (
                            <Scanner
                                constraints={{ deviceId }}
                                onScan={(detectedCodes) => {
                                    if (detectedCodes.length > 0) {
                                        handleScan(detectedCodes[0].rawValue);
                                    }
                                }}
                                onError={(error) => console.log(`Scanner error: ${error}`)}
                                formats={["qr_code"]}
                                styles={{ container: { height: "360px", width: "100%" } }}
                                components={{
                                    onOff: true,
                                    torch: true,
                                    zoom: true,
                                    finder: true,
                                    tracker: getTracker(),
                                }}
                                allowMultiple={false}
                                scanDelay={2000}
                                paused={pause}
                            />
                        )}

                        {/* Loading overlay */}
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                                <div className="w-10 h-10 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mb-3" />
                                <span className="text-white text-sm font-medium">Validating...</span>
                            </div>
                        )}

                        {/* Success result */}
                        {student && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6"
                                style={{
                                    background: "rgba(240, 255, 244, 0.97)",
                                }}>
                                <CheckCircle size={40} className="text-green-500 mb-4" />
                                <div className="flex flex-col items-center gap-3 text-center">
                                    {student.photo_url && (
                                        <Image
                                            src={student.photo_url}
                                            alt={student.full_name}
                                            width={80}
                                            height={80}
                                            className="rounded-full object-cover border-4 border-green-200 shadow-lg"
                                        />
                                    )}
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{student.full_name}</h2>
                                        <p className="text-sm text-gray-500 mt-1">{student.admission_number}</p>
                                        {student.class && (
                                            <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                                {student.class}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-green-600 font-semibold text-sm">{`${student.full_name} present`}</p>
                                </div>
                                {isResseting &&(
                                    <div className="mt-6 flex items-center gap-2 text-green-600 animate-pulse">
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Ready in 2s...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error result */}
                        {error && !loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6"
                                style={{ background: "rgba(255, 242, 242, 0.97)" }}>
                                <XCircle size={40} className="text-red-400 mb-4" />
                                <h2 className="text-lg font-bold text-gray-900">Scan Failed</h2>
                                <p className="text-sm text-red-500 mt-1 text-center">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-400 text-center sm:text-left">
                            {pause && !student && !error ? "Processing scan..." : "Scanning for QR codes..."}
                        </p>
                        {(student || error) && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                <RefreshCw size={14} />
                                Scan Again
                            </button>
                        )}
                    </div>
                </div>

                {/* Hint */}
                <p className="mt-4 text-xs text-gray-200 text-center">
                    Make sure the QR code is well lit and fully visible in the camera frame
                </p>
                </div>
            </section>
        </main>
    );
}