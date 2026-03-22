"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LoginForm {
    email: string;
    password: string;
    remember_me: boolean;
}

interface RequestAccessForm {
    full_name: string;
    email: string;
    school: string;
    message: string;
}

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginForm>({
        email: "",
        password: "",
        remember_me: false,
    });

    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestForm, setRequestForm] = useState<RequestAccessForm>({
        full_name: "",
        email: "",
        school: "",
        message: "",
    });
    const [requestError, setRequestError] = useState("");
    const [requestSuccess, setRequestSuccess] = useState("");
    const [requestLoading, setRequestLoading] = useState(false);
    const [loginError, setLoginError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRequestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRequestForm({ ...requestForm, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginError("");

        //fetch token
        const csrfRes = await fetch("http://localhost:8000/api/auth/csrf/",{
            credentials:'include'
        });

        const { csrfToken } = await csrfRes.json();

        //Login logic
        const response = await fetch("http://localhost:8000/api/auth/login/", {
            method: "POST",
            credentials: "include",
            headers: { 
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken, 
            },
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.status === 200) {
            document.cookie = `user_role=${data.user.role}; path=/; max-age=604800; SameSite=Lax`;
            const role = data.user.role 
            const storeRole = localStorage.setItem('role', role)

            if (role === 'admin' || role === 'Admin' || role === 'ADMIN'){
                router.push('/dashboard')
            }else{
                router.push('/attendance')
            }
        } else {
            setLoginError(data.error || "Invalid credentials");
        }
    };

    const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setRequestError("");
        setRequestSuccess("");
        setRequestLoading(true);

        const response = await fetch("http://localhost:8000/api/auth/request-access/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestForm),
        });

        const data = await response.json();
        setRequestLoading(false);

        if (response.status === 201) {
            setRequestSuccess(data.message);
            setTimeout(() => {
                setShowRequestModal(false);
                setRequestSuccess("");
                setRequestForm({ full_name: "", email: "", school: "", message: "" });
            }, 2500);
        } else {
            setRequestError(data.error || "Something went wrong. Please try again.");
        }
    };

    useEffect(()=>{
        const fetchStatus = async() =>{
            const res = await fetch('http://localhost:8000/api/attendance/system/status/',{
                method:'GET',
                credentials:'include'
            })

            const data = await res.json();
            console.log(data)
        }

        fetchStatus();
    },[])

    return (
        <>
            <section className="bg-[#d4e3f3] flex min-w-screen min-h-screen justify-center items-center text-black login px-4 py-8">
                <div className="justify-center items-center text-center font-lexend w-full max-w-sm sm:max-w-md">
                    <Image
                        className="black:invert bg-[#d4e3f3] mb-2 lg:mb-4 mx-auto rounded-2xl object-cover shrink-0 "
                        src="/logo2.jpg"
                        alt="Next.js logo"
                        width={130}
                        height={40}
                        priority
                    />
                    <h1 className="font-bold text-xl lg:text-2xl">Digital Attendance</h1>
                    <span className="text-sm lg:text-base">Primary Education Management</span>

                    <div className="bg-[#f8f9fa] w-full rounded-3xl pt-8 lg:pt-10 px-5 pb-5 mt-7 lg:mt-10 mb-5 justify-center items-start text-start shadow-[0px_48px_100px_0px_rgba(17,12,46,0.15)]">
                        <h3 className="text-lg lg:text-xl font-bold">Welcome Back</h3>
                        <span className="text-xs lg:text-sm text-[#adb5bd]">Log in to manage your classroom attendance</span>

                        {loginError && (
                            <div className="mt-3 px-4 py-2 bg-red-50 border border-red-100 text-red-500 rounded-xl text-xs">
                                {loginError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-2">
                            <div className="flex flex-col gap-1.5 login-field">
                                <label htmlFor="email" className="text-sm lg:text-base">Email Address</label>
                                <input
                                    type="text"
                                    name="email"
                                    placeholder="📩 e.g., teacher@school.edu"
                                    className="w-full text-sm lg:text-base text-gray-800"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 mb-4 login-field mt-3">
                                <label htmlFor="password" className="text-sm lg:text-base">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="🔐 *********"
                                    className="w-full text-sm lg:text-base"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-row justify-between text-xs lg:text-sm items-center mb-4">
                                <label htmlFor="rememberMe" className="text-[#33415c] flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        id="rememberMe"
                                        checked={formData.remember_me}
                                        onChange={(e) => setFormData(prev => ({ ...prev, remember_me: e.target.checked }))}
                                    /> Remember me
                                </label>
                                <a href="" className="text-[#1e88e5]">Forgot password?</a>
                            </div>

                            <button className="login-btn h-12 lg:h-[6vh] bg-[#1e88e5] w-full rounded-2xl text-white mb-5 text-sm lg:text-base font-medium">
                                Login to Dashboard →
                            </button>
                        </form>

                        <div className="divider h-[0.6px] w-[90%] ml-auto mr-auto bg-[#adb5bd]"></div>

                        <div className="flex justify-center items-center mt-5">
                            <span className="text-[#33415c] text-sm lg:text-base">
                                New teacher?{" "}
                                <button
                                    onClick={() => setShowRequestModal(true)}
                                    className="text-[#1e88e5] font-bold hover:underline"
                                >
                                    Request access
                                </button>
                            </span>
                        </div>
                    </div>

                    <span className="bg-[#b7e4c7] px-4 py-2 rounded-2xl text-[#40916c] text-xs lg:text-sm inline-block">
                        System status: All Systems Operational
                    </span>

                    <div className="mt-4 lg:mt-5 text-xs lg:text-sm text-[#33415c] flex justify-center items-center">
                        <ul className="flex flex-row gap-6 lg:gap-10 flex-wrap justify-center">
                            <li className="cursor-pointer hover:underline">Privacy Policy</li>
                            <li className="cursor-pointer hover:underline">Terms of Service</li>
                            <li className="cursor-pointer hover:underline">Help Center</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Request Access Modal */}
            {showRequestModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4 login"
                    style={{
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        backgroundColor: "rgba(180, 200, 220, 0.45)",
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowRequestModal(false);
                    }}
                >
                    <div
                        className="w-full max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 text-black relative"
                        style={{
                            background: "rgba(230, 237, 232, 0.72)",
                            backdropFilter: "blur(40px) saturate(200%)",
                            WebkitBackdropFilter: "blur(40px) saturate(200%)",
                            boxShadow: "0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.6)",
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowRequestModal(false)}
                            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 font-medium hover:bg-gray-100 transition-colors text-lg leading-none"
                        >
                            ×
                        </button>

                        <h3 className="text-lg sm:text-xl font-bold mb-1">Request Access</h3>
                        <span className="text-xs sm:text-sm text-gray-400">
                            An administrator will review your request
                        </span>

                        {requestError && (
                            <div className="mt-4 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-md">
                                {requestError}
                            </div>
                        )}
                        {requestSuccess && (
                            <div className="mt-4 px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs">
                                {requestSuccess}
                            </div>
                        )}

                        <form onSubmit={handleRequestSubmit} className="mt-5 flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm text-[#33415c]">Full Name</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    placeholder="e.g. John Doe"
                                    value={requestForm.full_name}
                                    onChange={handleRequestChange}
                                    required
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white/60 focus:outline-none focus:border-[#1e88e5] transition-colors"
                                    style={{ backdropFilter: "blur(8px)" }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm text-[#33415c]">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="e.g. john@school.edu"
                                    value={requestForm.email}
                                    onChange={handleRequestChange}
                                    required
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white/60 focus:outline-none focus:border-[#1e88e5] transition-colors"
                                    style={{ backdropFilter: "blur(8px)" }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm text-[#33415c]">School Name</label>
                                <input
                                    type="text"
                                    name="school"
                                    placeholder="e.g. Green Valley Primary School"
                                    value={requestForm.school}
                                    onChange={handleRequestChange}
                                    required
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white/60 focus:outline-none focus:border-[#1e88e5] transition-colors"
                                    style={{ backdropFilter: "blur(8px)" }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs sm:text-sm text-[#33415c]">
                                    Message <span className="text-[#adb5bd]">(optional)</span>
                                </label>
                                <textarea
                                    name="message"
                                    placeholder="Why do you need access?"
                                    value={requestForm.message}
                                    onChange={handleRequestChange}
                                    rows={3}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white/60 focus:outline-none focus:border-[#1e88e5] transition-colors resize-none"
                                    style={{ backdropFilter: "blur(8px)" }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={requestLoading}
                                className="mt-1 h-11 sm:h-12 bg-[#1e88e5] text-white rounded-2xl text-sm font-medium hover:bg-[#1976d2] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {requestLoading ? "Submitting..." : "Submit Request →"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}