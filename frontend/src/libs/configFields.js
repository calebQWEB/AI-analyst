export const configFields = {
  PostHog: {
    label: "PostHog API Key",
    placeholder: "Enter your PostHog project API key",
    type: "text",
    name: "posthogApiKey",
  },
  Excel: {
    label: "Upload EXCEL File",
    type: "file",
    name: "excelFile",
  },
  CSV: {
    label: "Upload CSV File",
    type: "file",
    name: "csvFile",
  },
  "Google Sheets": {
    label: "Google Sheets URL",
    placeholder: "Paste the public link to your sheet",
    type: "text",
    name: "sheetsUrl",
  },
  Gmail: {
    label: "Report Sender Email",
    placeholder: "e.g. reports@yourcompany.com",
    type: "email",
    name: "senderEmail",
  },
  // Add more as needed...
};
