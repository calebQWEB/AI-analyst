"use client";
import { Hamburger, HistoryIcon, Menu, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

const History = () => {
  const [allSessions, setAllSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [errorSessions, setErrorSessions] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef(null);
  const backendBaseUrl = "http://localhost:8000";
  const params = useParams();
  const sessionId = params.sessionId;

  const fetchAllSessions = async () => {
    setLoadingSessions(true);
    setErrorSessions(null);
    try {
      const response = await fetch(`${backendBaseUrl}/sessions`); // Call the new endpoint!
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to load all sessions: ${response.status} - ${errorText}`
        );
      }
      const data = await response.json();
      setAllSessions(data.sessions); // Access the 'sessions' key from the response
    } catch (error) {
      console.error("Error fetching all sessions:", error);
      setErrorSessions(error.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchAllSessions();
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  // Close sidebar when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        closeSidebar();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]); // Only re-run if isOpen changes

  // Helper to get a display name for the session
  const getSessionDisplayName = (session) => {
    if (session.original_file_path) {
      const fileName = session.original_file_path.split("/").pop(); // Get actual file name
      return fileName.length > 25
        ? fileName.substring(0, 22) + "..."
        : fileName; // Truncate if too long
    }
    return `Session ${session.session_id.substring(0, 8)}`; // Fallback for nameless sessions
  };

  return (
    <>
      {/* Overlay to dim background and capture clicks when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      {/* CONDITIONAL RENDERING OF THE TOGGLE BUTTON */}
      {/* This div will only be in the DOM when isOpen is FALSE */}
      {!isOpen && ( // <--- Added this conditional rendering
        <div
          className={`
            fixed top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-l-lg shadow-lg cursor-pointer z-50
            transition-all duration-300 ease-in-out hidden md:block /* Visible on desktop only */
            right-0 /* Always positioned on the right edge when visible */
          `}
          onClick={toggleSidebar}
          aria-label="Open session history"
          title="Open history"
        >
          <HistoryIcon color="#ffffff" />
        </div>
      )}

      {/* Sidebar Content Area (remains the same) */}
      <div
        ref={sidebarRef}
        className={`
          fixed top-0 right-0 h-full w-[var(--sidebar-width)] bg-gray-900 text-white shadow-xl p-6 z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          flex flex-col
          md:flex
          ${isOpen ? "flex" : "hidden"}
        `}
        style={{
          "--sidebar-width": "300px",
        }}
      >
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <span className="text-2xl font-extrabold text-blue-300">History</span>
          {/* Close button for mobile, or if you change your mind and want it back on desktop: */}
          {/*
          <button
            onClick={closeSidebar}
            className="text-gray-400 hover:text-white transition-colors duration-200 focus:outline-none md:hidden"
            aria-label="Close sidebar"
          >
            <X color="#ffffff" />
          </button>
          */}
        </div>

        {loadingSessions ? (
          <div className="text-gray-400 text-center py-10">
            <svg
              className="animate-spin h-8 w-8 text-blue-400 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="mt-2">Loading sessions...</p>
          </div>
        ) : errorSessions ? (
          <div className="text-red-400 text-center py-10">
            Error loading sessions: {errorSessions}
          </div>
        ) : allSessions.length === 0 ? (
          <div className="text-gray-400 text-center py-10 italic text-lg">
            No previous sessions found.
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {allSessions.map((session) => (
              <li
                key={session.session_id}
                className={`
                  bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-200
                  hover:bg-blue-700 hover:scale-[1.01] hover:shadow-xl cursor-pointer group
                  ${
                    sessionId === session.session_id
                      ? "border-2 border-blue-500 ring-2 ring-blue-500"
                      : ""
                  }
                `}
                onClick={closeSidebar} // Close sidebar when an item is clicked
              >
                <Link
                  href={`/dashboard/${session.session_id}`}
                  className="block"
                >
                  <p className="font-semibold text-blue-200 group-hover:text-white text-lg mb-1 truncate">
                    {getSessionDisplayName(session)}
                  </p>
                  {session.created_at && (
                    <p className="text-sm text-gray-400 group-hover:text-blue-100">
                      Created:{" "}
                      {new Date(session.created_at).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </p>
                  )}
                  {session.initial_analysis && (
                    <p className="text-xs text-gray-500 group-hover:text-gray-200 mt-2 line-clamp-2">
                      {session.initial_analysis}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default History;
