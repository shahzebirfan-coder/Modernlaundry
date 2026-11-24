/* ============================================================
   IT ADMIN: CLIENT CONFIGURATION FILE
   Is file ko aap naye client (B, C, D) ko software dene se
   pehle edit kar sakte hain. Software automatically pehli dafa
   yahan se details pick karega.
   ============================================================ */

const CLIENT_CONFIG = {
  // 1. Initial Shop / Brand Settings
  shopName: "Modern Dry Cleaners",         // Client ka shop naam
  tagline: "Quality Dry Cleaner Service",  // Tagline

  // 2. Initial Admin Login (first-run seed only)
  //    ⚠️ Passwords are NOT stored here any more — they live in the hashed
  //    vault (assets/js/vault.js) and are wiped from this file at hand-over.
  //    The first-run credentials are printed in the hand-over document.
  adminUsername: "admin",
  adminName: "Administrator",              // Display Name

  // 3. Trial & Subscription
  trialDays: 15,                          // Default trial days for new client

  // 4. Login screen details (client in Settings se bhi badal sakta hai)
  address:  "Z-45, Memon Co-operative Housing Society, Karachi",
  phone:    "021-34388398",
  whatsapp: "03428096622",
  facebook: "",

  // 5. Shop timings — shown on the customer portal (portal.html)
  //    Portal ke "Open Now / Closed" badge ke liye format:
  //      DaySpec: HH:MM AM - HH:MM PM
  //    Friday ka break (1:30 PM - 2:00 PM) daily schedule se nahi
  //    nikalkar portal timings card me alag likha gaya hai.
  shopHours: [
    "Monday: 10:00 AM - 9:00 PM",
    "Tuesday: 10:00 AM - 9:00 PM",
    "Wednesday: 10:00 AM - 9:00 PM",
    "Thursday: 10:00 AM - 9:00 PM",
    "Friday: 10:00 AM - 12:30 PM, 2:00 PM - 9:00 PM",
    "Saturday: 10:00 AM - 9:00 PM",
    "Sunday: Closed"
  ].join("\n"),

  // 6. Winter / Summer timings (invoices, portal & printed slips par)
  /* Invoice / portal par chhapne wali timings (client ne 24 Nov 2026 ko confirm ki) */
  shopTimingText:
    "SHOP TIMINGS\n" +
    "Mon - Thu: 10:00 AM - 9:00 PM\n" +
    "Friday: 10:00 AM - 12:30 PM  |  2:00 PM - 9:00 PM (after Namaz)\n" +
    "Saturday: 10:00 AM - 9:00 PM\n" +
    "Sunday: Closed",

  /* ===== 7. TERMS & CONDITIONS (client ki printed slip se) =====
     Invoice / portal / PDF par chhapte hain. Settings → Customize Invoice se
     owner inhein badal bhi sakta hai (us ke baad yahan se overwrite nahi hote). */
  invoiceTerms: [
    "TERMS & CONDITIONS",
    "1. The right to refuse or accept clothes is reserved.",
    "2. Old, discoloured, stained and damaged clothes are accepted entirely at customer's risk.",
    "3. Our opinion of the condition of the clothes as mentioned on this receipt is final and binding on the customer.",
    "4. Every effort is made to deliver clothes on the due date but no responsibility is, however, taken for any delay.",
    "5. In case of damage to or loss of any clothes by MODERN, their liability is not to exceed the half cost.",
    "6. Clothes booked under this receipt shall be delivered to anyone who presents this receipt and no responsibility is accepted for wrong delivery arising thereby.",
    "7. If the receipt is lost and prompt intimation quoting the receipt number is sent in writing, the clothes, if not already delivered, may be kept aside for delivery to the person who had signed the receipt.",
    "8. Clothes not received within 10 (ten) days of the due date are packed in paper envelopes and kept aside entirely at the customer's risk and no responsibility is accepted if they are damaged in any way.",
    "9. In case of curtain colour which require matching, it may not fast and management shall not be responsible for same."
  ].join("\n"),

  // 7. Brand colours (logo se match)
  brandColor:      "#0b3f80",   // Modern — navy
  brandColorAccent: "#0e9ad2"   // Dry Cleaners — teal
};
