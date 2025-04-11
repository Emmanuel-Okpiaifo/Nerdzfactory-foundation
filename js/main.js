document.addEventListener('DOMContentLoaded', function() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    const slideInterval = 5000; // 5 seconds total (3s zoom + 2s fade)

    function nextSlide() {
        // Add fade-out class to current slide
        slides[currentSlide].classList.add('fade-out');
        dots[currentSlide].classList.remove('active');
        
        // Wait for fade-out animation to complete
        setTimeout(() => {
            // Remove active and fade-out classes from current slide
            slides[currentSlide].classList.remove('active', 'fade-out');
            slides[currentSlide].style.transform = 'scale(1)';
            
            // Move to next slide
            currentSlide = (currentSlide + 1) % slides.length;
            
            // Add active class to new slide and dot
            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        }, 1500); // Match the CSS transition duration
    }

    // Initialize first slide
    slides[0].classList.add('active');
    dots[0].classList.add('active');

    // Auto slideshow
    let slideTimer = setInterval(nextSlide, slideInterval);

    // Click handlers for dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            clearInterval(slideTimer);
            
            // Add fade-out class to current slide
            slides[currentSlide].classList.add('fade-out');
            dots[currentSlide].classList.remove('active');
            
            // Wait for fade-out animation to complete
            setTimeout(() => {
                // Remove active and fade-out classes from current slide
                slides[currentSlide].classList.remove('active', 'fade-out');
                slides[currentSlide].style.transform = 'scale(1)';
                
                // Update current slide
                currentSlide = index;
                
                // Add active class to new slide and dot
                slides[currentSlide].classList.add('active');
                dots[currentSlide].classList.add('active');
                
                // Restart timer
                slideTimer = setInterval(nextSlide, slideInterval);
            }, 1500); // Match the CSS transition duration
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const slides = document.querySelectorAll('.about-slide');
    let currentSlide = 0;
    const slideInterval = 5000; // 5 seconds

    function showNextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    setInterval(showNextSlide, slideInterval);
});