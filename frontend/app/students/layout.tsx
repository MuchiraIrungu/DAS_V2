// app/dashboard/layout.tsx
import SessionGuard from "../components/SessionGuard";

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionGuard>
            {children}
        </SessionGuard>
    );
}