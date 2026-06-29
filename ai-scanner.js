/* ===== AI RECEIPT SCANNER — OCR with Tesseract.js ===== */

/** Initialize receipt scanner UI and event handlers */
function initReceiptScanner() {
  const dropZone = document.getElementById('receipt-drop-zone');
  const fileInput = document.getElementById('scan-file-input');
  const scanBtn = document.getElementById('scan-receipt-btn');

  if (!dropZone) return;

  /* Click to open file picker */
  dropZone.addEventListener('click', function(e) {
    if (e.target.closest('.scan-results') || e.target.closest('.scan-progress')) return;
    fileInput.click();
  });

  /* File input change */
  fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) handleScanFile(this.files[0]);
  });

  /* Drag and drop */
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault(); dropZone.classList.add('active');
  });
  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('active');
  });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault(); dropZone.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleScanFile(e.dataTransfer.files[0]);
  });

  /* Scan Receipt button in toolbar */
  if (scanBtn) {
    scanBtn.addEventListener('click', function() {
      document.getElementById('expense-form').reset();
      document.getElementById('exp-id').value = '';
      document.getElementById('exp-date').value = today();
      document.getElementById('expense-modal-title').textContent = 'Scan Receipt';
      document.getElementById('receipt-preview').innerHTML = '';
      document.getElementById('scan-results').style.display = 'none';
      document.getElementById('scan-progress').style.display = 'none';
      openModal('expense-modal');
      /* Brief delay then trigger file picker */
      setTimeout(() => fileInput.click(), 300);
    });
  }
}

/** Handle scanned file — run OCR */
async function handleScanFile(file) {
  if (!file) return;
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|pdf)$/i)) {
    toast('Please upload an image or PDF file', 'error');
    return;
  }

  /* Show preview for images */
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('receipt-preview').innerHTML = `<img src="${e.target.result}">`; };
    reader.readAsDataURL(file);
  }

  /* Check if Tesseract is available */
  if (typeof Tesseract === 'undefined') {
    toast('Receipt scanner loading... please try again in a moment', 'warning');
    return;
  }

  /* Show progress */
  const progressEl = document.getElementById('scan-progress');
  const progressFill = document.getElementById('scan-progress-fill');
  const progressText = document.getElementById('scan-progress-text');
  const resultsEl = document.getElementById('scan-results');
  progressEl.style.display = 'block';
  resultsEl.style.display = 'none';
  progressFill.style.width = '0%';
  progressText.textContent = 'Initializing scanner...';

  try {
    const result = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = `Scanning... ${pct}%`;
        } else {
          progressText.textContent = m.status || 'Processing...';
        }
      }
    });

    progressFill.style.width = '100%';
    progressText.textContent = 'Scan complete!';

    const extracted = parseReceiptText(result.data.text);
    showScanResults(extracted);
    autoFillFromScan(extracted);

    setTimeout(() => { progressEl.style.display = 'none'; }, 1500);
  } catch (err) {
    console.error('OCR Error:', err);
    progressEl.style.display = 'none';
    toast('Failed to scan receipt. Try a clearer image.', 'error');
  }
}

/** Parse OCR text to extract receipt fields */
function parseReceiptText(text) {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const fullText = text || '';
  const lower = fullText.toLowerCase();
  let vendor = null, amount = null, date = null, tax = null;

  /* Extract vendor — typically first non-trivial line */
  for (const line of lines) {
    if (line.length >= 3 && !line.match(/^[\d\/\-\.\s₹$,]+$/) && !line.match(/^(date|time|total|sub|gst|tax|cgst|sgst|invoice|bill|receipt)/i)) {
      vendor = line.slice(0, 60);
      break;
    }
  }

  /* Extract amount — look for total/grand total/net amount patterns */
  const amountPatterns = [
    /(?:grand\s*total|total\s*amount|net\s*amount|total\s*payable|amount\s*due|total)\s*[:=]?\s*₹?\s*[\d,]+\.?\d*/gi,
    /₹\s*[\d,]+\.?\d*/g,
    /(?:rs\.?|inr)\s*[\d,]+\.?\d*/gi,
    /\b\d{1,3}(?:,\d{3})*\.?\d{0,2}\b/g,
  ];

  for (const pattern of amountPatterns) {
    const matches = fullText.match(pattern);
    if (matches) {
      for (const m of matches) {
        const num = parseFloat(m.replace(/[₹,\s]|rs\.?|inr/gi, '').match(/[\d.]+/)?.[0] || '0');
        if (num > 0 && num < 10000000) {
          if (!amount || num > amount) amount = num;
        }
      }
      if (amount) break;
    }
  }

  /* Extract date */
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,   /* DD/MM/YYYY or DD-MM-YYYY */
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,     /* DD/MM/YY */
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,     /* YYYY-MM-DD */
  ];

  for (const pattern of datePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      try {
        let dateStr;
        if (match[0].match(/^\d{4}/)) {
          dateStr = match[0]; /* YYYY-MM-DD format */
        } else {
          const parts = match[0].replace(/[\/\-]/g, '/').split('/');
          if (parts.length === 3) {
            let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            dateStr = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (dateStr && !isNaN(new Date(dateStr).getTime())) {
          date = dateStr;
          break;
        }
      } catch (e) { /* skip invalid dates */ }
    }
  }

  /* Extract tax (GST/CGST/SGST) */
  const taxMatch = fullText.match(/(?:gst|cgst|sgst|tax|vat)\s*[:=]?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (taxMatch) {
    tax = parseFloat(taxMatch[1].replace(/,/g, ''));
  }

  /* Auto categorize */
  const category = autoCategorize(fullText.slice(0, 500));

  /* Calculate confidence */
  let confidence = 30;
  if (vendor) confidence += 15;
  if (amount) confidence += 25;
  if (date) confidence += 20;
  if (tax) confidence += 10;

  return { vendor, amount, date, tax, category, rawText: fullText.slice(0, 1000), confidence: Math.min(95, confidence) };
}

/** Show extracted scan results in the UI */
function showScanResults(data) {
  const el = document.getElementById('scan-results');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `
    <div style="font-size:0.75rem;font-weight:600;color:var(--green);margin-bottom:8px;display:flex;align-items:center;gap:4px;">${icon('check-circle',14)} Extracted Fields (${data.confidence}% confidence)</div>
    <div class="scan-field"><span class="scan-field-label">Vendor</span><span class="scan-field-value">${data.vendor || '—'}</span></div>
    <div class="scan-field"><span class="scan-field-label">Amount</span><span class="scan-field-value">${data.amount ? fmtCurrency(data.amount) : '—'}</span></div>
    <div class="scan-field"><span class="scan-field-label">Date</span><span class="scan-field-value">${data.date || '—'}</span></div>
    <div class="scan-field"><span class="scan-field-label">Tax</span><span class="scan-field-value">${data.tax ? fmtCurrency(data.tax) : '—'}</span></div>
    <div class="scan-field"><span class="scan-field-label">Category</span><span class="scan-field-value">${getCat(data.category).icon} ${getCat(data.category).name}</span></div>
    <div style="margin-top:8px;font-size:0.72rem;color:var(--text-3)">Fields auto-filled. Review and correct before saving.</div>`;
}

/** Auto-fill expense form from scanned data */
function autoFillFromScan(data) {
  if (data.vendor) document.getElementById('exp-desc').value = data.vendor;
  if (data.amount) document.getElementById('exp-amount').value = data.amount;
  if (data.date) document.getElementById('exp-date').value = data.date;
  if (data.category) document.getElementById('exp-category').value = data.category;

  const confEl = document.getElementById('cat-confidence');
  if (confEl) confEl.textContent = `(${data.confidence}% confidence)`;

  toast(`Receipt scanned! ${data.confidence}% confidence`, data.confidence >= 60 ? 'success' : 'warning');
}
