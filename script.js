document.addEventListener('DOMContentLoaded', () => {
    // --- Common Elements ---
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const body = document.body;
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // --- Dark Mode Logic ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if(darkModeToggle) darkModeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            if(darkModeToggle) darkModeToggle.checked = false;
        }
    };

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Check for system preference if no theme is saved
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            applyTheme('dark');
        }
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                localStorage.setItem('theme', 'dark');
                applyTheme('dark');
            } else {
                localStorage.setItem('theme', 'light');
                applyTheme('light');
            }
        });
    }

    // --- General Site-wide UI Logic ---

    // 1. Header scroll effect
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // 2. Mobile menu toggle
    function toggleMobileMenu() {
        if (menuToggle && mobileSidebar && mobileOverlay) {
            menuToggle.classList.toggle('active');
            mobileSidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            // Prevent body scroll when mobile menu is open
            body.style.overflow = mobileSidebar.classList.contains('active') ? 'hidden' : 'auto';
        }
    }

    if (menuToggle) menuToggle.addEventListener('click', toggleMobileMenu);
    if (mobileOverlay) mobileOverlay.addEventListener('click', toggleMobileMenu);

    // 3. Desktop sidebar activation & body padding adjustment
    function handleSidebar() {
        if (desktopSidebar && window.innerWidth > 768) {
            body.classList.add('sidebar-active');
            if (header) header.classList.add('sidebar-active');
        } else {
            body.classList.remove('sidebar-active');
            if (header) header.classList.remove('sidebar-active');
        }
    }
    handleSidebar();
    window.addEventListener('resize', handleSidebar);

    // 4. General scroll-reveal animation for elements
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    if (animatedElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, { threshold: 0.1 });

        animatedElements.forEach(el => observer.observe(el));
    }

    // --- Page-Specific Logic ---

    // 5. Homepage: Animated counter for statistics
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length > 0) {
        const statObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                    animateCounter(entry.target);
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target); // Stop observing after animation
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(stat => statObserver.observe(stat));

        function animateCounter(element) {
            const target = parseInt(element.getAttribute('data-count'));
            const duration = 2000;
            const frameRate = 16; // approx 60fps
            const increment = target / (duration / frameRate);
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    element.textContent = target.toLocaleString();
                    clearInterval(timer);
                } else {
                    element.textContent = Math.floor(current).toLocaleString();
                }
            }, frameRate);
        }
    }

    // 6. Donor Registration: Multi-step form
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        const formSteps = registrationForm.querySelectorAll('.form-step');
        const nextButtons = registrationForm.querySelectorAll('.btn-next');
        const prevButtons = registrationForm.querySelectorAll('.btn-prev');
        const progress = registrationForm.querySelector('.progress-bar .progress');
        const progressSteps = registrationForm.querySelectorAll('.progress-bar .step');
        let currentStep = 0; // Step index starts at 0

        const updateFormSteps = () => {
            formSteps.forEach((step, index) => {
                step.classList.toggle('active', index === currentStep);
            });

            updateProgressBar();
        };

        const updateProgressBar = () => {
            progressSteps.forEach((step, index) => {
                if (index < currentStep) {
                    step.classList.add('completed');
                    step.classList.remove('active');
                } else if (index === currentStep) {
                    step.classList.add('active');
                    step.classList.remove('completed');
                } else {
                    step.classList.remove('active', 'completed');
                }
            });

            const progressPercentage = (currentStep / (formSteps.length - 1)) * 100;
            if (progress) progress.style.width = `${progressPercentage}%`;
        };

        nextButtons.forEach(button => {
            button.addEventListener('click', () => {
                currentStep++;
                updateFormSteps();
            });
        });

        prevButtons.forEach(button => {
            button.addEventListener('click', () => {
                currentStep--;
                updateFormSteps();
            });
        });

        updateFormSteps();
    }

    // 7. FAQs Page: Accordion
    const faqQuestions = document.querySelectorAll('.faq-question');
    if (faqQuestions.length > 0) {
        faqQuestions.forEach(question => {
            question.addEventListener('click', () => {
                const answer = question.nextElementSibling;
                const isActive = question.classList.toggle('active');

                if (isActive) {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                } else {
                    answer.style.maxHeight = '0px';
                }
            });
        });
    }
});