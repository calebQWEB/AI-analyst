"use client"; // This component uses client-side hooks for animations

import React from "react";

// Define custom keyframe animations using inline <style>
const customAnimations = `
  /* Keyframes for the data particle moving from file to brain */
  @keyframes transfer-data {
    0% {
      left: calc(50% - 75px - 32px); /* Start right of file icon (150px/2 + 64px gap/2) - particle width/2 */
      opacity: 0;
      transform: scale(0.5) translateY(-50%);
    }
    10% {
      opacity: 1;
      transform: scale(1) translateY(-50%);
    }
    90% {
      left: calc(50% + 75px + 32px); /* End left of brain icon */
      opacity: 1;
      transform: scale(1) translateY(-50%);
    }
    100% {
      left: calc(50% + 75px + 32px);
      opacity: 0;
      transform: scale(0.5) translateY(-50%);
    }
  }

  /* Keyframes for a subtle pulse on the brain icon */
  @keyframes brain-pulse {
    0%, 100% {
      transform: scale(1);
      filter: drop-shadow(0 0 5px rgba(100, 116, 139, 0.5)); /* slate-500 color with shadow */
    }
    50% {
      transform: scale(1.03);
      filter: drop-shadow(0 0 15px rgba(100, 116, 139, 0.8));
    }
  }
`;

const AnalyzingModal = () => {
  return (
    <>
      {/* Inject custom keyframe styles */}
      <style dangerouslySetInnerHTML={{ __html: customAnimations }} />

      {/* Full-screen overlay for the modal */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-[1000] overflow-hidden">
        {/* Container for the icons and animated particle */}
        <div className="relative flex items-center justify-center gap-16">
          {/* File Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="150"
            height="150"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-400" /* Added a color for visual appeal */
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M8 18v-2" />
            <path d="M12 18v-4" />
            <path d="M16 18v-6" />
          </svg>

          {/* Animated Data Particle */}
          {/* This div represents the "knowledge" being transferred */}
          <div
            className="absolute w-8 h-8 rounded-full bg-yellow-300 shadow-lg opacity-0
                       animate-[transfer-data_2.5s_ease-in-out_infinite]
                       " /* Applies the custom animation */
            style={{
              top: "50%",
              transform: "translateY(-50%)",
            }} /* Centers vertically */
          ></div>

          {/* Brain Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="150"
            height="150"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500 animate-[brain-pulse_2.5s_ease-in-out_infinite]" /* Added color and a subtle pulse animation */
          >
            <path d="M12 18V5" />
            <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
            <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
            <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
            <path d="M18 18a4 4 0 0 0 2-7.464" />
            <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
            <path d="M6 18a4 4 0 0 1-2-7.464" />
            <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
          </svg>
        </div>
      </div>
    </>
  );
};

export default AnalyzingModal;
