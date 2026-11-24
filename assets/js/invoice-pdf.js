/* ============================================================
   INVOICE PDF  —  offline, one click
   ------------------------------------------------------------
   Client: WhatsApp par poora text bhejne ki jagah invoice PDF jaye.
   jsPDF (assets/js/jspdf.umd.min.js) local hai — internet ki zaroorat
   nahi, PWA offline me bhi chalta hai.

   Flow:  buildInvoicePdf(order) → { blob, fileName }
          shareInvoicePdf(order) → Web Share API (phone) ya download (PC)
   WhatsApp Web par file khud attach karni parti hai (browser file ko
   wa.me me nahi bhej sakta) — is liye:
     • Phone: "Share PDF" → WhatsApp chunein → chat chunein → send
     • PC:    PDF download → WhatsApp attachment se bhejein
   ============================================================ */
(function () {
  'use strict';

  function money(v) {
    const n = Math.round(+(v) || 0);
    return (typeof window.fmtMoney === 'function') ? window.fmtMoney(n) : ('Rs. ' + n);
  }
  function dmy(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* CelineSoft credit logo ek dafa load karke cache (PDF me draw karne ke liye) */
  let _devLogo = null;
  function prefetchDevLogo() {
    if (_devLogo) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          const cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0);
          _devLogo = { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
        } catch (e) { /* canvas tainted — text hi rahega */ }
      };
      img.src = 'assets/img/celinesoft-thermal.png';
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    try {
      const bundled = window.MDC_ASSETS && window.MDC_ASSETS.devLogo;
      if (bundled) _devLogo = { data: bundled, w: 300, h: 87 };
      else setTimeout(prefetchDevLogo, 300);
    } catch (e) { setTimeout(prefetchDevLogo, 300); }
  }

  function getDoc() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) return null;
    return new J({ unit: 'mm', format: [80, 297], orientation: 'portrait' });
  }

  /* Receipt-style PDF: 80mm roll jaisa, 2 copies (customer + office) */
  function buildInvoicePdf(order, opts) {
    opts = opts || {};
    /* opts.cutLine: true = do copies ke darmiyan "CUT HERE" (printer slip ke liye).
       Customer ko bhejne wali PDF me customer copy par CUT line NAHI aati (client ki requirement). */
    const wantCut = opts.cutLine === true;
    const doc = getDoc();
    if (!doc) throw new Error('PDF engine load nahi hua (jspdf.umd.min.js missing)');

    const DB = window.DB;
    const s = (DB && DB.settings) ? DB.settings() : {};
    const c = (DB && DB.get) ? (DB.get('customers', order.customerId) || {}) : {};
    const inv = (DB && DB.invoiceLabel) ? DB.invoiceLabel(order) : (order.invoiceNo || order.id);
    const items = order.items || [];
    const pcs = items.reduce((a, i) => a + (+i.qty || 0), 0);

    const W = 80, M = 4;
    let y = 8;
    const line = (gap) => { y += (gap || 0); };
    const center = (txt, size, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(String(txt), W / 2, y, { align: 'center' });
    };
    const row = (l, r, size, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size || 8);
      doc.text(String(l), M, y);
      doc.text(String(r), W - M, y, { align: 'right' });
    };
    /* BRAND logo — PDF par bhi MUST (customer ki requirement).
       Pehle bundled logo (assets/js/brand-assets.js), warna custom uploaded logo. */
    const logoData = (() => {
      try {
        const bundled = window.MDC_ASSETS && window.MDC_ASSETS.brandLogo;
        if (bundled) return bundled;
        const raw = s.logoImage || '';
        if (raw && /^data:image\//.test(raw) && raw.length > 500) return raw;
      } catch (e) {}
      return null;
    })();
    const logoFmt = (d) => (/^data:image\/png/i.test(d) ? 'PNG' : 'JPEG');
    const drawLogo = (labelY) => {
      if (!logoData) return labelY;
      try {
        const w = 30, h = 12;
        doc.addImage(logoData, logoFmt(logoData), (W - w) / 2, labelY - h - 2, w, h);
        return 0;
      } catch (e) { console.warn('[pdf] logo skip', e); return 0; }
    };

    const dashes = () => {
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(M, y, W - M, y);
      doc.setLineDashPattern([], 0);
    };

    const copy = (label, opt) => {
      opt = opt || {};
      if (logoData) {
        try {
          const lw = opt.compact ? 22 : 30;
          const lh = Math.round(lw * 0.514 * 10) / 10;
          doc.addImage(logoData, logoFmt(logoData), (W - lw) / 2, y - 4, lw, lh);
          y += lh + (opt.compact ? 1.5 : 2.5);
        } catch (e) { console.warn('[pdf] logo skip', e); }
      }
      center(s.shopName || 'Modern Dry Cleaners', opt.compact ? 9.5 : 11, true); line(4);
      if (s.address) { center(String(s.address).slice(0, 60), 6.5); line(3); }
      if (s.phone) { center(s.phone, 7, true); line(3.5); }
      dashes(); line(4);
      center(label, 8.5, true); line(4.5);
      dashes(); line(4.5);

      /* ===== INVOICE NO. — BARA, BOLD, CENTER (client ki photo jaisa) ===== */
      const boxH = 17;
      doc.setDrawColor(0); doc.setLineWidth(0.6);
      doc.roundedRect(M, y - 2, W - 2 * M, boxH, 1.6, 1.6, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(opt.compact ? 5.6 : 6.4);
      doc.text('INVOICE NO.', W / 2, y + 3.2, { align: 'center' });
      doc.setFontSize(opt.compact ? 12.5 : 15);
      doc.text('#' + inv, W / 2, y + 12.6, { align: 'center' });
      y += boxH + 3;

      /* ===== PIECES + PACKAGING — dono bare aur saaf ===== */
      const packLabel = ({ hanger: 'HANGER', fold: 'FOLD', both: 'MIXED' })[String(order.deliveryType || 'hanger').toLowerCase()] || 'HANGER';
      const bxW = (W - 2 * M - 3) / 2;
      doc.setLineWidth(0.4);
      doc.roundedRect(M, y - 2, bxW, 13, 1.2, 1.2, 'S');
      doc.roundedRect(M + bxW + 3, y - 2, bxW, 13, 1.2, 1.2, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4);
      doc.text('PIECES', M + bxW / 2, y + 2, { align: 'center' });
      doc.text('PACKAGING', M + bxW + 3 + bxW / 2, y + 2, { align: 'center' });
      doc.setFontSize(13);
      doc.text(String(pcs), M + bxW / 2, y + 9, { align: 'center' });
      doc.setFontSize(9.2);
      doc.text(packLabel, M + bxW + 3 + bxW / 2, y + 8.6, { align: 'center' });
      y += 16;

      row('Booking', dmy(order.createdAt), 8); line(4);
      row('Delivery', order.deliveryDate ? dmy(order.deliveryDate) : '-', 8); line(4);
      row('Customer', (c.name || 'Walk-in').slice(0, 22), 8, true); line(4);
      if (c.phone) { row('Phone', c.phone, 8); line(4); }
      dashes(); line(4);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text('ITEMS', M, y);
      doc.text('TOTAL', W - M, y, { align: 'right' });
      line(1.5);
      doc.setLineWidth(0.3); doc.line(M, y, W - M, y); line(4);

      items.forEach(it => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(String(it.name || '').slice(0, 20), M, y);
        doc.text(money((it.qty || 0) * (it.price || 0)), W - M, y, { align: 'right' });
        line(3.4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
        doc.text(`${it.qty} x ${money(it.price)}`, M, y);
        line(4.2);
      });

      line(1); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); line(4.5);

      if (order.prevBalance > 0) {
        row('Is bill ka total', money(order.currentBill != null ? order.currentBill : (order.total - order.prevBalance)), 8);
        line(4);
        row('Purana baqi', '+' + money(order.prevBalance), 8, true);
        line(4);
      }
      if (+order.discount || 0) { row('Discount', '-' + money(order.discount), 8); line(4); }
      if (+order.deliveryCharge || 0) {
        row((order.deliveryChargeLabel || 'Delivery'), '+' + money(order.deliveryCharge), 8); line(4);
      }
      row('GRAND TOTAL', money(order.total), 9.5, true); line(4.5);
      row('Paid', money(order.paid), 8); line(4);
      const due = Math.max(0, +(order.due || 0));
      row('Due', money(due), 9, true); line(4.5);
      dashes(); line(4);

      if (s.shopTimingText && !opt.compact) {
        String(s.shopTimingText).split('\n').filter(Boolean).slice(0, 5).forEach(t => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
          const w = doc.splitTextToSize(t, W - (M * 2));
          w.forEach(ln => { doc.text(ln, W / 2, y, { align: 'center' }); y += 2.6; });
          line(0.4);
        });
        line(1.5);
      }
      center(s.invoiceFooter || 'Thank you for choosing us!', 7, true); line(3.5);

      /* ---- TERMS & CONDITIONS (client ki slip se) ---- */
      const terms = opt.compact ? [] : String(s.invoiceTerms || '').split('\n').map(t => t.trim()).filter(Boolean);
      if (terms.length) {
        doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0);
        doc.line(M, y - 1, W - M, y - 1); doc.setLineDashPattern([], 0);
        line(4);
        const head = terms.find(t => !/^\d+[.)]\s/.test(t)) || 'TERMS & CONDITIONS';
        center(head.toUpperCase().slice(0, 40), 6.8, true); line(3.2);
        terms.filter(t => /^\d+[.)]\s/.test(t)).forEach(t => {
          const txt = t.replace(/^\d+[.)]\s*/, '');
          const num = (t.match(/^\d+/) || ['1'])[0];
          doc.setFont('helvetica', 'normal'); doc.setFontSize(5.6);
          /* wrap to paper width (72mm usable) */
          const lines = doc.splitTextToSize(txt, W - (M * 2) - 4);
          doc.text(num + '.', M, y);
          lines.forEach((ln, i) => { doc.text(ln, M + 3.4, y + (i * 2.5)); });
          y += Math.max(1, lines.length) * 2.5 + 0.9;
        });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        line(1.5);
      }

      /* ---- Designed & Developed by CelineSoft (invoice ke aakhir me) ---- */
      if (opt.compact) {
        /* Office copy par bhi CelineSoft logo + naam + number (chhota) */
        if (_devLogo) {
          try {
            const lw = 13, lh = Math.round(lw * (_devLogo.h / _devLogo.w) * 10) / 10;
            doc.addImage(_devLogo.data, 'PNG', (W - lw) / 2, y - 2.4, lw, lh);
            y += lh + 1.2;
          } catch (e) { console.warn('[pdf] dev logo skip', e); }
        }
        center('Designed & Developed by: CelineSoft', 5.8, true); line(2.4);
        center('Contact: 0302-8244803', 5.8); line(2.2);
        return;
      }
      doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0);
      doc.line(M, y - 1, W - M, y - 1); doc.setLineDashPattern([], 0);
      line(3.2);
      if (_devLogo) {
        try {
          const lw = 17, lh = Math.round(lw * (_devLogo.h / _devLogo.w) * 10) / 10;
          doc.addImage(_devLogo.data, 'PNG', (W - lw) / 2, y - 2.6, lw, lh);
          y += lh + 0.6;
        } catch (e) { console.warn('[pdf] dev logo skip', e); }
      }
      center('Designed & Developed by: CelineSoft', 6.2, true); line(2.6);
      center('Contact: 0302-8244803', 6.2); line(2.2);
    };

    copy('CUSTOMER COPY', { compact: false });

    /* ✂ CUT line — sirf POORI invoice (terms + credit) ke BAAD.
       Customer ko bhejne wali PDF me ye nahi aata (sirf printer wali slip ke liye). */
    if (wantCut) {
      line(3);
      doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0);
      doc.line(M, y, W / 2 - 14, y);
      doc.line(W / 2 + 14, y, W - M, y);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text('CUT HERE', W / 2, y + 1.2, { align: 'center' });
      line(6);
    }
    /* OFFICE COPY — apni ALAG page par (client: "office copy b alag nikelygi") */
    doc.addPage([80, 297]); y = 8;
    copy('OFFICE COPY', { compact: true });

    return { doc, fileName: `Invoice-${String(inv).replace(/[^\w-]/g, '')}.pdf` };
  }

  /* Download / save */
  function downloadInvoicePdf(order) {
    try {
      const { doc, fileName } = buildInvoicePdf(order);
      doc.save(fileName);
      return fileName;
    } catch (e) {
      (window.toast || console.warn)(e.message || 'PDF ban nahi saka', 'error');
      return null;
    }
  }

  /* Share (phone: WhatsApp direct choose) — PC par download */
  async function shareInvoicePdf(order) {
    let built;
    try { built = buildInvoicePdf(order); }
    catch (e) { (window.toast || console.warn)(e.message || 'PDF ban nahi saka', 'error'); return; }

    const blob = built.doc.output('blob');
    const file = new File([blob], built.fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: built.fileName,
          text: 'Invoice ' + (order.invoiceNo || '') + ' — ' + (window.DB.settings().shopName || '')
        });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
      }
    }
    built.doc.save(built.fileName);
    return 'downloaded';
  }

  window.MDC_PDF = { buildInvoicePdf, downloadInvoicePdf, shareInvoicePdf };

  /* Small UI helper used by the invoice screen / WhatsApp picker */
  window.openInvoicePdfMenu = function (orderId) {
    const order = window.DB.get('orders', orderId);
    if (!order) return;
    const c = window.DB.get('customers', order.customerId) || {};
    const html = `
      <h3>📄 Invoice PDF</h3>
      <p class="sub">${window.DB.invoiceLabel(order)} • ${String(c.name || 'Walk-in')} • ${money(order.total)}</p>
      <div style="display:grid;gap:10px;">
        <button class="btn btn-success btn-block" id="pdfShare">📤 Share PDF (WhatsApp)</button>
        <button class="btn btn-primary btn-block" id="pdfCopy">🖨️ Print 2nd copy</button>
        <button class="btn btn-secondary btn-block" id="pdfDownload">⬇️ Download PDF</button>
      </div>
      <div style="background:#f1f5f9;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#475569;">
        <b>PC par:</b> Share dabayein → PDF download hoga → WhatsApp chat me 📎 se attach karein.<br>
        <b>Phone par:</b> Share dabayein → WhatsApp → chat chunein → send.
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
    `;
    window.openModal(html, { onOpen(m) {
      m.querySelector('#pdfShare').onclick = async () => {
        const btn = m.querySelector('#pdfShare');
        btn.disabled = true; btn.textContent = '⏳ PDF ban raha hai…';
        const res = await shareInvoicePdf(order);
        btn.disabled = false; btn.textContent = '📤 Share PDF (WhatsApp)';
        if (res === 'downloaded') window.toast('PDF download ho gaya — WhatsApp me attach karein', 'success');
        else if (res === 'shared') window.toast('PDF share ho gaya', 'success');
      };
      m.querySelector('#pdfDownload').onclick = () => {
        const f = downloadInvoicePdf(order);
        if (f) window.toast('PDF save: ' + f, 'success');
      };
      m.querySelector('#pdfCopy').onclick = () => {
        window.closeModal();
        if (window.MDC_PDF && order) {
          if (typeof window.printElement === 'function' && typeof window.openInvoice === 'function') {
            // printing ke liye app ka normal path use karein
            window.openInvoice(orderId, true);
          }
        }
      };
    }});
  };
})();
