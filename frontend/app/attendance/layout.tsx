// app/dashboard/layout.tsx
import SessionGuard from "../components/SessionGuard";

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionGuard>
            {children}
        </SessionGuard>
    );
}