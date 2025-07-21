import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 px-4 py-16 font-sans antialiased text-gray-900">
      <div className="text-center space-y-8 max-w-2xl">
        <h1 className="text-6xl font-extrabold leading-tight tracking-tight">
          Welcome to your{" "}
          <span className="text-blue-600 drop-shadow-md">
            AI Workflow Assistant
          </span>
          .
        </h1>
        <p className="text-xl text-gray-700 leading-relaxed max-w-xl mx-auto">
          Your journey to **seamless AI integration** and **powerful data
          insights** starts here. Let's make your workflows smarter.
        </p>
        <Link
          href="/setup/source"
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-full p-px font-bold transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          <span className="relative flex items-center space-x-2 px-8 py-4 text-lg text-blue-700 bg-white rounded-full transition-all duration-300 ease-in-out">
            <ArrowRight />
            <span>Get Started</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
