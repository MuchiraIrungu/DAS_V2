export async function getCsrfToken(): Promise<string> {
    const res = await fetch("http://localhost:8000/api/auth/csrf/", {
        credentials: "include",
    });
    const data = await res.json();
    return data.csrfToken;
}