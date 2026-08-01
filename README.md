MISBAHUL HUDHA MADRASA KAMBALAKKALLU — Election web app

Overview
- Single-page static app (HTML/CSS/JS). Designed for voting performed on a shared device (phone) as requested.
- Admin panel to add roles and candidates (with photos). Candidate photos are stored locally in the device (encoded as data URLs in localStorage).
- Voting shows one role at a time; after a vote the interface advances to the next role automatically.
- Results are stored in localStorage and can be exported as Excel (.xlsx) using SheetJS.
- Teacher PIN can be set to protect the Start Voting button, and admin password can be used to protect Admin and Results.

How to use locally
1. Open the folder `madrasa-election` in a web browser (open index.html).
2. (Optional) If you want to show the madrasa logo, add a file named `assets/logo.png` in the `madrasa-election` folder.
3. Click "Admin Panel" to add roles. For each role, add candidates and optionally upload photos.
4. Click "Start Voting" to begin. Each voter uses the same device to vote for each role in sequence.

Deploy to GitHub Pages
1. Create a new GitHub repository (for example `madrasa-election`).
2. Commit this folder's contents (all files including an `assets/` folder if you added a logo).
3. Push to GitHub (main branch). In the repository settings -> Pages, select the branch `main` and folder `/ (root)` or `docs` depending on your preference, then save.
4. GitHub will build the Pages site and provide a public link (typically https://<your-username>.github.io/<repo-name>/).

Notes and limitations
- This implementation is anonymous and device-based: votes are kept in browser localStorage. This is acceptable because all voting is performed on a single phone. If you need tamper-resistance or remote voting, a server-backed solution is required.
- Images are stored inside localStorage as data URLs — this is convenient but can increase storage size. Keep candidate photos reasonably small.

Next steps (optional)
- Add a simple password to Admin Panel to avoid accidental changes.
- Add printing/QR instructions for voters.
- If you want a server-backed system later, I can provide a Node/Express backend and deployment steps.

Credits
- Built for MISBAHUL HUDHA MADRASA KAMBALAKKALLU
