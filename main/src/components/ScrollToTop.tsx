import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position on route change.
 *
 * React Router does not do this on its own, so without it every navigation
 * kept whatever scroll offset the *previous* page had — leaving you dropped
 * into the middle of Sponsors after scrolling down Events, with the page
 * header nowhere in sight. It looked like a broken link rather than a
 * missing behaviour, which is why it was easy to miss.
 *
 * Two deliberate exceptions:
 *
 *  - A hash target (`/#contact`) is left alone and scrolled to instead, so
 *    in-page anchors keep working.
 *  - A change to the query string only (`?event=...`) does NOT reset scroll.
 *    The Team Archive deep link from Events manages its own scroll, and
 *    stealing it here would fight that.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Let the browser paint before looking for the target; the section may
      // not exist yet on the frame the route changed.
      const raf = requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0 });
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}
