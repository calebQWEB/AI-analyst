import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SetupProvider } from "@/context/SetupContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "AI workflow Assistant",
  description: "Analytics and AI workflow assistant for your data",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className}`}>
        <SetupProvider>{children}</SetupProvider>
      </body>
    </html>
  );
}
