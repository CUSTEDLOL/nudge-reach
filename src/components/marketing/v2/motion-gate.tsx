/**
 * The v2 motion gate. Adds `jsm` to <html> ONLY when JS is running AND the
 * visitor does not prefer reduced motion. All scroll-driven layout/hiding in
 * globals.css lives under `.jsm`, so no-JS visitors, crawlers and
 * reduced-motion users get the complete, fully-visible static page — the
 * SSR opacity-0 bug class is impossible by construction.
 *
 * Inline + synchronous so the class lands before the sections paint.
 */
export function MotionGate() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('jsm')}}catch(e){}",
      }}
    />
  );
}
