import Papa from "papaparse";
import * as XLSX from "xlsx";
import supabase from "./supabaseClient";

export async function parseSpreadsheetFromSupabase(filePath) {
  const fileName = filePath.split("/").pop();
  const extension = fileName.split(".").pop().toLowerCase();

  const cleanPath = filePath.replace("private/uploads/", "");

  const { data: fileBlob, error } = await supabase.storage
    .from("uploads")
    .download(cleanPath);

  if (error || !fileBlob) {
    throw new Error(
      `Failed to download file from Supabase: ${
        error?.message || "Unknown error"
      }`
    );
  }

  const arrayBuffer = await fileBlob.arrayBuffer();

  if (extension === "csv") {
    const text = new TextDecoder().decode(arrayBuffer);

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data.slice(0, 50)),
        error: reject,
      });
    });
  }

  if (extension === "xlsx") {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames?.[0];

    if (!sheetName) {
      throw new Error("No sheet found in the uploaded Excel file.");
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    return jsonData.slice(0, 50);
  }

  throw new Error("Unsupported file type. Only .csv and .xlsx are allowed.");
}
