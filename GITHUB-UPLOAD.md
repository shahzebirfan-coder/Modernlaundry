# GitHub par upload — step by step

## 1. Repo
GitHub par naya **public** repo banayein (ya mojooda repo) — misal: `modern-dry-cleaners-pos`.

## 2. Files upload
- **Drag & drop (sabse asaan):** is zip ko apne PC par extract karein → GitHub repo mein
  **Add file → Upload files** → poora folder content drag karein → **Commit changes**.
- **Ya GitHub Desktop / git se:**
  ```
  git init
  git add .
  git commit -m "Modern Dry Cleaners POS v20261124.2"
  git branch -M main
  git remote add origin https://github.com/<USER>/<REPO>.git
  git push -u origin main
  ```

## 3. GitHub Pages (live website)
Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save.
2–3 minute baad link mil jayega:
```
https://<USER>.github.io/<REPO>/
```
(Wohi link client ke computer/mobile par kholein — baqi sab app ke andar hai.)

## 4. Upload ke baad ZAROORI (3 baatein)
1. **Passwords / credentials GitHub par na jayein** — `.gitignore` me pehle se rok laga hua hai
   (`HANDOVER-CREDENTIALS.md`, `FIREBASE-CONFIG.txt`, `IT-OWNER-LOGIN.txt`).
   Agar ghalti se chali jayein to file delete karne se kaafi nahi — wo history me rehti hai;
   GitHub Settings se repo **private** kar dein ya commit history rewrite karein.
2. **Service worker update** — website pehli dafa khulne par purana cache ho sakta hai:
   client ko **Ctrl+Shift+R** (mobile: browser data clear) batayein.
   Version is waqt: `?v=20261124.2`, sw `modern-dry-cleaners-pos-v57`.
3. **Cloud Sync** — app khud Firebase (maundrylaundrypos) se judta hai. Agar client ka
   data purana gum ho gaya ho to jis PC par asli data hai wahan ek dafa:
   `Settings → Cloud Sync → ⬆️ Force Push This Device → Cloud`.

## 5. Kya kya upload hota hai
- `index.html`, `portal.html`, `live.html`, `reviews.html` (app + customer portal)
- `assets/` (js, css, img — brand logo, CelineSoft credit, sab bundled)
- `sw.js`, `manifest.json`, `cloud-check.html`
- Docs: `BRAND-README.md` (poora change log), `*.txt` update notes
- **Nahi jata:** `.git/`, credentials files, `node_modules`, OS junk

## 6. Update kaise karein (aage)
Naya zip extract → GitHub mein **Add file → Upload files** → same naam ki files replace → Commit.
`?v=` number badalne se client ka browser khud naya code le leta hai (service worker v-number bhi).
