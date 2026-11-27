/* ============================================================
   Utility helpers
   ============================================================ */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str){
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtMoney(n) {
  const s = DB.settings();
  const num = Number(n) || 0;
  const sign = num < 0 ? '-' : '';
  const v = Math.abs(Math.round(num));
  return `${sign}${s.currency} ${v.toLocaleString()}`;
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtDateShort(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function isoDay(d=new Date()) { return d.toISOString().slice(0,10); }

function getGreeting() {
  const h = new Date().getHours();
  const useT = (typeof t === 'function');
  if (h < 12) return { text: useT ? t('greet.morning') : 'Good Morning', emoji: '🌅' };
  if (h < 17) return { text: useT ? t('greet.afternoon') : 'Good Afternoon', emoji: '☀️' };
  if (h < 21) return { text: useT ? t('greet.evening') : 'Good Evening', emoji: '🌇' };
  return { text: useT ? t('greet.night') : 'Good Night', emoji: '🌙' };
}

/* ====== Toasts ====== */
function toast(msg, type='success') {
  const div = el(`<div class="toast ${type}">${escapeHtml(msg)}</div>`);
  $('#toast-container').appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transform = 'translateX(100%)'; div.style.transition = '.2s'; }, 2200);
  setTimeout(() => div.remove(), 2500);
}

/* ====== Modal ======
   Data-entry safety:
   • clicking the dark backdrop does NOT close a form any more (that is how
     entered data used to disappear by accident)
   • a form closes only via the ✕ button, the Esc key, or its own Save/Cancel
   • if the user has typed anything, ✕ / Esc first asks "discard?" and the
     form stays exactly as it was if they choose to keep editing
   ================================================================== */
let _modalDirty = false;
let _modalOpts = {};
let _modalHintAt = 0;

function openModal(innerHtml, opts = {}) {
  closeModal();
  const wrap  = el(`<div class="modal-backdrop"><div class="modal-shell ${opts.large ? 'lg' : ''}"><div class="modal ${opts.large ? 'lg' : ''}"></div></div></div>`);
  const shell = wrap.querySelector('.modal-shell');
  const card  = wrap.querySelector('.modal');
  card.innerHTML = innerHtml;

  /* ✕ close button — always available unless explicitly disabled */
  if (opts.closable !== false) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'modal-x';
    x.setAttribute('aria-label', 'Close');
    x.title = 'Close (Esc)';
    x.textContent = '✕';
    x.onclick = (ev) => { ev.stopPropagation(); attemptCloseModal(); };
    shell.appendChild(x);
  }

  $('#modal-root').appendChild(wrap);

  /* remember whether the user typed / changed anything */
  _modalDirty = false;
  const markDirty = (e) => {
    const t = e.target;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) _modalDirty = true;
  };
  card.addEventListener('input',  markDirty, true);
  card.addEventListener('change', markDirty, true);

  /* backdrop click: keep the form open, give a short hint instead */
  wrap.addEventListener('click', (e) => {
    if (e.target !== wrap) return;
    if (opts.backdropClose === true) { attemptCloseModal(); return; }
    nudgeModal(shell);
  });

  _modalOpts = opts;
  if (opts.onOpen) opts.onOpen(card);
  return card;
}

function closeModal() {
  _modalDirty = false;
  _modalOpts = {};
  $('#modal-root').innerHTML = '';
}

/* User-initiated close (✕ / Esc / backdrop). Asks before losing typed data. */
function attemptCloseModal() {
  const card = document.querySelector('#modal-root .modal');
  if (!card) { closeModal(); return; }
  if (_modalDirty && _modalOpts.dirtyGuard !== false) {
    askDiscard(card);
    return;
  }
  closeModal();
}

/* inline confirm strip inside the modal — never destroys the form */
function askDiscard(card) {
  if (card.querySelector('.modal-discard')) {
    card.querySelector('.modal-discard [data-keep]').focus();
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'modal-discard';
  bar.innerHTML = `
    <span>⚠️ You have entered information that has not been saved.</span>
    <div class="modal-discard-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-keep>Keep editing</button>
      <button type="button" class="btn btn-danger btn-sm" data-discard>Discard &amp; close</button>
    </div>`;
  bar.querySelector('[data-keep]').onclick = () => bar.remove();
  bar.querySelector('[data-discard]').onclick = () => { _modalDirty = false; closeModal(); };
  card.appendChild(bar);
  try { bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
}

/* small shake + one short toast so it is obvious the backdrop is not a close button */
function nudgeModal(shell) {
  if (!shell) return;
  shell.classList.remove('modal-nudge');
  void shell.offsetWidth;
  shell.classList.add('modal-nudge');
  const now = Date.now();
  if (now - _modalHintAt > 4000) {
    _modalHintAt = now;
    toast('Form stays open — use ✕ or press Esc to close', 'warning');
  }
}

/* Esc closes the modal (and only the modal), ahead of any other shortcut */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.keyCode !== 27) return;
  if (!document.querySelector('#modal-root .modal')) return;
  if (document.querySelector('.photo-viewer, .pv-overlay')) return; // full-screen viewer handles its own Esc
  e.preventDefault();
  e.stopPropagation();
  attemptCloseModal();
}, true);

/* ====== Confirm ====== */
function confirmDialog(msg, onYes) {
  openModal(`
    <h3>Confirm</h3>
    <p class="sub">${escapeHtml(msg)}</p>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-danger" id="yesBtn">Yes, Continue</button>
    </div>
  `, { onOpen(m) {
    m.querySelector('#cancelBtn').onclick = closeModal;
    m.querySelector('#yesBtn').onclick = () => { closeModal(); onYes(); };
  }});
}

/* ====== Download file helper ====== */
function downloadFile(filename, content, mime='application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


/* Add data-label attribute to all table cells based on their header.
   This powers the mobile card-style table layout (responsive.css). */
function autoLabelTableCells() {
  document.querySelectorAll('table.tbl').forEach(table => {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    if (!headers.length) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        if (headers[i] && !td.hasAttribute('data-label')) {
          td.setAttribute('data-label', headers[i]);
        }
      });
    });
  });
}

/* Run after any DOM change in #app */
(function setupAutoLabel() {
  if (typeof MutationObserver === 'undefined') return;
  const target = document.getElementById('app') || document.body;
  if (!target) return;
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { autoLabelTableCells(); pending = false; }, 50);
  });
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const t = document.getElementById('app') || document.body;
      if (t) obs.observe(t, { childList: true, subtree: true });
    });
  } else {
    obs.observe(target, { childList: true, subtree: true });
  }
})();

/* === Universal print helper — bulletproof version ===
   Inlines all images (data URLs) and styles so print window has zero load time.
   Works perfectly with thermal printers and all browsers. */
/* ============================================================
   THERMAL TEXT SAFETY
   Thermal printers have no colour and no emoji font. Any emoji
   in the slip prints as a blank box or garbage, so they are
   removed before printing. Symbols that DO render on thermal
   (stars, arrows, bullets) are kept.
   ============================================================ */
function thermalSafeText(str) {
  if (!str) return str;
  const KEEP = new Set([0x2605, 0x2606, 0x2022, 0x00B7, 0x2192, 0x2190, 0x2191, 0x2193,
                        0x2713, 0x2717, 0x25B8, 0x25C2, 0x2500, 0x2502]);
  let out = '';
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (KEEP.has(cp)) { out += ch; continue; }
    // drop emoji / pictographs / variation selectors
    if ((cp >= 0x1F000 && cp <= 0x1FAFF) ||   // emoji blocks
        (cp >= 0x2600 && cp <= 0x27BF) ||     // misc symbols + dingbats
        (cp >= 0x2B00 && cp <= 0x2BFF) ||     // ⭐ etc.
        (cp >= 0xFE00 && cp <= 0xFE0F) ||     // variation selectors
        cp === 0x200D ||                      // zero-width joiner
        cp === 0x20E3) {                      // keycap
      continue;
    }
    out += ch;
  }
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.:;])/g, '$1');
}

/* Walk every text node in a cloned print element and strip emoji. */
function thermalCleanTextNodes(root) {
  if (!root || !root.ownerDocument) return;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const cleaned = thermalSafeText(n.nodeValue);
    if (cleaned !== n.nodeValue) n.nodeValue = cleaned;
  });
}

async function printElement(elementOrSelector, options) {
  options = options || {};
  let el;
  if (typeof elementOrSelector === 'string') {
    el = document.querySelector(elementOrSelector);
  } else {
    el = elementOrSelector;
  }
  if (!el) { alert('Print content not found'); return false; }

  // Clone the element to manipulate safely
  const clone = el.cloneNode(true);

  // Step 1: Convert all canvases to images
  const sourceCanvases = el.querySelectorAll ? el.querySelectorAll('canvas') : [];
  const cloneCanvases = clone.querySelectorAll('canvas');
  cloneCanvases.forEach((cv, i) => {
    if (sourceCanvases[i]) {
      try {
        const img = document.createElement('img');
        img.src = sourceCanvases[i].toDataURL('image/png');
        img.width = sourceCanvases[i].width;
        img.height = sourceCanvases[i].height;
        cv.parentNode.replaceChild(img, cv);
      } catch(e) {}
    }
  });

  // Step 2b-pre: thermal logo must be READY before printing.
  // The processed 1-bit bitmap is built asynchronously; if it is not cached yet
  // the receipt would print the raw colour logo (grey, oversized, washed out).
  if (options.awaitThermal !== false && typeof THERMAL !== 'undefined') {
    try { await THERMAL.prepare(); } catch (e) {}
  }

  // Refresh every thermal logo in the clone with the freshly processed bitmap.
  try {
    const st = (typeof DB !== 'undefined' && DB.settings) ? DB.settings() : {};
    const tin = (typeof THERMAL !== 'undefined') ? THERMAL.info(st) : null;
    if (tin && st.invoiceLogoMono !== false) {
      clone.querySelectorAll('img.inv-logo').forEach(img => {
        img.setAttribute('src', tin.dataUrl);
        img.setAttribute('style',
          'width:' + tin.mm + 'mm;max-width:' + tin.mm + 'mm;height:auto;max-height:' +
          tin.mmH + 'mm;object-fit:contain;background:#fff;padding:0;image-rendering:pixelated;display:block;margin:0 auto;');
      });
    }
  } catch (e) {}

  // Step 2: Convert all <img> src to absolute URLs OR data URLs
  const images = clone.querySelectorAll('img');
  const imagePromises = [];
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    // Already data URL? Skip
    if (src.startsWith('data:')) return;
    // Make absolute URL
    const absUrl = new URL(src, location.href).href;
    img.src = absUrl;
    // Convert to data URL using fetch (works for same-origin)
    imagePromises.push(
      fetch(absUrl)
        .then(r => r.blob())
        .then(blob => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => { img.src = reader.result; resolve(); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
        .catch(() => { /* leave URL as-is */ })
    );
  });
  await Promise.all(imagePromises);

  // Step 2b: thermal printers cannot render emoji — strip them
  let paper = '80', marginMm = 2, isThermal = true, rawPaperMm = 0;
  try {
    const st = (typeof DB !== 'undefined' && DB.settings) ? DB.settings() : {};
    paper = st.invoicePaper === '58' ? '58' : '80';
    marginMm = (st.invoiceMarginMm != null) ? Math.max(0, Math.min(10, +st.invoiceMarginMm)) : 2;
    rawPaperMm = (+st.invoiceRawPaperMm || 0);   // printer ki asli paper width (agar user ne set ki)
    isThermal = (options.paper !== 'laser') && (st.invoicePaper !== 'laser');
  } catch (e) {}
  if (isThermal) thermalCleanTextNodes(clone);

  // Step 3: Get HTML with all images inlined
  const html = clone.outerHTML;

  // Step 4: Inline the stylesheets — but ONLY the parts that apply to paper.
  //
  // Why: the app's own stylesheet contains
  //     @media print { body * { visibility: hidden }  #printArea, #printArea * { visibility: visible } }
  // which is right for printing the live screen, but this window prints a
  // DETACHED slip. Copying that rule here made every detached slip (partial
  // delivery, payment receipt, challan, PO, claim…) invisible on paper and in
  // "Save as PDF" — the print preview on screen looked fine, the PDF was blank.
  // So: keep everything outside @media blocks + all @media print blocks, and
  // drop @media screen blocks (app-shell cosmetics, never printed).
  const MEDIA_RULE = (typeof CSSRule !== 'undefined' && CSSRule.MEDIA_RULE) || 4;
  const SUPPORTS_RULE = (typeof CSSRule !== 'undefined' && CSSRule.SUPPORTS_RULE) || 12;
  const keepForPrint = (rules, out) => {
    for (const rule of rules) {
      if (rule.type === MEDIA_RULE) {
        const mt = (rule.conditionText || rule.media && rule.media.mediaText || '').toLowerCase();
        if (mt.indexOf('print') !== -1) out.push(rule.cssText);
        else if (rule.cssRules && rule.cssRules.length) keepForPrint(rule.cssRules, out);
      } else if (rule.type === SUPPORTS_RULE) {
        if (rule.cssRules) keepForPrint(rule.cssRules, out);
      } else {
        out.push(rule.cssText);
      }
    }
  };
  let styleText = '';
  try {
    const acc = [];
    for (const sheet of document.styleSheets) {
      try {
        keepForPrint(sheet.cssRules, acc);
      } catch(e) {
        // External stylesheet — fetch it
        if (sheet.href) {
          try {
            const r = await fetch(sheet.href);
            if (r.ok) {
              const text = await r.text();
              // strip @media screen blocks, keep the rest
              acc.push(text.replace(/@media[^{]*screen[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi,
                m => (/@media[^{]*print/i.test(m) ? m : '')));
            }
          } catch(e) {}
        }
      }
    }
    styleText = acc.join('\n');
  } catch (e) { styleText = ''; }

  // Step 5: Ek alag document bana kar PRINT karein — magar popup window ke bagair.
  //
  // Kyun: purana tareeqa popup + document.write tha. Chrome/Edge is par kabhi kabhi
  // print preview ko `about:blank` par atka deta hai (client ke yahan yahi hua) —
  // print dialog khulta hai magar settings load nahi hotin aur Print button dead ho jata hai.
  // Ab hidden iframe use karte hain: same-origin, koi popup blocker nahi, koi blank page nahi.
  const printDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${options.title || 'Print'}</title>
<style>
${styleText}
/* === Print overrides — MAX VISIBILITY === */
* { box-sizing: border-box; }
html, body {
  margin: 0 !important; padding: 0 !important;
  background: #fff !important; color: #000 !important;
  font-family: Arial, 'Helvetica Neue', sans-serif !important;
  visibility: visible !important;
}
#printArea, #printArea * { visibility: visible !important; }
.no-print, .no-print *, .modal-footer, .modal-header .btn { display: none !important; }
.no-print, .modal-backdrop, .modal-footer, .modal > div:first-child[class*="no-print"] { display: none !important; }
.invoice-page {
  display: block !important;
  visibility: visible !important;
  color: #000 !important;
  background: #fff !important;
  font-family: Arial, sans-serif !important;
  font-weight: 600 !important;
  padding: 8px !important;
  margin: 0 auto !important;
  max-width: 100% !important;
}
.invoice-page * { color: #000 !important; visibility: visible !important; }
.invoice-page h2 { font-weight: 900 !important; }
.invoice-page b, .invoice-page strong { font-weight: 900 !important; }
.qty-circle {
  background: #fff !important; color: #000 !important; border: 4px solid #000 !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
  flex-direction: column !important; margin: 14px auto !important;
}
.qty-circle * { color: #000 !important; }
.del-type-pill { background: #fff !important; color: #000 !important; border: 2px solid #000 !important; }
img {
  max-width: 100%; display: inline-block; visibility: visible !important;
  image-rendering: -webkit-optimize-contrast; -ms-interpolation-mode: nearest-neighbor;
}
.inv-logo { max-width: 100% !important; height: auto !important; margin: 0 auto !important; display: block !important; }

/* === PAPER EDGE SAFETY === */
html, body, #printArea, #printArea * {
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  white-space: normal !important;
}
.invoice-page, .inv-slip { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; }
table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
table td, table th { overflow-wrap: anywhere !important; word-break: break-word !important; }
table td:first-child, table th:first-child { width: 46% !important; }
table td:last-child,  table th:last-child  { width: 54% !important; }
/* OFFICE COPY: apni table widths (values ko poori jagah) */
.invoice-office table td:first-child, .invoice-office table th:first-child,
.invoice-office table td:last-child,  .invoice-office table th:last-child { width: auto !important; }
.invoice-office table.kv td:first-child { width: 36% !important; }
.invoice-office table.kv td:last-child  { width: 64% !important; }
/* Labels (.nw class) pehle se nowrap hain — poore cell par nowrap nahi,
   warna lamba customer naam ya amount cut ho jata hai. */
/* Jo cheez tootni nahi chahiye (invoice no, phone, tareekh, amount) */
#printArea .nw, .invoice-page .nw { white-space: nowrap !important; word-break: keep-all !important; }
/* Poori chaurai wale blocks (terms / timings / credit) — table width rules inhein na chhuein */
#printArea .block-wide, .invoice-page .block-wide,
#printArea .dev-credit, .invoice-page .dev-credit { width: 100% !important; max-width: 100% !important; display: block !important; }
#printArea .dev-credit img, .invoice-page .dev-credit img { max-width: 100% !important; }
table td:last-child, td:last-child, .amt, .amount { text-align: right !important; white-space: normal !important; }
div, span, tr, td { box-sizing: border-box !important; }
img, canvas, svg { max-width: 100% !important; height: auto !important; }

.print-slip { page-break-inside: avoid; page-break-after: always; break-after: page; display: block !important; margin: 0 auto; }
.print-slip:last-child { page-break-after: auto; break-after: auto; }
.print-page-break { page-break-after: always; break-after: page; height: 0; }

/* ===== PRINT SIZE CONTROL (client: "print bohat chhota aa raha hai") =====
   Store ki image 600px+ chaudi hoti hai, is liye Chrome usay shrink kar deta tha
   aur print chhota aata tha. Screen par bhi slips ka sahi print size dikhate hain
   taake ghalat-fehmi na ho. */
@media screen {
  .print-slip, .invoice-page { font-size: 11px; }
  .invoice-page .inv-big-no { font-size: 26px !important; }
}

@media print {
  /* Chrome ke "Default" margins ko 0 karna: @page margin 0 se Chrome khud
     Margins = Default par 0 le leta hai (client ke yahan "Default" 12mm tha). */
  /* ⚠️ PEHLE "size: 80mm auto" tha — Chrome is ko theek se handle nahi karta aur
     "3 sheets of paper" bana deta tha. Aur "594mm" (do copy ek page) print dialog me
     ghair-mamooli paper dikhata tha. Ab: HAR COPY = 297mm (ek roll page). */
  @page { size: ${rawPaperMm || paper}mm 297mm; margin: 0 !important; }

  /* === COMPACT RECEIPT ===
     Thermal roll par kaghaz bachane + text bara dikhane ke liye spacing tight:
     pehle ek 1-item invoice 3-4 sheets leta tha (scale 65% par bhi), ab ~1-1.5. */
  .invoice-page { line-height: 1.32 !important; }
  .invoice-page table td, .invoice-page table th { padding: 2px 0 !important; }
  .invoice-page { padding: 4px !important; }
  .invoice-page div[style*="margin-bottom:12px"],
  .invoice-page div[style*="margin-bottom:14px"],
  .invoice-page div[style*="margin-bottom:16px"] { margin-bottom: 6px !important; }
  .invoice-page div[style*="margin-top:12px"],
  .invoice-page div[style*="margin-top:14px"],
  .invoice-page div[style*="margin-top:16px"] { margin-top: 6px !important; }
  .qty-circle { width: 78px !important; height: 78px !important; margin: 6px auto !important; border-width: 3px !important; }
  .qty-circle .num { font-size: 30px !important; }
  .qty-circle .lbl { font-size: 8px !important; letter-spacing: .5px !important; }
  .del-type-pill { padding: 2px 10px !important; font-size: 11px !important; }
  .inv-logo { max-height: 56mm !important; width: auto !important; }
  hr { margin: 3px 0 !important; }

  /* === ONE PAGE RULE ===
     Client ka masla: print par wohi invoice 30+ dafa aa raha tha (33 page).
     Wajah: page-break-after + absolute positioning + content page se lamba.
     Ab DETERMINISTIC: har slip ki FIXED height 297mm (= ek roll page), andar fit
     kar diya jata hai. Pagination khud hoti hai — koi forced break nahi. */
  #printArea, #printArea * { position: static !important; }
  .print-slip, .invoice-page {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-after: auto !important;
    break-after: auto !important;
    position: relative !important;
  }
  .print-slip {
    display: block !important;
    width: 100% !important;
    /* ⚠️ FIXED height (297mm) NAHI — content ke mutabiq natural height.
       Warna slip se lamba content (15 items + terms) cut ho jata tha. */
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
    break-after: page !important;         /* har copy apni page par (= 2 pages, 33 nahi) */
    page-break-after: always !important;
  }
  .print-slip:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }
  /* === COMPACT MODE — 3 darje ===
     Jitna zaroori ho utna hi tight karo; font jitna bara mumkin ho.
     fitSlipsToPage() khud level chunta hai (cmp1 → cmp2 → cmp3 → phir font). */
  .print-slip.cmp1 .invoice-page { line-height: 1.2 !important; padding: 2px !important; }
  .print-slip.cmp1 .invoice-page table td,
  .print-slip.cmp1 .invoice-page table th { padding: 1px 0 !important; }
  .print-slip.cmp1 .invoice-page table { line-height: 1.24 !important; }
  .print-slip.cmp1 .inv-logo { max-height: 46mm !important; }
  .print-slip.cmp1 hr { margin: 2px 0 !important; }
  .print-slip.cmp1 .inv-terms { margin-top: 4px !important; padding-top: 3px !important; }
  .print-slip.cmp1 .inv-terms-body > div { margin-bottom: 0 !important; }
  .print-slip.cmp1 .dev-credit { margin-top: 4px !important; padding-top: 3px !important; }

  .print-slip.cmp2 .invoice-page table td,
  .print-slip.cmp2 .invoice-page table th { padding: 0 !important; }
  .print-slip.cmp2 .invoice-page table { line-height: 1.16 !important; }
  .print-slip.cmp2 .inv-logo { max-height: 38mm !important; }
  .print-slip.cmp2 .inv-terms { margin-top: 3px !important; padding-top: 2px !important; }
  .print-slip.cmp2 .inv-terms-head { font-size: 10px !important; margin-bottom: 3px !important; }
  .print-slip.cmp2 .inv-terms-body { font-size: 9.6px !important; line-height: 1.26 !important; }
  .print-slip.cmp2 .block-wide { font-size: 9.2px !important; line-height: 1.24 !important; }
  .print-slip.cmp2 .dev-credit { margin-top: 3px !important; padding-top: 2px !important; font-size: 7px !important; }
  .print-slip.cmp2 .dev-credit img { max-height: 9mm !important; }

  .print-slip.cmp3 .inv-terms-body { font-size: 9.2px !important; line-height: 1.24 !important; }
  .print-slip.cmp3 .inv-terms-head { font-size: 9.6px !important; }
  .print-slip.cmp3 .block-wide { font-size: 8.8px !important; line-height: 1.22 !important; }
  .print-slip.cmp3 .inv-logo { max-height: 30mm !important; }
  .print-slip.cmp3 .dev-credit { font-size: 6.4px !important; }
  .print-slip.cmp3 .invoice-page table { line-height: 1.12 !important; }

  /* === cmp4 — bahut bhari invoice: terms/timings/credit compact (par mojood) === */
  .print-slip.cmp4 .inv-terms { margin-top: 2px !important; padding-top: 1px !important; }
  .print-slip.cmp4 .inv-terms-body > div { margin-bottom: 0 !important; }
  .print-slip.cmp4 .inv-no-box { margin: 1px 0 3px !important; padding-bottom: 4px !important; }
  .print-slip.cmp4 .inv-terms-head { font-size: 9.2px !important; margin-bottom: 2px !important; }
  .print-slip.cmp4 .inv-terms-body { font-size: 8.8px !important; line-height: 1.22 !important; }
  .print-slip.cmp4 .block-wide { font-size: 7.4px !important; line-height: 1.14 !important; }
  .print-slip.cmp4 .inv-head { font-size: 9.2px !important; line-height: 1.15 !important; }
  .print-slip.cmp4 .inv-footer { font-size: 9.5px !important; margin-top: 4px !important; }
  .print-slip.cmp4 .inv-terms-body { font-size: 9.4px !important; line-height: 1.16 !important; }
  .print-slip.cmp4 .inv-terms-head { font-size: 9.4px !important; margin-bottom: 2px !important; }
  .print-slip.cmp4 .dev-credit { margin-top: 1px !important; padding-top: 1px !important; }
  .print-slip.cmp4 .dev-credit img { max-height: 5mm !important; }
  .print-slip.cmp4 .dev-credit::after { margin-top: 2px !important; padding-top: 1px !important; padding-bottom: 1px !important; }
  .print-slip.cmp4 .inv-logo { max-height: 20mm !important; }
  .print-slip.cmp4 .invoice-page table { line-height: 1.08 !important; }
  .print-slip.cmp4 .dev-credit { font-size: 6px !important; margin-top: 2px !important; }
  .print-slip.cmp4 .dev-credit img { max-height: 7mm !important; }

  /* Slip ke andar ka receipt natural flow me — ek hi andar page break */
  .print-slip .invoice-page {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .print-page-break { display: none !important; height: 0 !important; }
  /* lambe items/terms: line-height thora aur tight */
  .invoice-page table { line-height: 1.22 !important; }
  .invoice-page > div { margin-top: 2px !important; margin-bottom: 2px !important; }
  .invoice-page { padding: 3px !important; }
  /* Logo BARA (client: "logo big karo, bohat chota hai") — par slip par qabza na kare */
  .inv-logo { max-height: 56mm !important; width: auto !important; }
  /* Terms: chhota par parhne ke qabil (isi liye credit + sab page 1 par aa jata hai) */
  .inv-terms { margin-top: 5px !important; padding-top: 4px !important; }
  /* TERMS — client: "bohat choti aari hain, due amount jitni readable ho".
     Ab base 11px (bold) — thermal par saaf parhi jati hai. */
  .inv-head { font-size: 9.6px !important; line-height: 1.2 !important; margin-bottom: 4px !important; }
  .inv-no-box { margin: 2px 0 4px !important; }
  .inv-footer { font-size: 12px !important; margin-top: 7px !important; }
  .inv-timings { margin-top: 6px !important; padding-top: 4px !important; font-size: 9.5px !important; line-height: 1.25 !important; }
  .inv-footer { font-size: 12px !important; margin-top: 7px !important; }
  .inv-timings { margin-top: 6px !important; padding-top: 4px !important; font-size: 9.5px !important; line-height: 1.25 !important; }
  .inv-terms-head { font-size: 11px !important; margin-bottom: 4px !important; letter-spacing: .4px !important; }
  .inv-terms-body { font-size: 10.5px !important; line-height: 1.32 !important; font-weight: 700 !important; }
  .inv-terms-body > div { margin-bottom: 1px !important; }
  /* === ITEMS: ITEM | QTY | AMOUNT (client ki nayi layout) === */
  .invoice-page table.items-tbl { table-layout: fixed !important; width: 100% !important; }
  .invoice-page table.items-tbl td.it-name { word-break: break-word !important; line-height: 1.18 !important; }
  .invoice-page table.items-tbl span.it-rate { display: block !important; font-size: 8px !important; font-weight: 400 !important; line-height: 1.1 !important; }
  .invoice-page table.items-tbl td.it-qty { text-align: center !important; white-space: nowrap !important; }
  .invoice-page table.items-tbl td.it-amt { text-align: right !important; white-space: nowrap !important; }

  /* === BOOKING / DELIVERY rows: do saaf columns, qareeb qareeb nahi === */
  .invoice-page table.kv { table-layout: fixed !important; width: 100% !important; line-height: 1.45 !important; }
  /* label ek hi line me (Chrome me pehle se aisa tha — ab zabardasti bhi) */
  #printArea .invoice-page table.kv td.kv-l,
  .invoice-page table.kv td.kv-l { white-space: nowrap !important; word-break: keep-all !important; }
  .invoice-page table.kv td.kv-v { text-align: right !important; }

  /* === DISCOUNT row dark + saaf === */
  .invoice-page tr.disc-row td { border-top: 1px dashed #000 !important; }

  /* === CUT LINE (client: "credit ke baad foran cut aana chahiye") ===
     Sirf PRINT par — customer PDF / WhatsApp copy me nahi.
     Har copy (customer + office) ke credit ke neeche dashed cut line, taake
     roll wahin se kaata jaye. Content ke saath hi naapta hai (extra page nahi). */
  .print-slip .dev-credit::after {
    content: "✂  - - -  CUT HERE  - - -  ✂";
    display: block !important;
    text-align: center;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .6px;
    color: #000;
    margin-top: 5px;
    padding-top: 3px;
    border-bottom: 2px dashed #000;
    padding-bottom: 2px;
    white-space: nowrap;
  }

  /* Developer credit: compact */
  .dev-credit { margin-top: 5px !important; padding-top: 4px !important; }
  .dev-credit img { max-height: 9mm !important; width: auto !important; }
  /* ⚠️ html ki width bhi ASLI paper ke barabar honi chahiye. Pehle html 80mm aur
     body 72mm thi — Chrome 8mm overflow ko shrink kar ke poora print chhota kar deta
     tha aur right side cut ho jati thi. */
  html { width: ${rawPaperMm ? rawPaperMm + 'mm' : (paper === '58' ? '58mm' : '80mm')} !important;
         max-width: ${rawPaperMm ? rawPaperMm + 'mm' : (paper === '58' ? '58mm' : '80mm')} !important; }
  body {
    width: ${rawPaperMm ? rawPaperMm + 'mm' : (paper === '58' ? '58mm' : '80mm')} !important;
    max-width: ${rawPaperMm ? rawPaperMm + 'mm' : (paper === '58' ? '58mm' : '80mm')} !important;
    padding: ${Math.max(1, marginMm)}mm !important;
    margin: 0 auto !important;
    background: #fff !important;
  }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .invoice-page { padding: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; transform: none !important; zoom: 1 !important; }
  .inv-logo-wrap, .inv-logo { page-break-inside: avoid !important; }
}
</style>
</head><body>
<div id="printArea">${html}</div>
</body></html>`;

  /* ---------- iframe-based printing (popup-free) ---------- */
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  /* ⚠️ PEHLE width:0 tha — is liye naap ke waqt har line toot jati thi, height 3-4 guna
     ban jati thi aur auto-fit invoice ko 42% tak chhota kar deta tha (client ka masla:
     "print bohat chhota aa raha hai"). Ab iframe ko ASLI paper ki chaurai dete hain. */
  const _frameMm = rawPaperMm || (paper === '58' ? 58 : 80);
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;'
    + 'width:' + _frameMm + 'mm;height:297mm;border:0;visibility:hidden;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);

  const cleanup = () => {
    try { frame.remove(); } catch (e) {}
  };
  /* === EK PAGE PAR POORI INVOICE (bina chhotapan) ===
     Client ka masla: (a) wohi invoice 30+ dafa print, (b) print bohat chhota.
     Hal: print HAMESHA 100% par (koi transform/scale nahi — isi se chhotapan aata tha).
     Har copy apni page par (print-page-break par natural pagination = 2 pages).
     Sirf agar invoice EK roll page se lambi ho (bohat items), to font halka sa
     chhota hota hai — 100% se 85% tak, us se neeche kabhi nahi. */
  const fitSlipsToPage = () => {
    try {
      const doc2 = frame.contentWindow.document;
      const st = (typeof DB !== 'undefined' && DB.settings) ? DB.settings() : {};
      const MM2PX = 96 / 25.4;
      /* 14mm safety: printer ka non-printable area + CUT line ke liye jagah,
         taake cut line hamesha page 1 par credit ke foran baad rahe. */
      const targetPx = (297 - 14) * MM2PX;
      const mode = (st.printSizeMode || 'normal');
      const slips = Array.from(doc2.querySelectorAll('.print-slip'));
      if (!slips.length) return;

      /* har element ka ASLI font size yaad rakho (ek dafa) */
      const remember = (root) => {
        if (root.dataset.fsBase) return;
        root.dataset.fsBase = String(parseFloat(getComputedStyle(root).fontSize) || 13);
        root.querySelectorAll('[style*="font-size"]').forEach(el => {
          if (el.dataset.fsOrig) return;
          const m = /font-size:\s*([\d.]+)px/.exec(el.getAttribute('style') || '');
          if (m) el.dataset.fsOrig = m[1];
        });
      };
      const applyK = (root, k) => {
        const base = +root.dataset.fsBase || 13;
        root.style.fontSize = (Math.round(base * k * 100) / 100) + 'px';
        root.querySelectorAll('[data-fs-orig]').forEach(el => {
          el.style.fontSize = Math.max(6, Math.round(+el.dataset.fsOrig * k * 100) / 100) + 'px';
        });
      };
      const tallestPx = () => {
        let t = 0;
        slips.forEach(s => {
          const inner = s.querySelector('.invoice-page') || s;
          t = Math.max(t, inner.scrollHeight || inner.getBoundingClientRect().height || 0);
        });
        return t;
      };

      slips.forEach(s => {
        const inner = s.querySelector('.invoice-page') || s;
        remember(inner);
      });

      if (mode === 'large') {                        /* Bara mode: 100%, chhota nahi */
        slips.forEach(s => { const i = s.querySelector('.invoice-page') || s; applyK(i, 1); s.dataset.fitScale = '1'; });
        window.__printFitPct = 100;
        return;
      }

      /* Darje-ba-darje: 100% normal → halka compact → tight → very tight,
         aur sirf aakhir me font chhota (100% → 70% se neeche kabhi nahi). */
      const setLevel = (lvl) => {
        slips.forEach(s => {
          s.classList.remove('cmp1', 'cmp2', 'cmp3', 'cmp4');
          if (lvl >= 1) s.classList.add('cmp1');
          if (lvl >= 2) s.classList.add('cmp2');
          if (lvl >= 3) s.classList.add('cmp3');
          if (lvl >= 4) s.classList.add('cmp4');
        });
      };
      const tryLevel = (level, scale) => {
        setLevel(level);
        slips.forEach(s => { const inner = s.querySelector('.invoice-page') || s; applyK(inner, scale); });
        return tallestPx() <= targetPx;
      };
      let k = 1, lvl = 0;
      if (tryLevel(0, 1)) { lvl = 0; k = 1; }
      else if (tryLevel(1, 1)) { lvl = 1; k = 1; }
      else if (tryLevel(2, 1)) { lvl = 2; k = 1; }
      else if (tryLevel(3, 1)) { lvl = 3; k = 1; }
      else if (tryLevel(4, 1)) { lvl = 4; k = 1; }
      else {
        /* aakhri hal: cmp4 + font step-down (floor 65% — is se neeche nahi) */
        lvl = 4; k = 1;
        for (let i = 0; i < 12; i++) {
          k = Math.round((k - 0.03) * 100) / 100;
          if (k < 0.65) k = 0.65;
          if (tryLevel(4, k) || k <= 0.65) break;
        }
      }
      slips.forEach(s => { s.dataset.fitScale = String(k); });
      window.__printFitPct = Math.round(k * 100);
    } catch (e) { console.warn('[print] fit skip', e); }
  };

  const triggerPrint = () => {
    try {
      fitSlipsToPage();
      const fw = frame.contentWindow;
      fw.focus();
      fw.print();
      /* ⚠️ Scale print ke DOURAN lagaa rehna chahiye — fit isi se hota hai.
         (Pehle 1.2s baad reset ho jata tha, is liye print chhota/adhoora aata tha.) */
    } catch (e) {
      console.warn('[print] iframe print failed, trying popup fallback', e);
      const win = window.open('', '_blank', 'width=420,height=700');
      if (win) { win.document.write(printDoc); win.document.close(); }
    }
    /* iframe ko thodi der baad hatayein (print dialog band hone ke baad) */
    setTimeout(cleanup, 60000);
  };

  const writeDoc = () => {
    try {
      const doc = frame.contentWindow.document;
      doc.open(); doc.write(printDoc); doc.close();
    } catch (e) { console.warn('[print] could not write print document', e); }
  };

  writeDoc();

  /* images load hone ka intezaar, phir print (max 2.5s) */
  let printed = false;
  const once = () => { if (printed) return; printed = true; triggerPrint(); };
  try {
    const fdoc = frame.contentWindow.document;
    const imgs = Array.from(fdoc.querySelectorAll('img'));
    let pending = imgs.filter(im => !(im.complete && im.naturalHeight !== 0)).length;
    if (!pending) { setTimeout(once, 120); }
    else {
      imgs.forEach(im => {
        im.addEventListener('load', () => { if (--pending <= 0) once(); });
        im.addEventListener('error', () => { if (--pending <= 0) once(); });
      });
      setTimeout(once, 2500);
    }
  } catch (e) { setTimeout(once, 300); }

  return true;
}


/* ============================================================
   Product image helper — handles both emoji + image URLs/data
   ============================================================ */
function productImageHTML(image, size, classes) {
  size = size || 80;
  classes = classes || '';
  const fallback = '🧺';
  const img = image || fallback;
  // If it's a URL or data URI, render as <img> that fills its container
  if (typeof img === 'string' && (img.startsWith('data:') || img.startsWith('http') || img.startsWith('/') || img.startsWith('assets/'))) {
    return `<img src="${img}" class="${classes}" onerror="this.outerHTML='<span>${fallback}</span>'" alt=""/>`;
  }
  // Otherwise treat as emoji/text — let CSS handle size
  return `<span>${img}</span>`;
}
window.productImageHTML = productImageHTML;

/* ============================================================
   Image resize: file -> data URL of <= maxW x maxH, JPEG
   ============================================================ */
function resizeImageToDataURL(file, maxW, maxH, quality) {
  maxW = maxW || 200; maxH = maxH || 200; quality = quality || 0.85;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        // white bg for transparent PNGs
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}
window.resizeImageToDataURL = resizeImageToDataURL;

/* ============================================================
   Emoji picker (simple, organized for laundry shop)
   ============================================================ */
const LAUNDRY_EMOJIS = {
  'Clothing': ['👔','👕','👖','🧥','🧦','🧢','👒','👗','👘','🥻','🩱','🩳','🩲','🥼','🎽','🧣','🧤','🥾','👠','👟','🦺','👞','🩴','👚','👜'],
  'Bedding': ['🛏️','🛌','🧶','🧵','🪡','🪢','🧺','🧽','🧼'],
  'Pakistani': ['🤵','🥻','👳','🧕','🕌','🕋'],
  'Kids': ['🧸','🧒','👶','🎒','👶'],
  'Other': ['🪟','🚿','🧖','🪞','🛋️','🪑','🛁'],
};
function openEmojiPicker(onPick) {
  const groups = Object.keys(LAUNDRY_EMOJIS).map(g => `
    <div style="margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;margin-bottom:6px;">${g}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${LAUNDRY_EMOJIS[g].map(e => `<button type="button" class="emoji-btn" data-em="${e}" style="font-size:24px;padding:8px;background:#fff;border:1px solid #e5e9f2;border-radius:8px;cursor:pointer;">${e}</button>`).join('')}
      </div>
    </div>
  `).join('');
  openModal(`
    <h3>😀 Pick an Emoji</h3>
    ${groups}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
  `, { onOpen(m) {
    m.querySelectorAll('.emoji-btn').forEach(b => b.onclick = () => {
      onPick(b.dataset.em);
      closeModal();
    });
  }});
}
window.openEmojiPicker = openEmojiPicker;

/* ============================================================
   EASY NUMBER INPUT — click par poora value select, seedha type
   Cashier ko pehle 0 delete karne ki zaroorat nahi parti.
   window.easyNumber(input, { min, max, onChange })
   min/max function bhi ho sakte hain (live settings ke liye).
   ============================================================ */
function easyNumber(el, opts = {}) {
  if (!el) return;
  const { digits = 0, onChange = () => {} } = opts;
  const lim = () => {
    const mn = typeof opts.min === 'function' ? opts.min() : (opts.min == null ? 0 : opts.min);
    const mx = typeof opts.max === 'function' ? opts.max() : (opts.max == null ? Infinity : opts.max);
    return { mn: Math.max(0, mn), mx: Math.max(mn, mx) };
  };
  const clamp = (v) => {
    const { mn, mx } = lim();
    let n = parseFloat(String(v).replace(/[^\d.]/g, ''));
    if (!isFinite(n)) n = 0;
    return Math.min(mx, Math.max(mn, digits ? +n.toFixed(digits) : n));
  };
  let justFocused = false;
  el.addEventListener('focus', () => {
    try { el.select(); } catch (e) {}
    justFocused = true;
    setTimeout(() => { justFocused = false; }, 400);
  });
  el.addEventListener('mouseup', (e) => {
    if (justFocused) { e.preventDefault(); try { el.select(); } catch (err) {} }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      el.value = clamp((parseFloat(el.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1));
      onChange(clamp(el.value));
    } else if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  });
  el.addEventListener('input', () => {
    const v = clamp(el.value);
    if (parseFloat(el.value) > lim().mx) el.value = v;
    onChange(v);
  });
  el.addEventListener('blur', () => {
    if (el.value !== '') el.value = clamp(el.value);
    onChange(clamp(el.value));
  });
}
window.easyNumber = easyNumber;

/* ============================================================
   Auto Status Logic (Pending -> Washing at 5 PM)
   ============================================================ */
function getCalculatedStatus(order) {
  if (order.status !== 'pending') return order.status;
  if (!order.createdAt) return order.status;

  const d = new Date(order.createdAt);
  // Create Date object for 5 PM on the day the order was booked
  let washDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 0, 0);

  // If booked after 5 PM, wash day is tomorrow at 5 PM
  if (d.getHours() >= 17) {
    washDay.setDate(washDay.getDate() + 1);
  }

  // If wash day is Sunday (0), push to Monday at 5 PM
  if (washDay.getDay() === 0) {
    washDay.setDate(washDay.getDate() + 1);
  }

  // If current time is past wash day, it should be 'washing'
  if (new Date() >= washDay) {
    return 'washing';
  }

  return 'pending';
}

function autoUpdateWashingStatus() {
  if (typeof DB === 'undefined' || !DB.all || typeof DB.update !== 'function') return;
  const orders = DB.all('orders');
  if (!orders) return;
  
  let changed = false;
  orders.forEach(o => {
    if (o.status === 'pending') {
      const calc = getCalculatedStatus(o);
      if (calc === 'washing') {
        DB.update('orders', o.id, { status: 'washing' });
        changed = true;
      }
    }
  });
  
  // If we changed something and are currently on a page that shows orders, we could reload,
  // but it's okay to just let it quietly sync in the background.
}
// Run periodically (every 5 minutes)
if (typeof window !== 'undefined') {
  setTimeout(autoUpdateWashingStatus, 1500);
  setInterval(autoUpdateWashingStatus, 5 * 60 * 1000);
}

/* Ask for the IT-Admin password and hand back TRUE/FALSE.
   The password itself is never compared here — it is checked against a
   PBKDF2 verifier (MDC_CODE_VAULT), so the value is not readable in storage. */
function promptPasswordModal(title, onVerified) {
  openModal(`
    <h3>${escapeHtml(title)}</h3>
    <div class="field">
      <label>IT ADMIN Password</label>
      <input type="password" id="itAdminPwd" placeholder="Enter password..." autocomplete="off"/>
      <small style="color:var(--text-soft);">Protected — stored as a one-way hash, never as text.</small>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="itAdminSubmit">Unlock</button>
    </div>
  `, {
    onOpen(m) {
      const inp = m.querySelector('#itAdminPwd');
      const btn = m.querySelector('#itAdminSubmit');
      inp.focus();
      const submit = async () => {
        const val = inp.value;
        if (!val) return;
        btn.disabled = true; btn.textContent = 'Checking…';
        const ok = (typeof verifyITAdminPassword === 'function')
          ? await verifyITAdminPassword(val)
          : false;
        btn.disabled = false; btn.textContent = 'Unlock';
        if (!ok) { toast('Incorrect IT ADMIN Password!', 'error'); inp.select(); return; }
        closeModal();
        if (typeof onVerified === 'function') onVerified(true);
      };
      inp.addEventListener('keyup', (e) => { if (e.key === 'Enter') submit(); });
      btn.onclick = submit;
    }
  });
}

/* IT-Admin unlock: hashed verifier first, build-time seed as a one-time bootstrap. */
async function verifyITAdminPassword(pwd) {
  if (!pwd) return false;
  try {
    if (window.MDC_CODE_VAULT) {
      if (await MDC_CODE_VAULT.has('itadmin') && await MDC_CODE_VAULT.check('itadmin', pwd)) return true;
      // first run on this profile (or a fresh build) → bootstrap from the seed
      const seed = (window._IT_BRAND && typeof window._IT_BRAND.seedPassword === 'function')
        ? window._IT_BRAND.seedPassword() : '';
      if (seed && pwd === seed) {
        await MDC_CODE_VAULT.set('itadmin', pwd);
        return true;
      }
      return false;
    }
    const legacy = (window._IT_BRAND && typeof window._IT_BRAND.seedPassword === 'function')
      ? window._IT_BRAND.seedPassword() : '';
    return !!legacy && pwd === legacy;
  } catch (e) { return false; }
}

function isAppExpired() {
  if (typeof DB === 'undefined' || !DB.settings) return false;
  const s = DB.settings();
  // Lifetime is an explicit flag — anything other than literal `true` is NOT lifetime
  if (s.lifetimeLicense === true) return false;
  const expiry = Number(s.subscriptionExpiry) || 0;
  // No expiry at all is NOT "unlimited" — an unlicensed install is expired
  if (!expiry) return true;
  return Date.now() >= expiry;
}
