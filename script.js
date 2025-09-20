document.addEventListener('DOMContentLoaded', () => {
    // Common elements
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const body = document.body;
    const desktopSidebar = document.querySelector('.desktop-sidebar');

    // --- General Site-wide Logic ---

    // Header scroll effect
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Mobile menu toggle
    function toggleMobileMenu() {
        if (menuToggle && mobileSidebar && mobileOverlay) {
            menuToggle.classList.toggle('active');
            mobileSidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            body.style.overflow = mobileSidebar.classList.contains('active') ? 'hidden' : 'auto';
        }
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', toggleMobileMenu);
    }

    // Desktop sidebar activation
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

    // --- Page-Specific Logic ---

    // Homepage: Animated counter for statistics
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                    animateCounter(entry.target);
                    entry.target.classList.add('animated');
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(stat => observer.observe(stat));

        function animateCounter(element) {
            const target = parseInt(element.getAttribute('data-count'));
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                element.textContent = Math.floor(current).toLocaleString();
            }, 16);
        }
    }

    // Homepage: FAB click handler
    const emergencyFab = document.getElementById('emergencyFab');
    if (emergencyFab) {
        emergencyFab.addEventListener('click', () => {
            window.location.href = 'emergency-request.html';
        });
    }

    // Donor Registration: Multi-step form
    const registrationForm = document.getElementById('registrationForm');
    if (registrationForm) {
        const formSteps = registrationForm.querySelectorAll('.form-step');
        const nextButtons = registrationForm.querySelectorAll('.btn-next');
        const prevButtons = registrationForm.querySelectorAll('.btn-prev');
        const progress = registrationForm.querySelector('.progress-bar .progress');
        const progressSteps = registrationForm.querySelectorAll('.progress-bar .step');
        let currentStep = 0;

        const updateFormSteps = () => {
            formSteps.forEach((step, index) => {
                step.classList.toggle('active', index === currentStep);
            });

            const progressPercentage = (currentStep / (formSteps.length - 1)) * 100;
            if (progress) {
                progress.style.width = `${progressPercentage}%`;
            }

            progressSteps.forEach((step, index) => {
                step.classList.remove('active', 'completed');
                if (index < currentStep) {
                    step.classList.add('completed');
                } else if (index === currentStep) {
                    step.classList.add('active');
                }
            });
        };

        nextButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (currentStep < formSteps.length - 1) {
                    currentStep++;
                    updateFormSteps();
                }
            });
        });

        prevButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (currentStep > 0) {
                    currentStep--;
                    updateFormSteps();
                }
            });
        });

        updateFormSteps();
    }

    // FAQs Page: Accordion
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

    // --- New Enhancements ---
    // General scroll animation
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    if (animatedElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    // Optional: unobserve after animation to improve performance
                    // observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        animatedElements.forEach(el => observer.observe(el));
    }
});