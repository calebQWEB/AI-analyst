"use client";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const steps = [
  { label: "Source", path: "/setup/source" },
  { label: "Configure", path: "/setup/configure" },
];

const ProgressStepper = () => {
  const pathname = usePathname();
  const currentStep = steps.findIndex((step) => pathname.startsWith(step.path));

  return (
    <div className="fixed right-0 left-0 flex items-center justify-center gap-4 p-5 bg-white shadow-md z-50">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
            >
              {isCompleted ? <Check size={18} /> : index + 1}
            </div>

            <span
              className={`text-sm font-medium capitalize transition-colors duration-300
                ${
                  isActive
                    ? "text-blue-600"
                    : isCompleted
                    ? "text-green-600"
                    : "text-gray-500"
                }`}
            >
              {step.label}
            </span>

            {index < steps.length - 1 && (
              <div className="w-8 h-1 bg-gray-300 rounded-full mx-2 relative">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 w-full"
                      : isActive
                      ? "bg-blue-500 w-1/2"
                      : "bg-gray-300 w-0"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProgressStepper;
