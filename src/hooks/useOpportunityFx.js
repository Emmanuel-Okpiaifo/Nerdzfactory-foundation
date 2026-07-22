import { useEffect, useRef } from 'react';

function markVisibleIfInView(node) {
  const rect = node.getBoundingClientRect();
  if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
    node.classList.add('is-visible');
    return true;
  }
  return false;
}

export function useReveal(threshold = 0.08) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const nodes = el.querySelectorAll('.reveal, .reveal-stagger');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px 5% 0px' }
    );

    nodes.forEach((node) => {
      if (!markVisibleIfInView(node)) {
        observer.observe(node);
      }
    });

    const onResize = () => {
      nodes.forEach((node) => {
        if (!node.classList.contains('is-visible')) {
          markVisibleIfInView(node);
        }
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return ref;
}

export function useTilt(intensity = 12) {
  const ref = useRef(null);

  useEffect(() => {
    const card = ref.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 1024px)').matches;

    if (!card || reducedMotion || coarsePointer || narrow) return;

    const onMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateY(-6px)`;
    };

    const onLeave = () => {
      card.style.transform = '';
    };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
    return () => {
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
      card.style.transform = '';
    };
  }, [intensity]);

  return ref;
}

export function useCountUp(target, duration = 1800) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !target) return;

    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.floor(eased * target);
      el.textContent = value >= target ? `${target}+` : String(value);
      if (progress < 1) requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return ref;
}
