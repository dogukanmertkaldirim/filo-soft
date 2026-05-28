import * as XLSX from 'xlsx';

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string
) {
  const worksheetData = data.map(row => {
    const rowData: Record<string, any> = {};
    columns.forEach(col => {
      rowData[col.header] = row[col.key] ?? '';
    });
    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  const colWidths = columns.map(col => ({
    wch: Math.max(col.header.length, 15)
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
