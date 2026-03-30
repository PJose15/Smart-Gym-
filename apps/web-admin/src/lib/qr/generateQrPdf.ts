import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

interface MachineForQr {
  name: string;
  qr_slug: string;
  equipment_type: string;
}

/**
 * Generates a PDF containing QR codes for each machine.
 * Returns a Uint8Array buffer suitable for streaming.
 */
export async function generateQrPdf(
  machines: MachineForQr[],
  gymName: string,
  baseUrl: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;  // Letter width
  const pageHeight = 792; // Letter height
  const margin = 40;
  const colCount = 2;
  const qrSize = 140;
  const cellWidth = (pageWidth - 2 * margin) / colCount;
  const cellHeight = 200;
  const rowsPerPage = Math.floor((pageHeight - 2 * margin - 40) / cellHeight);

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let itemIndex = 0;

  // Title on first page
  currentPage.drawText(`${gymName} — Machine QR Codes`, {
    x: margin,
    y: pageHeight - margin - 20,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  const startY = pageHeight - margin - 50;

  for (const machine of machines) {
    const col = itemIndex % colCount;
    const row = Math.floor(itemIndex / colCount) % rowsPerPage;

    if (itemIndex > 0 && row === 0 && col === 0) {
      currentPage = doc.addPage([pageWidth, pageHeight]);
    }

    const x = margin + col * cellWidth;
    const y = startY - row * cellHeight;

    // Generate QR as PNG data URL
    const qrUrl = `${baseUrl}/m/${machine.qr_slug}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: qrSize * 2, margin: 1 });
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrImage = await doc.embedPng(qrImageBytes);

    // Draw QR code
    currentPage.drawImage(qrImage, {
      x: x + (cellWidth - qrSize) / 2,
      y: y - qrSize,
      width: qrSize,
      height: qrSize,
    });

    // Machine name below QR
    const nameWidth = boldFont.widthOfTextAtSize(machine.name, 11);
    currentPage.drawText(machine.name, {
      x: x + (cellWidth - nameWidth) / 2,
      y: y - qrSize - 16,
      size: 11,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Equipment type
    const typeText = machine.equipment_type;
    const typeWidth = font.widthOfTextAtSize(typeText, 9);
    currentPage.drawText(typeText, {
      x: x + (cellWidth - typeWidth) / 2,
      y: y - qrSize - 30,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    itemIndex++;
  }

  return doc.save();
}
