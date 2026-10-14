import type { Metadata } from "next";
import { Manrope, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const jbmono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jbmono",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SETKA — командное рабочее пространство",
  description:
    "Файлы, заметки и сетевые схемы с распознаванием набросков. Приватное S3-хранилище, роли владелец/участник, OCR.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${jbmono.variable} ${unbounded.variable} noise font-sans`}>
        {children}
      </body>
    </html>
  );
}
