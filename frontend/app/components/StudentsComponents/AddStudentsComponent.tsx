"use client";
import { useState, useEffect } from "react";
import { X, Upload, User } from "lucide-react";
import Image from "next/image";

interface AddStudentForm {
    admission_number: string;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    gender: string;
    status: string;
    current_class: string;
    parent_name: string;
    parent_phone: string;
    parent_email: string;
    address: string;
    enrollment_date: string;
    photo: File | null;
}

interface ClassOption {
    id: number;
    name: string;
}

export interface StudentData {
    id: number;
    admission_number: string;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    gender: string;
    status: string;
    current_class: number | string;
    parent_name: string;
    parent_phone: string;
    parent_email: string;
    address: string;
    enrollment_date: string;
    photo?: string | null;
}

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    student?: StudentData | null; // null = add mode, object = edit mode
}

const EMPTY_FORM: AddStudentForm = {
    admission_number: "",
    first_name: "",
    last_name: "",
    email: "",
    date_of_birth: "",
    gender: "",
    status: "active",
    current_class: "",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    address: "",
    enrollment_date: "",
    photo: null,
};

const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
};

export default function AddStudentModal({ isOpen, onClose, onSuccess, student }: AddStudentModalProps) {
    const isEditMode = !!student;

    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [formData, setFormData] = useState<AddStudentForm>(() =>
        student ? {
            admission_number: student.admission_number || "",
            first_name: student.first_name || "",
            last_name: student.last_name || "",
            email: student.email || "",
            date_of_birth: student.date_of_birth || "",
            gender: student.gender || "",
            status: student.status || "active",
            current_class: student.current_class?.toString() || "",
            parent_name: student.parent_name || "",
            parent_phone: student.parent_phone || "",
            parent_email: student.parent_email || "",
            address: student.address || "",
            enrollment_date: student.enrollment_date || "",
            photo: null,
        } : EMPTY_FORM
    );
    const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photo ?? null);
    const [error, setError] = useState("");
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch("http://localhost:8000/api/classes/", { credentials: "include" });
                const data = await res.json();
                if (!cancelled && data.success) setClasses(data.data.results || data.data);
            } catch { /* stay empty */ }
        };

        load();
        return () => { cancelled = true; };
    }, [isOpen]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, photo: file });
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== null && value !== "") {
                if (key === "photo" && value instanceof File) {
                    payload.append(key, value);
                } else if (typeof value === "string") {
                    payload.append(key, value);
                }
            }
        });

        // Edit: PATCH to /api/students/{id}/   Add: POST to /api/students/
        const url = isEditMode
            ? `http://localhost:8000/api/students/${student!.id}/`
            : `http://localhost:8000/api/students/`;
        const method = isEditMode ? "PATCH" : "POST";
        const expectedStatus = isEditMode ? 200 : 201;

        try {
            const res = await fetch(url, {
                method,
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                body: payload,
            });

            const data = await res.json();
            setLoading(false);

            if (res.status === expectedStatus) {
                setSuccess(isEditMode ? "Student updated successfully!" : "Student added successfully!");

                // Only generate QR code on create
                if (!isEditMode) {
                    const studentId = data.data?.id;
                    if (studentId) {
                        await fetch(`http://localhost:8000/api/students/${studentId}/generate-qr/`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "X-CSRFToken": getCookie("csrftoken") },
                        });
                    }
                }

                setTimeout(() => {
                    onSuccess?.();
                    handleClose();
                }, 2000);
            } else {
                setError(
                    data.details ? JSON.stringify(data.details) : data.error || "Failed to save student."
                );
            }
        } catch {
            setLoading(false);
            setError("Network error. Please try again.");
        }
    };

    const handleClose = () => {
        setFormData(EMPTY_FORM);
        setPhotoPreview(null);
        setError("");
        setSuccess("");
        setStep(1);
        onClose();
    };

    if (!isOpen) return null;

    const inputClass =
        "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white/70 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-100 transition-all";
    const labelClass = "text-sm font-medium text-gray-500 mb-1 block";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            style={{
                backdropFilter: "blur(20px) saturate(160%)",
                WebkitBackdropFilter: "blur(20px) saturate(160%)",
                backgroundColor: "rgba(220, 235, 220, 0.5)",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div
                className="w-full max-w-lg rounded-2xl overflow-hidden relative flex flex-col"
                style={{
                    background: "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(40px) saturate(180%)",
                    WebkitBackdropFilter: "blur(40px) saturate(180%)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    maxHeight: "90vh",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="font-bold text-gray-900 text-lg lg:text-xl">
                            {isEditMode
                                ? `Edit — ${student?.first_name} ${student?.last_name}`
                                : "Add New Student"}
                        </h2>
                        <span className="text-sm text-gray-400">
                            {isEditMode
                                ? "Update the student details below"
                                : "Fill in student details below"}
                        </span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 shrink-0">
                    {[
                        { n: 1, label: "Basic Info" },
                        { n: 2, label: "Class & Status" },
                        { n: 3, label: "Parent Info" },
                    ].map(({ n, label }) => (
                        <button key={n} onClick={() => setStep(n)} className="flex items-center gap-1.5 group">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    step === n
                                        ? "bg-green-400 text-white"
                                        : step > n
                                        ? "bg-green-100 text-green-600"
                                        : "bg-gray-100 text-gray-400"
                                }`}
                            >
                                {n}
                            </div>
                            <span
                                className={`text-xs hidden sm:block transition-colors ${
                                    step === n ? "text-green-600 font-medium" : "text-gray-400"
                                }`}
                            >
                                {label}
                            </span>
                            {n < 3 && <div className="w-6 h-px bg-gray-200 mx-1 hidden sm:block" />}
                        </button>
                    ))}

                    {/* Edit mode badge */}
                    {isEditMode && (
                        <span className="ml-auto text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                            Editing
                        </span>
                    )}
                </div>

                {/* Alerts */}
                {(error || success) && (
                    <div
                        className={`mx-6 mt-3 px-4 py-2 rounded-lg text-xs shrink-0 ${
                            success
                                ? "bg-green-50 text-green-600 border border-green-100"
                                : "bg-red-50 text-red-500 border border-red-100"
                        }`}
                    >
                        {success || error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
                    <div className="px-6 py-4 space-y-4">

                        {/* ── Step 1: Basic Info ── */}
                        {step === 1 && (
                            <>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-dashed border-green-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {photoPreview ? (
                                            <Image
                                                src={photoPreview}
                                                alt="preview"
                                                width={90}
                                                height={90}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User size={24} className="text-green-300" />
                                        )}
                                    </div>
                                    <div>
                                        <label className="cursor-pointer flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-green-200 transition-colors">
                                            <Upload size={12} />
                                            {isEditMode ? "Change Photo" : "Upload Photo"}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                        </label>
                                        <p className="text-xs text-gray-400 mt-1">Optional · JPG, PNG</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>First Name *</label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="e.g. John"
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Last Name *</label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="e.g. Doe"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Admission Number *</label>
                                    <input
                                        type="text"
                                        name="admission_number"
                                        value={formData.admission_number}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. ADM-2024-001"
                                        className={inputClass}
                                        // Admission number usually shouldn't change on edit
                                        readOnly={isEditMode}
                                        style={isEditMode ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                                    />
                                    {isEditMode && (
                                        <p className="text-xs text-gray-400 mt-1">Admission number cannot be changed</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Date of Birth *</label>
                                        <input
                                            type="date"
                                            name="date_of_birth"
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            required
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Gender *</label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            required
                                            className={inputClass}
                                        >
                                            <option value="">Select</option>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                            <option value="O">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Student Email{" "}
                                        <span className="text-gray-300">(optional)</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="e.g. student@school.edu"
                                        className={inputClass}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Step 2: Class & Status ── */}
                        {step === 2 && (
                            <>
                                <div>
                                    <label className={labelClass}>Class *</label>
                                    <select
                                        name="current_class"
                                        value={formData.current_class}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                    >
                                        <option value="">Select class</option>
                                        {classes.length > 0 ? (
                                            classes.map((cls) => (
                                                <option key={cls.id} value={cls.id}>
                                                    {cls.name}
                                                </option>
                                            ))
                                        ) : (
                                            <option disabled>No classes found</option>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>Status *</label>
                                    <div className="flex gap-2">
                                        {[
                                            { value: "active", label: "Active", color: "green" },
                                            { value: "on_leave", label: "On Leave", color: "yellow" },
                                            { value: "inactive", label: "Inactive", color: "gray" },
                                        ].map(({ value, label, color }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: value })}
                                                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                                                    formData.status === value
                                                        ? color === "green"
                                                            ? "bg-green-400 text-white border-green-400"
                                                            : color === "yellow"
                                                            ? "bg-yellow-400 text-white border-yellow-400"
                                                            : "bg-gray-400 text-white border-gray-400"
                                                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Enrollment Date *</label>
                                    <input
                                        type="date"
                                        name="enrollment_date"
                                        value={formData.enrollment_date}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Step 3: Parent Info ── */}
                        {step === 3 && (
                            <>
                                <div>
                                    <label className={labelClass}>Parent / Guardian Name *</label>
                                    <input
                                        type="text"
                                        name="parent_name"
                                        value={formData.parent_name}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Jane Doe"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Parent Phone *</label>
                                    <input
                                        type="tel"
                                        name="parent_phone"
                                        value={formData.parent_phone}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. +254 712 345 678"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Parent Email{" "}
                                        <span className="text-gray-300">(optional)</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="parent_email"
                                        value={formData.parent_email}
                                        onChange={handleChange}
                                        placeholder="e.g. parent@email.com"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Home Address *</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. 123 Naivasha Road, Nakuru"
                                        rows={3}
                                        className={`${inputClass} resize-none`}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
                            className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            {step > 1 ? "← Back" : "Cancel"}
                        </button>

                        {step < 3 ? (
                            <button
                                type="button"
                                onClick={() => setStep(step + 1)}
                                className="px-5 py-2 bg-green-400 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-white ${
                                    isEditMode
                                        ? "bg-blue-500 hover:bg-blue-600"
                                        : "bg-green-400 hover:bg-green-500"
                                }`}
                            >
                                {loading
                                    ? "Saving..."
                                    : isEditMode
                                    ? "Save Changes ✓"
                                    : "Add Student ✓"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}