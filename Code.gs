/**
 * ============================================================================
 * GOOGLE SHEETS AUTOMATED TICKET EMAIL & GOQR GENERATOR SCRIPT
 * ============================================================================
 *
 * Sheet Column Layout:
 * Col 1 (A): Submission ID
 * Col 2 (B): Respondent ID
 * Col 3 (C): Submitted at
 * Col 4 (D): Name
 * Col 5 (E): Email
 * Col 6 (F): Phone Number
 * Col 7 (G): Number of Passes
 * Col 8 (H): Select UPI app
 * Col 9 (I): UTR
 * Col 10 (J): Upload Transaction Screenshot
 * Col 11 (K): I accept to Terms & Conditions
 * Col 12 (L): I accept to Terms & Conditions (Agreed)
 * Col 13 (M): Verify
 * Col 14 (N): QR
 * Col 15 (O): Email Status
 *
 * API Used for QR Generation: GoQR API (https://goqr.me/api/)
 * Endpoint: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=
 * ============================================================================
 */

// Configuration Constants
const CONFIG = {
  EVENT_NAME: "Event Entry Ticket",
  ORGANIZER_NAME: "Event Organizing Team",
  REPLY_TO_EMAIL: "", // Optional reply-to email address
  DEFAULT_QR_SIZE: "300x300",
  GOQR_API_BASE: "https://api.qrserver.com/v1/create-qr-code/",
  HEADER_ROW: 1,
  
  COLUMN_HEADERS: {
    SUBMISSION_ID: "Submission ID",
    RESPONDENT_ID: "Respondent ID",
    SUBMITTED_AT: "Submitted at",
    NAME: "Name",
    EMAIL: "Email",
    PHONE: "Phone Number",
    PASSES: "Number of Passes",
    UPI_APP: "Select UPI  app",
    UTR: "UTR",
    VERIFY: "Verify",
    QR: "QR",
    EMAIL_STATUS: "Email Status"
  }
};

/**
 * Main Installable Edit Trigger Function.
 */
function onSheetEditTrigger(e) {
  try {
    if (!e || !e.range) {
      Logger.log("Trigger fired without edit event object.");
      return;
    }

    const sheet = e.range.getSheet();
    const editedRow = e.range.getRow();
    const editedCol = e.range.getColumn();

    if (editedRow <= CONFIG.HEADER_ROW) return;

    const colMap = getColumnMap(sheet);
    const verifyColIdx = colMap[CONFIG.COLUMN_HEADERS.VERIFY] || 13;

    if (editedCol !== verifyColIdx) return;

    processRowVerification(sheet, editedRow, colMap);

  } catch (err) {
    Logger.log("Error in onSheetEditTrigger: " + err.toString());
  }
}

/**
 * Processes a specific row: checks verification status, generates GoQR URL, and sends email.
 */
function processRowVerification(sheet, rowIdx, colMap) {
  if (!colMap) {
    colMap = getColumnMap(sheet);
  }

  const maxCols = sheet.getLastColumn();
  const rowValues = sheet.getRange(rowIdx, 1, 1, maxCols).getValues()[0];

  const getValue = (headerName, fallbackColIdx) => {
    const colIdx = colMap[headerName] || fallbackColIdx;
    return rowValues[colIdx - 1] !== undefined ? String(rowValues[colIdx - 1]).trim() : "";
  };

  const verifyVal = getValue(CONFIG.COLUMN_HEADERS.VERIFY, 13);
  const emailStatusVal = getValue(CONFIG.COLUMN_HEADERS.EMAIL_STATUS, 15);

  const isVerified = verifyVal.toLowerCase() === "verified";

  if (!isVerified) {
    Logger.log(`Row ${rowIdx}: Verification status '${verifyVal}' is not 'Verified'. Skipping.`);
    return;
  }

  if (emailStatusVal.toUpperCase().startsWith("SENT")) {
    Logger.log(`Row ${rowIdx}: Email already sent previously ('${emailStatusVal}'). Skipping.`);
    return;
  }

  const respondentId = getValue(CONFIG.COLUMN_HEADERS.RESPONDENT_ID, 2);
  const name = getValue(CONFIG.COLUMN_HEADERS.NAME, 4);
  const recipientEmail = getValue(CONFIG.COLUMN_HEADERS.EMAIL, 5);
  const phone = getValue(CONFIG.COLUMN_HEADERS.PHONE, 6);
  const numberOfPasses = getValue(CONFIG.COLUMN_HEADERS.PASSES, 7) || "1";
  const utr = getValue(CONFIG.COLUMN_HEADERS.UTR, 9);
  const submissionId = getValue(CONFIG.COLUMN_HEADERS.SUBMISSION_ID, 1);

  if (!recipientEmail) {
    Logger.log(`Row ${rowIdx}: Missing email address.`);
    sheet.getRange(rowIdx, colMap[CONFIG.COLUMN_HEADERS.EMAIL_STATUS] || 15)
         .setValue("ERROR: Missing Email");
    return;
  }

  const ticketPayload = createTicketPayload({
    submissionId: submissionId,
    respondentId: respondentId,
    name: name,
    email: recipientEmail,
    phone: phone,
    passes: numberOfPasses,
    utr: utr
  });

  const qrCodeUrl = generateGoQRUrl(ticketPayload);

  const emailSuccess = sendTicketEmail({
    toEmail: recipientEmail,
    name: name,
    respondentId: respondentId,
    numberOfPasses: numberOfPasses,
    utr: utr,
    qrCodeUrl: qrCodeUrl,
    submissionId: submissionId
  });

  const qrColIdx = colMap[CONFIG.COLUMN_HEADERS.QR] || 14;
  const statusColIdx = colMap[CONFIG.COLUMN_HEADERS.EMAIL_STATUS] || 15;

  if (emailSuccess) {
    const formattedTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.getRange(rowIdx, qrColIdx).setValue(qrCodeUrl);
    sheet.getRange(rowIdx, statusColIdx).setValue(`SENT at ${formattedTimestamp}`);
    Logger.log(`Row ${rowIdx}: Successfully sent ticket email to ${recipientEmail}.`);
  } else {
    sheet.getRange(rowIdx, statusColIdx).setValue("ERROR: Failed to Send Email");
  }
}

function createTicketPayload(data) {
  return [
    `=== EVENT TICKET ===`,
    `Ref ID: ${data.submissionId || data.respondentId || 'N/A'}`,
    `Respondent ID: ${data.respondentId || 'N/A'}`,
    `Name: ${data.name || 'N/A'}`,
    `Passes: ${data.passes || '1'}`,
    `Email: ${data.email || 'N/A'}`,
    `Phone: ${data.phone || 'N/A'}`,
    `UTR: ${data.utr || 'N/A'}`
  ].join("\n");
}

function generateGoQRUrl(textPayload) {
  const encodedData = encodeURIComponent(textPayload);
  return `${CONFIG.GOQR_API_BASE}?size=${CONFIG.DEFAULT_QR_SIZE}&data=${encodedData}`;
}

function sendTicketEmail(data) {
  try {
    const subject = `🎟️ Verified Event Ticket - Pass Confirmed (${data.name})`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
          .ticket-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e1e8ed; }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
          .badge-container { text-align: center; margin-top: -15px; }
          .badge { display: inline-block; background: #10b981; color: white; padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 13px; text-transform: uppercase; }
          .content { padding: 30px; }
          .greeting { font-size: 18px; color: #1e293b; margin-bottom: 15px; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 10px 0; font-size: 14px; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #64748b; font-weight: 500; }
          .detail-value { color: #0f172a; font-weight: 700; text-align: right; }
          .qr-section { text-align: center; margin: 30px 0; padding: 20px; background: #ffffff; border: 2px dashed #6366f1; border-radius: 12px; }
          .qr-image { width: 220px; height: 220px; border-radius: 8px; }
          .qr-instructions { font-size: 13px; color: #64748b; margin-top: 12px; }
          .footer { background: #0f172a; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="ticket-container">
          <div class="header">
            <h1>${CONFIG.EVENT_NAME}</h1>
            <p>Your Payment & Registration are Verified!</p>
          </div>
          
          <div class="badge-container">
            <span class="badge">✓ VERIFIED TICKET</span>
          </div>

          <div class="content">
            <div class="greeting">Hello <strong>${escapeHtml(data.name)}</strong>,</div>
            <p style="color: #475569; line-height: 1.6;">
              Great news! Your registration and payment verification have been successfully processed. Here is your official entry ticket pass.
            </p>

            <div class="details-card">
              <div class="detail-row">
                <span class="detail-label">Attendee Name</span>
                <span class="detail-value">${escapeHtml(data.name)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ref ID</span>
                <span class="detail-value">${escapeHtml(data.submissionId || data.respondentId || 'N/A')}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of Passes</span>
                <span class="detail-value">${escapeHtml(data.numberOfPasses)} Pass(es)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">UTR Ref No.</span>
                <span class="detail-value">${escapeHtml(data.utr || 'N/A')}</span>
              </div>
            </div>

            <div class="qr-section">
              <img src="${data.qrCodeUrl}" alt="Entry QR Code" class="qr-image" />
              <div class="qr-instructions">
                <strong>Show this QR Code at the entry gate</strong><br/>
                Please keep this email or screenshot the QR code for quick scanning.
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Sent via ${CONFIG.ORGANIZER_NAME}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailOptions = {
      to: data.toEmail,
      subject: subject,
      htmlBody: htmlBody
    };

    if (CONFIG.REPLY_TO_EMAIL) {
      emailOptions.replyTo = CONFIG.REPLY_TO_EMAIL;
    }

    MailApp.sendEmail(emailOptions);
    return true;

  } catch (err) {
    Logger.log("Error sending email: " + err.toString());
    return false;
  }
}

function getColumnMap(sheet) {
  const map = {};
  const headerValues = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  headerValues.forEach((header, index) => {
    if (header) {
      map[String(header).trim()] = index + 1;
    }
  });

  return map;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setupInstallableTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === "onSheetEditTrigger") {
      Logger.log("Trigger 'onSheetEditTrigger' is already installed!");
      return;
    }
  }

  ScriptApp.newTrigger("onSheetEditTrigger")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("✓ Successfully created installable trigger for 'onSheetEditTrigger'!");
}
