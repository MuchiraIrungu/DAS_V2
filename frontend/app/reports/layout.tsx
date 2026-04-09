// app/dashboard/layout.tsx
import SessionGuard from "../components/SessionGuard";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionGuard>
            {children}
        </SessionGuard>
    );
}