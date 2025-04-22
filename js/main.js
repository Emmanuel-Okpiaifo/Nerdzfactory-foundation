// Hero Slideshow
const heroSlides = document.querySelectorAll('.slide');
const heroDots = document.querySelectorAll('.slideshow-dots .dot');

if (heroSlides.length > 0 && heroDots.length > 0) {
    let currentSlide = 0;

    function showSlide(n) {
        heroSlides.forEach(slide => {
            slide.classList.remove('active');
            slide.classList.add('fade-out');
        });
        heroDots.forEach(dot => dot.classList.remove('active'));
        
        currentSlide = (n + heroSlides.length) % heroSlides.length;
        
        heroSlides[currentSlide].classList.add('active');
        heroSlides[currentSlide].classList.remove('fade-out');
        heroDots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    // Initialize hero slideshow
    showSlide(0);
    setInterval(nextSlide, 5000);
}

// About Slideshow
const aboutSlides = document.querySelectorAll('.about-slide');

if (aboutSlides.length > 0) {
    let currentAboutSlide = 0;

    function showAboutSlide(n) {
        aboutSlides.forEach(slide => slide.classList.remove('active'));
        currentAboutSlide = (n + aboutSlides.length) % aboutSlides.length;
        aboutSlides[currentAboutSlide].classList.add('active');
    }

    // Initialize about slideshow
    showAboutSlide(0);
    setInterval(() => showAboutSlide(currentAboutSlide + 1), 3000);
}

// Testimonials Slider
const testimonialCards = document.querySelectorAll('.testimonial-card');

if (testimonialCards.length > 0) {
    let isFirstSet = true;

    function showTestimonialSet() {
        if (window.innerWidth <= 992) {
            // On mobile, show one at a time
            testimonialCards.forEach((card, index) => {
                card.classList.toggle('visible', index === (isFirstSet ? 0 : 3));
            });
        } else {
            // On desktop, alternate between sets
            testimonialCards.forEach((card, index) => {
                if (isFirstSet) {
                    // Show first 3 cards
                    card.classList.toggle('visible', index < 3);
                } else {
                    // Show last 2 cards in the same positions
                    card.classList.toggle('visible', index >= 3);
                }
            });
        }
        
        isFirstSet = !isFirstSet;
    }

    // Initialize testimonials
    showTestimonialSet();

    // Switch between sets every 5 seconds
    setInterval(showTestimonialSet, 5000);

    // Handle window resize for testimonials
    window.addEventListener('resize', showTestimonialSet);
}

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('nav ul');

if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        const isOpen = navMenu.classList.contains('active');
        mobileMenuBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('active') && !e.target.closest('nav ul')) {
            navMenu.classList.remove('active');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });

    // Prevent menu from closing when clicking inside
    navMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Handle window resize for mobile menu
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
}

// Add animation class to elements when they come into view
document.addEventListener('DOMContentLoaded', function() {
    // Add animation order to list items
    const lists = document.querySelectorAll('.curriculum-list, .details-list, .changer-list, .eligibility-list, .benefits-list');
    lists.forEach(list => {
        const items = list.querySelectorAll('li');
        items.forEach((item, index) => {
            item.style.setProperty('--animation-order', index + 1);
        });
    });

    // Handle scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once animation is triggered
            }
        });
    }, observerOptions);

    // Elements to animate on scroll
    const elementsToAnimate = [
        // Content sections
        '.curriculum-content',
        '.details-content',
        '.changer-content',
        '.about-content',
        '.ytp-content',
        '.dsp-content',
        '.programs-content',
        
        // Cards
        '.focus-card',
        '.contact-card',
        '.program-card',
        '.involvement-card',
        '.info-card',
        
        // Images and media
        '.curriculum-image',
        '.details-image',
        '.changer-image',
        '.about-gallery',
        '.gallery-main',
        '.gallery-grid img',
        '.program-image',
        
        // Text sections
        '.curriculum-text',
        '.details-text',
        '.changer-text',
        '.about-text-content',
        
        // Hero sections
        '.hero-content',
        '.programs-hero .hero-content',
        '.ytp-hero .hero-content',
        '.digisafe-hero .hero-content',
        
        // Buttons and CTAs
        '.apply-now-btn',
        '.btn-primary',
        '.apply-btn',
        '.learn-more',
        '.register-btn',
        
        // Lists
        '.curriculum-list li',
        '.details-list li',
        '.changer-list li',
        '.eligibility-list li',
        '.benefits-list li'
    ].join(', ');

    // Add animate-on-scroll class and observe all elements
    document.querySelectorAll(elementsToAnimate).forEach(element => {
        element.classList.add('animate-on-scroll');
        observer.observe(element);
    });

    // Add staggered animation delays to cards
    const cardTypes = ['.focus-card', '.contact-card', '.program-card', '.involvement-card', '.info-card'];
    cardTypes.forEach(cardType => {
        document.querySelectorAll(cardType).forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    });

    // Add staggered animation delays to images
    document.querySelectorAll('.gallery-grid img').forEach((img, index) => {
        img.style.animationDelay = `${index * 0.1}s`;
    });
});

// WDEP Hero Slideshow
const wdepSlides = document.querySelectorAll('.wdep-slideshow .slide');
const wdepDots = document.querySelectorAll('.wdep-slideshow .dot');

if (wdepSlides.length > 0 && wdepDots.length > 0) {
    let currentWdepSlide = 0;

    function showWdepSlide(n) {
        wdepSlides.forEach(slide => {
            slide.classList.remove('active');
        });
        wdepDots.forEach(dot => dot.classList.remove('active'));
        
        currentWdepSlide = (n + wdepSlides.length) % wdepSlides.length;
        
        wdepSlides[currentWdepSlide].classList.add('active');
        wdepDots[currentWdepSlide].classList.add('active');
    }

    function nextWdepSlide() {
        showWdepSlide(currentWdepSlide + 1);
    }

    // Add click event listeners to dots
    wdepDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showWdepSlide(index);
        });
    });

    // Initialize WDEP slideshow
    showWdepSlide(0);
    setInterval(nextWdepSlide, 5000); // Change slide every 5 seconds
}