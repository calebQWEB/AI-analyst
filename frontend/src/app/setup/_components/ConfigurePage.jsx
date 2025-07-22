"use client";
import { useSetup } from "../../../context/SetupContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configFields } from "@/libs/configFields";
import FileUploader from "@/components/FileUploader";
import AnalyzingModal from "./AnalyzingModal";

export default function ConfigurePage() {
  const { selectedSources } = useSetup();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (selectedSources.length === 0) {
      router.push("/setup/source");
    }
  }, [selectedSources]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    // For regular input fields, store the value
    // File inputs are handled by FileUploader's onUploadSuccess
    if (type !== "file") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // This handler will be called by FileUploader when a file successfully uploads to Supabase
  const handleFileUploadSuccess = (fieldName, filePath) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: filePath, // Store the Supabase filePath, not the raw File object
    }));
    console.log(`Stored filePath for ${fieldName}:`, filePath);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Your original loading state
    setError(""); // Clear any previous page-level error messages

    try {
      const analysisRes = await fetch("/api/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              type: "supabase_excel",
              path: formData.excelFile,
            },
          ],
          config: {
            ...formData,
          },
        }),
      });

      console.log("Form Data:", formData);
      console.log(
        "🚀 Payload being sent to /api/invoke (after form data):",
        JSON.stringify(
          {
            data: [{ type: "supabase_excel", path: formData.excelFile }],
            config: { ...formData },
          },
          null,
          2
        )
      );

      if (!analysisRes.ok) {
        const errorText = await analysisRes.text();
        console.error(
          "❌ Analysis API returned non-OK status:",
          analysisRes.status,
          errorText
        );
        throw new Error(
          `Analysis initiation failed with status ${analysisRes.status}: ${errorText}`
        );
      }

      const analysisInitiationResult = await analysisRes.json();
      console.log("✅ Analysis initiation result:", analysisInitiationResult);

      // --- REFINED JSON VALIDATION LOGIC ---
      const initialAnalysisContent =
        analysisInitiationResult.initial_analysis || "";

      // Check for common error patterns in the initial_analysis string
      const hasAnalysisErrorString =
        initialAnalysisContent.includes("Error processing chunk") ||
        initialAnalysisContent.includes("Connection error.") ||
        initialAnalysisContent.includes("ERROR:"); // Add other specific error keywords if you find them

      // Validate if session_id is valid AND if the initial_analysis does NOT contain an error string
      if (
        analysisInitiationResult &&
        analysisInitiationResult.session_id &&
        !hasAnalysisErrorString // <-- NEW CHECK
      ) {
        // SUCCESS PATH: Proceed to dashboard
        router.push(`/dashboard/${analysisInitiationResult.session_id}`);
      } else {
        // ERROR PATH: JSON payload indicates an issue (either missing session_id or error string in analysis)
        const errorMessage =
          (hasAnalysisErrorString ? initialAnalysisContent : null) || // Use the error string from analysis if present
          analysisInitiationResult.message ||
          analysisInitiationResult.error ||
          "Failed to start analysis due to invalid response structure or internal error.";

        console.error(
          "❌ Invalid analysis initiation response (JSON content):",
          analysisInitiationResult
        );
        throw new Error(errorMessage); // Throw error to be caught by the catch block below
      }
      // --- END REFINED JSON VALIDATION LOGIC ---
    } catch (err) {
      console.error("❌ Config submission failed:", err);
      setError(
        err.message || "Something went wrong during analysis initiation."
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AnalyzingModal />;

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-16 font-sans">
      <div className="max-w-2xl w-full mx-auto p-8 bg-white shadow-2xl rounded-3xl border border-gray-100">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 text-center leading-tight">
          Configure Data Connections
        </h1>
        <p className="text-xl text-gray-500 mb-10 text-center">
          Set up your options based on the data sources you've selected.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {selectedSources.map((source) => {
            const field = configFields[source];
            if (!field) return null;

            return (
              <div key={source}>
                <label
                  className="block text-lg font-semibold text-gray-700 mb-2"
                  htmlFor={field.name}
                >
                  {field.label}
                </label>

                {field.type === "file" ? (
                  <FileUploader
                    fieldName={field.name}
                    onUploadSuccess={(filePath) =>
                      handleFileUploadSuccess(field.name, filePath)
                    }
                  />
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-600
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                transition duration-200 ease-in-out"
                  />
                )}
              </div>
            );
          })}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg cursor-pointer
                                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                transition duration-300 ease-in-out transform hover:scale-105"
            disabled={loading} // Disable button while loading
          >
            {loading ? "Processing..." : "Continue to Dashboard"}
          </button>
        </form>
      </div>
    </section>
  );
}
