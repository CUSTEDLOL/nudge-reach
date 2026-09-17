# WWW Domain Redirect Design

**Date:** 2026-09-17
**Status:** Approved

## Problem

Google Search Console still lists some pages under `www.nudgeagent.app` while the sitemap and canonical metadata use `https://nudgeagent.app`. Both hostnames currently return complete pages, so Google must reconcile duplicate URLs instead of receiving one unambiguous site address.

## Decision

Add a permanent hostname redirect in the version-controlled Next.js redirect configuration. Every request whose host is `www.nudgeagent.app` will return a permanent redirect to the same path on `https://nudgeagent.app`.

Examples:

- `https://www.nudgeagent.app/` → `https://nudgeagent.app/`
- `https://www.nudgeagent.app/faq` → `https://nudgeagent.app/faq`
- `https://www.nudgeagent.app/privacy` → `https://nudgeagent.app/privacy`

The apex hostname is unchanged. Existing path redirects, including `/waitlist`, remain intact.

## Alternatives Considered

1. Configure the redirect only in Vercel. This is effective but keeps an important SEO rule outside the repository.
2. Keep only canonical tags. The current tags are correct, but a permanent redirect consolidates crawl and ranking signals more directly.

## Verification

- Add an automated test for the host-scoped redirect and the existing `/waitlist` redirect.
- Run the relevant test suite, lint, and production build.
- Deploy to production.
- Verify that `www` URLs return a permanent redirect, preserve their path, and resolve to a successful apex URL.
- Leave the sitemap on the apex hostname and allow Search Console to refresh after Google recrawls the old URLs.
