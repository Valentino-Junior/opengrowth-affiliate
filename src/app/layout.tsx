import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], weight: ["500", "700"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Opengrowth by Young Money",
  description: "Bring the players. Take 5% of the profit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${manrope.variable}`}>
      <body className="grid min-h-screen grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto] antialiased">
        <div>{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
