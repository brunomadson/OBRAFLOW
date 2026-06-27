import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "ObraFlow — Gestão de Obras Financiadas",
  description: "Sistema de gestão para obras financiadas pela Caixa Econômica Federal",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "10px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              },
              success: { iconTheme: { primary: "#10B981", secondary: "#fff" } },
              error:   { iconTheme: { primary: "#EF4444", secondary: "#fff" } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
