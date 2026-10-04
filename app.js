/**
 * ============================================================================
 * EVENT QR GATE VERIFIER - APPLICATION SCRIPT (FULL-PAGE ROUTING)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- STATE CONSTANTS & STORAGE KEYS ---
  const STORAGE_KEY = 'event_qr_scans_v2';
  const LINEAR_IDS_KEY = 'event_qr_linear_ids';
  const THEME_KEY = 'event_app_theme';

  // Space-separated linear Ref ID string state (e.g., "LDVI1 Y5B5A SUB-1001")
  let linearIdString = localStorage.getItem(LINEAR_IDS_KEY) || "";

  // Detailed records object: { [refId]: { refId, name, respondentId, passes, phone, email, utr, firstScannedAt, scanCount, rawPayload } }
  let scanRecords = loadScanRecords();

  // Scanner instance variables
  let html5QrcodeScanner = null;
  let isScanningPaused = false;
  let camerasList = [];
  let currentCamIndex = 0;

  // --- DOM ELEMENTS (PAGE CONTAINERS) ---
  const pages = {
    scanner: document.getElementById('pageScanner'),
    verified: document.getElementById('pageVerified'),
    duplicate: document.getElementById('pageDuplicate'),
    invalid: document.getElementById('pageInvalid')
  };

  // Header & Counter
  const totalScannedCountEl = document.getElementById('totalScannedCount');
  const btnHamburgerMenu = document.getElementById('btnHamburgerMenu');
  const adminDrawerBackdrop = document.getElementById('adminDrawerBackdrop');
  const btnCloseAdminDrawer = document.getElementById('btnCloseAdminDrawer');

  // Admin Actions
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabelText = document.getElementById('themeLabelText');
  const btnExportLog = document.getElementById('btnExportLog');
  const btnResetActivity = document.getElementById('btnResetActivity');

  // Verified View Elements (Green Page)
  const vRefId = document.getElementById('vRefId');
  const vName = document.getElementById('vName');
  const vRespondentId = document.getElementById('vRespondentId');
  const vPasses = document.getElementById('vPasses');
  const vTime = document.getElementById('vTime');
  const vUtr = document.getElementById('vUtr');

  // Duplicate View Elements (Slate Gray Page)
  const dRefId = document.getElementById('dRefId');
  const dName = document.getElementById('dName');
  const dRespondentId = document.getElementById('dRespondentId');
  const dPasses = document.getElementById('dPasses');
  const dScanCount = document.getElementById('dScanCount');
  const dUtr = document.getElementById('dUtr');
  const dFirstScannedAt = document.getElementById('dFirstScannedAt');

  // Invalid View Elements (Crimson Red Page)
  const iRawContent = document.getElementById('iRawContent');

  // Hidden Notes Elements
  const hiddenLinearIds = document.getElementById('hiddenLinearIds');
  const hiddenLinearTimestamps = document.getElementById('hiddenLinearTimestamps');

  // Controls
  const manualRefInput = document.getElementById('manualRefInput');
  const btnManualSubmit = document.getElementById('btnManualSubmit');
  const btnToggleCamera = document.getElementById('btnToggleCamera');
  const qrFileInput = document.getElementById('qrFileInput');
  const btnScanNextList = document.querySelectorAll('.btnScanNext');

  // --- INITIALIZATION ---
  initApp();

  function initApp() {
    initTheme();
    updateHiddenNotesDOM();
    updateUIStats();
    startQRScanner();
    attachEventListeners();
    
    // Initial Route Check
    handleHashRouting();
  }

  // --- THEME MANAGEMENT ---
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    if (theme === 'light') {
      themeIcon.className = 'fa-solid fa-sun';
      themeLabelText.textContent = 'Light Mode Active';
    } else {
      themeIcon.className = 'fa-solid fa-moon';
      themeLabelText.textContent = 'Dark Mode Active';
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }

  // --- HASH-BASED PAGE ROUTING (LOOKS LIKE REAL PAGE REDIRECTS) ---
  function navigateTo(pageName) {
    window.location.hash = `#/${pageName}`;
    renderPage(pageName);
  }

  function handleHashRouting() {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const validPages = ['scanner', 'verified', 'duplicate', 'invalid'];
    const targetPage = validPages.includes(hash) ? hash : 'scanner';
    renderPage(targetPage);
  }

  function renderPage(pageName) {
    Object.keys(pages).forEach(name => {
      if (pages[name]) {
        if (name === pageName) {
          pages[name].classList.add('active');
        } else {
          pages[name].classList.remove('active');
        }
      }
    });

    if (pageName === 'scanner') {
      isScanningPaused = false;
    } else {
      isScanningPaused = true;
    }
  }

  // --- LOCAL STORAGE HELPERS ---
  function loadScanRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Error loading stored scans:", e);
      return {};
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scanRecords));
    localStorage.setItem(LINEAR_IDS_KEY, linearIdString);
    updateHiddenNotesDOM();
    updateUIStats();
  }

  function updateHiddenNotesDOM() {
    if (hiddenLinearIds) {
      hiddenLinearIds.value = linearIdString.trim();
    }
    if (hiddenLinearTimestamps) {
      const timestampPairs = Object.values(scanRecords)
        .map(r => `${r.refId}@${r.firstScannedAt}`)
        .join(' ');
      hiddenLinearTimestamps.value = timestampPairs;
    }
  }

  function updateUIStats() {
    const count = Object.keys(scanRecords).length;
    if (totalScannedCountEl) totalScannedCountEl.textContent = count;
  }

  // --- QR CODE SCANNER LOGIC ---
  function startQRScanner() {
    html5QrcodeScanner = new Html5Qrcode("reader");

    Html5Qrcode.getCameras().then(cameras => {
      if (cameras && cameras.length > 0) {
        camerasList = cameras;
        let backCamIndex = cameras.findIndex(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'));
        currentCamIndex = backCamIndex !== -1 ? backCamIndex : 0;
        
        startCamera(camerasList[currentCamIndex].id);
      } else {
        updateCameraStatus("No Camera Detected", false);
      }
    }).catch(err => {
      console.warn("Camera init error or permissions denied:", err);
      updateCameraStatus("Camera Blocked", false);
    });
  }

  function startCamera(cameraId) {
    const config = { fps: 10, qrbox: { width: 240, height: 240 } };

    html5QrcodeScanner.start(
      cameraId,
      config,
      onScanSuccess,
      onScanError
    ).then(() => {
      updateCameraStatus("Active Scanner", true);
    }).catch(err => {
      console.error("Failed to start camera:", err);
      updateCameraStatus("Camera Error", false);
    });
  }

  function updateCameraStatus(text, isLive) {
    const statusEl = document.getElementById('cameraStatus');
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot ${isLive ? 'green' : ''}"></span> ${text}`;
    }
  }

  function onScanSuccess(decodedText) {
    if (isScanningPaused) return;
    isScanningPaused = true;
    processScannedQrData(decodedText);
  }

  function onScanError() {
    // Silent ignore continuous frame scan errors
  }

  // --- TICKET DATA PARSING & DUPLICATE DETECTION ---
  function processScannedQrData(rawPayload) {
    if (!rawPayload || !rawPayload.trim()) return;

    const ticketData = parseQrPayload(rawPayload);
    const refId = ticketData.refId;
    const formattedNow = formatTimestamp(new Date());

    if (!refId) {
      showInvalidPage(rawPayload);
      return;
    }

    // Convert linear space-separated string to array for exact check
    const existingIds = linearIdString.trim() ? linearIdString.trim().split(/\s+/) : [];
    const isAlreadyScanned = existingIds.includes(refId);

    if (isAlreadyScanned) {
      // DUPLICATE SCAN ATTEMPT -> REDIRECT TO FULL SLATE GRAY PAGE!
      const existingRecord = scanRecords[refId];
      if (existingRecord) {
        existingRecord.scanCount = (existingRecord.scanCount || 1) + 1;
      }
      saveState();

      showDuplicatePage({
        ticketData: ticketData,
        firstScannedAt: existingRecord ? existingRecord.firstScannedAt : 'Unknown',
        scanCount: existingRecord ? existingRecord.scanCount : 2
      });

    } else {
      // FIRST TIME VALID SCAN -> REDIRECT TO FULL LUSH GREEN PAGE!
      linearIdString = linearIdString.trim() ? `${linearIdString.trim()} ${refId}` : refId;

      scanRecords[refId] = {
        refId: refId,
        name: ticketData.name || 'Attendee',
        respondentId: ticketData.respondentId || 'N/A',
        passes: ticketData.passes || '1',
        phone: ticketData.phone || 'N/A',
        email: ticketData.email || 'N/A',
        utr: ticketData.utr || 'N/A',
        firstScannedAt: formattedNow,
        scanCount: 1,
        rawPayload: rawPayload
      };

      saveState();

      showVerifiedPage({
        ticketData: ticketData,
        firstScannedAt: formattedNow
      });
    }
  }

  /**
   * Parses GoQR text format, JSON, or text lines.
   */
  function parseQrPayload(raw) {
    const data = {
      refId: null,
      respondentId: null,
      name: null,
      passes: '1',
      phone: null,
      email: null,
      utr: null
    };

    if (!raw) return data;

    // Check JSON
    if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
      try {
        const obj = JSON.parse(raw);
        data.refId = obj.refId || obj.submissionId || obj.id || obj.respondentId;
        data.respondentId = obj.respondentId || obj.id;
        data.name = obj.name;
        data.passes = obj.passes || obj.numberOfPasses || '1';
        data.phone = obj.phone;
        data.email = obj.email;
        data.utr = obj.utr;
        return data;
      } catch (e) {}
    }

    // Regex key-value line parser
    const lines = raw.split('\n');
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim();

        if (key.includes('ref id') || key.includes('ref') || key.includes('submission id')) {
          data.refId = val;
        } else if (key.includes('respondent id')) {
          data.respondentId = val;
          if (!data.refId) data.refId = val;
        } else if (key.includes('name')) {
          data.name = val;
        } else if (key.includes('pass')) {
          data.passes = val;
        } else if (key.includes('phone')) {
          data.phone = val;
        } else if (key.includes('email')) {
          data.email = val;
        } else if (key.includes('utr')) {
          data.utr = val;
        }
      }
    });

    // Clean word fallback if no regex key matched
    if (!data.refId) {
      const clean = raw.replace(/[^\w\s-]/gi, '').trim();
      const firstWord = clean.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        data.refId = firstWord;
      }
    }

    return data;
  }

  // --- PAGE DISPLAY CONTROLLERS (SIMULATES REAL PAGE REDIRECT) ---
  function showVerifiedPage(opts) {
    const { ticketData, firstScannedAt } = opts;
    vRefId.textContent = ticketData.refId || 'N/A';
    vName.textContent = ticketData.name || 'Attendee';
    vRespondentId.textContent = ticketData.respondentId || 'N/A';
    vPasses.textContent = `${ticketData.passes || '1'} Pass(es)`;
    vTime.textContent = firstScannedAt;
    vUtr.textContent = ticketData.utr || 'N/A';
    
    navigateTo('verified');
  }

  function showDuplicatePage(opts) {
    const { ticketData, firstScannedAt, scanCount } = opts;
    dRefId.textContent = ticketData.refId || 'N/A';
    dName.textContent = ticketData.name || 'Attendee';
    dRespondentId.textContent = ticketData.respondentId || 'N/A';
    dPasses.textContent = `${ticketData.passes || '1'} Pass(es)`;
    dScanCount.textContent = `${scanCount} Scan Attempts`;
    dUtr.textContent = ticketData.utr || 'N/A';
    dFirstScannedAt.textContent = firstScannedAt;
    
    navigateTo('duplicate');
  }

  function showInvalidPage(rawPayload) {
    iRawContent.textContent = rawPayload || "Unreadable QR data";
    navigateTo('invalid');
  }

  // --- EXPORT & SAFE RESET LOGIC ---
  function exportActivityLogCSV() {
    const recordsArr = Object.values(scanRecords);

    if (recordsArr.length === 0) {
      alert("No scanned ticket logs available to export.");
      return false;
    }

    const headers = ["Ref ID", "Respondent ID", "Attendee Name", "Arrival Time (First Scan)", "Passes", "Total Scan Count", "Payment UTR", "Status"];
    
    const rows = recordsArr.map(rec => [
      `"${rec.refId || ''}"`,
      `"${rec.respondentId || ''}"`,
      `"${rec.name || ''}"`,
      `"${rec.firstScannedAt || ''}"`,
      `"${rec.passes || '1'}"`,
      rec.scanCount || 1,
      `"${rec.utr || ''}"`,
      rec.scanCount > 1 ? "DUPLICATE SCAN DETECTED" : "VERIFIED FIRST ENTRY"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestampFilename = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `event_arrival_log_${timestampFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  function safeResetActivity() {
    const recordsArr = Object.values(scanRecords);

    if (recordsArr.length === 0) {
      alert("Activity log is already empty.");
      return;
    }

    if (confirm("Resetting activity log will start a fresh gate session.\n\nYour existing log data will be AUTOMATICALLY DOWNLOADED first as a CSV backup file so no data is lost.\n\nProceed to backup and reset?")) {
      // 1. Auto-download backup CSV
      exportActivityLogCSV();

      // 2. Clear state
      setTimeout(() => {
        linearIdString = "";
        scanRecords = {};
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LINEAR_IDS_KEY);
        
        updateHiddenNotesDOM();
        updateUIStats();
        closeAdminDrawer();
        navigateTo('scanner');
        alert("✓ Final data backup downloaded!\n✓ Activity log reset complete for fresh session.");
      }, 500);
    }
  }

  // --- EVENT LISTENERS ---
  function attachEventListeners() {

    // Hash change event (Browser Back / Forward button support)
    window.addEventListener('hashchange', handleHashRouting);

    // Scan Next Ticket Buttons (Returns to Scanner Page)
    btnScanNextList.forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo('scanner');
      });
    });

    // Admin Hamburger Menu Open/Close
    if (btnHamburgerMenu) {
      btnHamburgerMenu.addEventListener('click', openAdminDrawer);
    }
    if (btnCloseAdminDrawer) {
      btnCloseAdminDrawer.addEventListener('click', closeAdminDrawer);
    }
    if (adminDrawerBackdrop) {
      adminDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === adminDrawerBackdrop) closeAdminDrawer();
      });
    }

    // Theme Toggle Button
    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', toggleTheme);
    }

    // Export Log Button
    if (btnExportLog) {
      btnExportLog.addEventListener('click', () => {
        exportActivityLogCSV();
        closeAdminDrawer();
      });
    }

    // Safe Reset Button
    if (btnResetActivity) {
      btnResetActivity.addEventListener('click', safeResetActivity);
    }

    // Manual Submit
    if (btnManualSubmit) {
      btnManualSubmit.addEventListener('click', handleManualSubmit);
    }
    if (manualRefInput) {
      manualRefInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleManualSubmit();
      });
    }

    // Camera Switch
    if (btnToggleCamera) {
      btnToggleCamera.addEventListener('click', toggleCamera);
    }

    // QR Image File Upload
    if (qrFileInput) {
      qrFileInput.addEventListener('change', handleFileUpload);
    }
  }

  function openAdminDrawer() {
    if (adminDrawerBackdrop) adminDrawerBackdrop.classList.add('active');
  }

  function closeAdminDrawer() {
    if (adminDrawerBackdrop) adminDrawerBackdrop.classList.remove('active');
  }

  function handleManualSubmit() {
    const val = manualRefInput.value.trim();
    if (!val) return;
    manualRefInput.value = '';
    processScannedQrData(`Ref ID: ${val}`);
  }

  function toggleCamera() {
    if (camerasList.length <= 1) {
      alert("Only one camera device detected.");
      return;
    }
    currentCamIndex = (currentCamIndex + 1) % camerasList.length;
    html5QrcodeScanner.stop().then(() => {
      startCamera(camerasList[currentCamIndex].id);
    });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.scanFile(file, true)
      .then(decodedText => {
        processScannedQrData(decodedText);
      })
      .catch(() => {
        showInvalidPage("Uploaded image does not contain a readable QR code.");
      });
  }

  function formatTimestamp(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

});
