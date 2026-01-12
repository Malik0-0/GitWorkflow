import "./globals.css";
import { ReactNode } from "react";
import ServerHeader from "@/components/ServerHeader";
import ToastClient from "@/components/ToastClient";
import ThemeProvider from "@/components/theme/ThemeProvider";

export const metadata = {
  title: "CleanNote",
  description: "A tidy journaling app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ServerHeader />
          <main className="container mt-10 mb-20">{children}</main>
          <ToastClient />
        </ThemeProvider>
      </body>
    </html>
  );
}
