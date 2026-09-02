# Landing-page verification design

The root Next.js layout will own the document-level tags required by Google Tag Manager and Facebook domain verification. The GTM loader will be the first element in an explicit `<head>`, while the GTM fallback iframe will remain the first element in `<body>`. Facebook verification will be a standard meta element in `<head>`.

This keeps the snippets in the only App Router component that directly controls the opening document tags, preserves the existing GTM identifier, and avoids client-side injection. A static regression test will assert the identifiers and their relative placement, then the production build and deployed HTML will be checked.
