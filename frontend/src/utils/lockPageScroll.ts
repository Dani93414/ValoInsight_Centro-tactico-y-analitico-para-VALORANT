let activeLocks = 0;
let restoreOverflow: (() => void) | undefined;

export function lockPageScroll(): () => void {
  if (activeLocks === 0) {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    restoreOverflow = () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }
  activeLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks -= 1;
    // Overlapping modals can unmount in either order.
    if (activeLocks === 0) {
      restoreOverflow?.();
      restoreOverflow = undefined;
    }
  };
}
