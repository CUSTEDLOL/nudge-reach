/**
 * The embeddable widget script (E5): a self-contained, dependency-free IIFE.
 * Usage on any site:
 *   <script src="https://nudgeagent.app/widget.js" data-nudge-key="wk_…" async></script>
 * It fetches the public config for its key and renders a floating WhatsApp
 * button that opens wa.me with the configured pre-filled message.
 */

const SCRIPT = `(function () {
  var s = document.currentScript;
  var key = s && s.getAttribute("data-nudge-key");
  if (!key) return;
  var base = (s.src.match(/^https?:\\/\\/[^/]+/) || [""])[0];
  fetch(base + "/api/widget/" + encodeURIComponent(key) + "/config")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.phone) return;
      var a = document.createElement("a");
      a.href = "https://wa.me/" + cfg.phone + "?text=" + encodeURIComponent(cfg.prefill || "");
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Chat with us on WhatsApp");
      a.style.cssText =
        "position:fixed;bottom:20px;" + (cfg.position === "left" ? "left" : "right") + ":20px;" +
        "z-index:2147483000;width:56px;height:56px;border-radius:50%;display:flex;" +
        "align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);" +
        "background:" + (cfg.color || "#25D366") + ";cursor:pointer;";
      a.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">' +
        '<path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.1.6 4.1 1.6 5.9L4 29l8.4-1.6c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.3l-.4-.2-5 1 1-4.8-.3-.4c-1-1.6-1.5-3.4-1.5-5.2 0-5.5 4.6-10 10.2-10s10.2 4.5 10.2 10-4.6 9.9-10.2 9.9zm5.6-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"/></svg>';
      a.addEventListener("click", function () {
        try {
          navigator.sendBeacon(base + "/api/widget/" + encodeURIComponent(key) + "/event");
        } catch (e) {}
      });
      document.body.appendChild(a);
    })
    .catch(function () {});
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
