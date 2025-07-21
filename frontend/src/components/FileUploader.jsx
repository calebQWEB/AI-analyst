"use client";
import supabase from "@/libs/supabaseClient";
import { useState } from "react";

export default function FileUploader({ onUploadSuccess, fieldName }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    // Set uploading state to true before starting the async operation
    setUploading(true);

    try {
      // const filePath = `session-${Date.now()}/${file.name}`;
      const filePath = `private/uploads/${file.name}`;

      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      if (error) {
        // Handle Supabase-specific API errors
        console.error("Upload error:", error.message);
        setMessage("❌ Upload failed.");
      } else {
        // Handle success
        if (onUploadSuccess) {
          onUploadSuccess(filePath); // ✅ Send file path back to parent
        }
        console.log("Upload successful:", data);
        setMessage("✅ File uploaded successfully!");
      }
    } catch (error) {
      // Handle unexpected exceptions (e.g., network errors)
      console.error("Caught an exception:", error);
      setMessage("❌ An unexpected error occurred.");
    } finally {
      // ✅ This block is guaranteed to run, ensuring the state is always reset
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-start font-sans">
      <div className="p-8 bg-white border border-gray-200 rounded-xl shadow-lg w-full m-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Upload Spreadsheet
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Select a .csv or .xlsx file to upload.
        </p>

        <div className="mb-6">
          <label htmlFor="file-upload" className="sr-only">
            Choose a file
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full border border-gray-300 rounded-lg text-sm text-gray-500
                       transition duration-200 ease-in-out cursor-pointer
                       file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0
                       file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                       hover:file:bg-blue-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold text-base
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                       disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-300"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>

        {message && (
          <div className="mt-4 text-center">
            <p
              className={`text-sm font-medium ${
                message.includes("❌") ? "text-red-600" : "text-green-600"
              }`}
            >
              {message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
