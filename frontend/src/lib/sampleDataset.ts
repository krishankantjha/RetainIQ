/** Sample CSV served from the frontend public folder. */
export const SAMPLE_CSV_PATH = "/sample/Telco_Customer_Churn.csv";

export const SAMPLE_CSV_FILENAME = "Telco_Customer_Churn.csv";

export async function downloadSampleCsv(): Promise<void> {
  const response = await fetch(SAMPLE_CSV_PATH);
  if (!response.ok) {
    throw new Error("Could not download sample CSV");
  }

  const blob = new Blob([await response.arrayBuffer()], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = SAMPLE_CSV_FILENAME;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
