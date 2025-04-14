// Hero Slideshow
let currentSlide = 0;
const heroSlides = document.querySelectorAll('.slide');
const heroDots = document.querySelectorAll('.slideshow-dots .dot');

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

// About Slideshow
let currentAboutSlide = 0;
const aboutSlides = document.querySelectorAll('.about-slide');

function showAboutSlide(n) {
    aboutSlides.forEach(slide => slide.classList.remove('active'));
    currentAboutSlide = (n + aboutSlides.length) % aboutSlides.length;
    aboutSlides[currentAboutSlide].classList.add('active');
}

// Initialize about slideshow
showAboutSlide(0);
setInterval(() => showAboutSlide(currentAboutSlide + 1), 3000);

// Testimonials Slider
const testimonialCards = document.querySelectorAll('.testimonial-card');
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

// Handle window resize
window.addEventListener('resize', showTestimonialSet);

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('nav ul');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        const isOpen = navMenu.classList.contains('active');
        mobileMenuBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
}

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

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 992 && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
});