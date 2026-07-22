import { useEffect } from 'react';

export function usePageEffects() {
  useEffect(() => {
    initHeroSlideshow();
    initAboutSlideshow();
    initTestimonials();
    initScrollAnimations();
    initGalleryFilter();
    initWdepSlideshow();
    initBybCards();
  }, []);
}

function initHeroSlideshow() {
  const slides = document.querySelectorAll('.hero .slide');
  const dots = document.querySelectorAll('.hero .slideshow-dots .dot');
  if (!slides.length || !dots.length) return;

  let current = 0;
  const show = (n) => {
    slides.forEach((s) => { s.classList.remove('active'); s.classList.add('fade-out'); });
    dots.forEach((d) => d.classList.remove('active'));
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    slides[current].classList.remove('fade-out');
    dots[current].classList.add('active');
  };

  show(0);
  const id = setInterval(() => show(current + 1), 5000);
  return () => clearInterval(id);
}

function initAboutSlideshow() {
  const slides = document.querySelectorAll('.about-slide');
  if (!slides.length) return;
  let current = 0;
  const show = (n) => {
    slides.forEach((s) => s.classList.remove('active'));
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
  };
  show(0);
  const id = setInterval(() => show(current + 1), 3000);
  return () => clearInterval(id);
}

function initTestimonials() {
  const cards = document.querySelectorAll('.testimonial-card');
  if (!cards.length) return;
  let first = true;
  const show = () => {
    if (window.innerWidth <= 992) {
      cards.forEach((c, i) => c.classList.toggle('visible', i === (first ? 0 : 3)));
    } else {
      cards.forEach((c, i) => {
        if (first) c.classList.toggle('visible', i < 3);
        else c.classList.toggle('visible', i >= 3);
      });
    }
    first = !first;
  };
  show();
  const id = setInterval(show, 5000);
  window.addEventListener('resize', show);
  return () => { clearInterval(id); window.removeEventListener('resize', show); };
}

function initScrollAnimations() {
  const selector = [
    '.focus-card', '.contact-card', '.program-card', '.involvement-card',
    '.about-text-content', '.gallery-grid img', '.hero-content',
  ].join(', ');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(selector).forEach((el) => {
    el.classList.add('animate-on-scroll');
    observer.observe(el);
  });
}

function initGalleryFilter() {
  const buttons = document.querySelectorAll('.gallery-filters .filter-btn, .blog-filters .filter-btn');
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function initWdepSlideshow() {
  const slides = document.querySelectorAll('.wdep-slideshow .slide');
  const dots = document.querySelectorAll('.wdep-slideshow .dot');
  if (!slides.length) return;
  let current = 0;
  const show = (n) => {
    slides.forEach((s) => s.classList.remove('active'));
    dots.forEach((d) => d.classList.remove('active'));
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  };
  dots.forEach((d, i) => d.addEventListener('click', () => show(i)));
  show(0);
  setInterval(() => show(current + 1), 5000);
}

function initBybCards() {
  const cards = document.querySelectorAll('.byb-program-card');
  if (!cards.length) return;
  const onScroll = () => {
    const trigger = window.innerHeight * 0.92;
    cards.forEach((c) => {
      if (c.getBoundingClientRect().top < trigger) c.classList.add('animate-in');
    });
  };
  window.addEventListener('scroll', onScroll);
  window.addEventListener('resize', onScroll);
  onScroll();
}
