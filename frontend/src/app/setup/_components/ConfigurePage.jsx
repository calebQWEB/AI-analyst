"use client";
import { useSetup } from "../../../context/SetupContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configFields } from "@/libs/configFields";
import FileUploader from "@/components/FileUploader";

export default function ConfigurePage() {
  const { selectedSources } = useSetup();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (selectedSources.length === 0) {
      router.push("/setup/sources");
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
    setLoading(true);

    try {
      // Step 1: Send the formData (which now includes Supabase filePaths) to your Next.js API route
      // This Next.js API route (`/api/invoke`) will then proxy the request to your Python backend.
      const analysisRes = await fetch("/api/invoke", {
        // <-- Call your Next.js /api/invoke
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Construct the payload for Python backend via Next.js proxy
          data: [
            {
              type: "supabase_excel", // Indicate the type of data
              path: formData.excelFile, // Use the stored filePath for the spreadsheet field
            },
          ],
          config: {
            // Pass any other form data as 'config'
            ...formData, // Spread the rest of formData into config
          },
        }),
      });

      console.log("Form Data:", formData);
      console.log(
        "🚀 Payload being sent to /api/invoke:",
        JSON.stringify(analysisRes, null, 2)
      ); // ADD THIS LINE

      if (!analysisRes.ok) {
        const errorText = await analysisRes.text();
        console.error("❌ Analysis API returned error:", errorText);
        throw new Error("Analysis request failed");
      }

      const analysisResult = await analysisRes.json();
      console.log("✅ Analysis result:", analysisResult);
      sessionStorage.setItem("analysis", JSON.stringify(analysisResult));

      // Step 2: Navigate to dashboard
      router.push(`/dashboard/${analysisResult.session_id}`);
    } catch (err) {
      console.error("❌ Config submission failed:", err);
    } finally {
      setLoading(false);
    }
  };

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
