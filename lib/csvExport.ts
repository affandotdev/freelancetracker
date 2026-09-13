/**
 * Client-side CSV export utility.
 * Converts an array of objects into an RFC-4180 compliant CSV file and triggers a browser download.
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    // Replace double quotes with two double quotes
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCell).join(","));

  // Data rows
  for (const row of rows) {
    const values = headers.map((header) => escapeCell(row[header]));
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\r\n");
  const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" }); // include BOM for Excel UTF-8 compatibility
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", safeFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
