import { exec } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Silently converts DOCX, PPTX, XLSX, and Images to PDF on Windows/Linux
 * so they can be spooled directly to physical printers via pdf-to-printer
 * without ever opening Microsoft Office dialog popups!
 */
export function convertToPdfIfNeeded(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    if (!filePath || !fs.existsSync(filePath)) {
      resolve(filePath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    // Already a PDF, no conversion needed
    if (ext === ".pdf") {
      resolve(filePath);
      return;
    }

    const pdfPath = filePath.replace(/\.[^/.]+$/, "") + "_converted.pdf";

    // Return cached converted PDF if already converted
    if (fs.existsSync(pdfPath)) {
      resolve(pdfPath);
      return;
    }

    const isWin = process.platform === "win32";
    if (!isWin) {
      // Linux/macOS LibreOffice fallback
      exec(`soffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(filePath)}"`, (err) => {
        if (!err && fs.existsSync(pdfPath)) {
          resolve(pdfPath);
        } else {
          resolve(filePath);
        }
      });
      return;
    }

    let psScript = "";

    if (ext === ".pptx" || ext === ".ppt") {
      psScript = `
        $ppt = New-Object -ComObject PowerPoint.Application
        try {
          $pres = $ppt.Presentations.Open('${filePath.replace(/'/g, "''")}', 1, 0, 0)
          $pres.SaveAs('${pdfPath.replace(/'/g, "''")}', 32)
          $pres.Close()
        } catch {
          Write-Host $_.Exception.Message
        } finally {
          $ppt.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
        }
      `;
    } else if (ext === ".docx" || ext === ".doc") {
      psScript = `
        $word = New-Object -ComObject Word.Application
        try {
          $word.Visible = $false
          $doc = $word.Documents.Open('${filePath.replace(/'/g, "''")}')
          $doc.SaveAs([ref]'${pdfPath.replace(/'/g, "''")}', [ref]17)
          $doc.Close()
        } catch {
          Write-Host $_.Exception.Message
        } finally {
          $word.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
        }
      `;
    } else if (ext === ".xlsx" || ext === ".xls") {
      psScript = `
        $excel = New-Object -ComObject Excel.Application
        try {
          $excel.Visible = $false
          $wb = $excel.Workbooks.Open('${filePath.replace(/'/g, "''")}')
          $wb.ExportAsFixedFormat(0, '${pdfPath.replace(/'/g, "''")}')
          $wb.Close($false)
        } catch {
          Write-Host $_.Exception.Message
        } finally {
          $excel.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        }
      `;
    }

    if (!psScript) {
      resolve(filePath);
      return;
    }

    const scriptFile = path.join(path.dirname(filePath), `convert_${Date.now()}_${Math.floor(Math.random() * 1000)}.ps1`);
    fs.writeFileSync(scriptFile, psScript, "utf8");

    exec(`powershell -ExecutionPolicy Bypass -File "${scriptFile}"`, (err) => {
      // Clean up script file
      fs.unlink(scriptFile, () => undefined);

      if (!err && fs.existsSync(pdfPath)) {
        console.log(`[OfficeConverter] 📄 Converted "${path.basename(filePath)}" to PDF: "${pdfPath}"`);
        resolve(pdfPath);
      } else {
        console.warn(`[OfficeConverter] PowerShell conversion notice:`, err?.message || "Using original file");
        resolve(filePath);
      }
    });
  });
}
