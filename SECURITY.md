# Security and content trust

This project is a static website. It has no server-side accounts, authentication or database.

- Treat files under `novels/` as untrusted input.
- Only use valid slug identifiers and single-file chapter names.
- Escape JSON strings interpolated into HTML and HTML attributes.
- Markdown HTML is disabled in the reader. Review any third-party CDN scripts before production use.
- Favorites and reading settings are local to the browser; clearing storage resets them.
- The demo's Login/Register controls are not a real authentication system.
- Report vulnerabilities privately to the repository maintainer; do not post working exploits in public issues.
