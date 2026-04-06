import { useEffect } from 'react';

export function useCursor(cursorId = 'cursor') {
  useEffect(() => {
    const cur = document.getElementById(cursorId);
    if (!cur) return;

    const onMove = (e: MouseEvent) => {
      cur.style.left = `${e.clientX}px`;
      cur.style.top  = `${e.clientY}px`;
    };

    const attach = () => {
      document.querySelectorAll<HTMLElement>(
        'a, button, .hint-chip, .r-card, .rel-item, .sf-item, .p-btn, .f-btn, .src-pill, .feat-card'
      ).forEach((el) => {
        el.addEventListener('mouseenter', () => cur.classList.add('hov'));
        el.addEventListener('mouseleave', () => cur.classList.remove('hov'));
      });
    };

    document.addEventListener('mousemove', onMove);
    attach();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('mousemove', onMove);
      observer.disconnect();
    };
  }, [cursorId]);
}
