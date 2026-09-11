// @custom start
/** Render the browser's receipt of an OAuth callback. */

export const oauthCallbackPage = (message: string): string => {
  const escaped = message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dedalus CLI</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 24px; min-height: 80vh; display: grid; place-items: center; }
    main { width: 100%; max-width: 440px; }
    h1 { font-size: 24px; font-weight: 600; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>Dedalus CLI</h1>
    <p>${escaped}</p>
    <p>Return to your terminal to check the login result. You can close this window.</p>
  </main>
</body>
</html>`
}
// @custom end
