document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const body = document.body;
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    const darkModeToggle = document.getElementById('darkModeToggle');


    // Simplified Page Initializers based on body class
    if (document.body.classList.contains('page-home')) {
        initializeHomepage();
    } else if (document.body.classList.contains('page-get-involved')) {
        initializeGetInvolvedPage();
    } else if (document.body.classList.contains('page-faqs')) {
        initializeFaqs();
    } else if (document.body.classList.contains('page-my-profile')) {
        initializeMyProfilePage();
    } else if (document.body.classList.contains('page-admin-panel')) {
        initializeAdminPanel();
    } else if (document.body.classList.contains('page-donor-register')) {
        initializeDonorRegisterPage();
    }
    initializeScrollAnimations();


    function initializeScrollAnimations() {
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
    }


    function initializeHomepage() {
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length > 0) {
            const statObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                        animateCounter(entry.target);
                        entry.target.classList.add('animated');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });


            statNumbers.forEach(stat => statObserver.observe(stat));
        }


        initializeActivityFeed();
    }


    function initializeActivityFeed() {
        const feed = document.getElementById('activity-feed');
        if (!feed) return;


        const mockActivities = [
            { icon: 'fa-user-plus', text: '<strong>John D.</strong> just registered as a new donor in <strong>New York</strong>.', time: '5m ago' },
            { icon: 'fa-tint', text: 'A request for <strong>A+</strong> blood was fulfilled in <strong>Chicago</strong>.', time: '12m ago' },
            { icon: 'fa-check-circle', text: '<strong>Jane S.</strong> became a <strong>Verified Donor</strong>.', time: '28m ago' },
            { icon: 'fa-user-plus', text: '<strong>Mike P.</strong> just registered as a new donor in <strong>Los Angeles</strong>.', time: '45m ago' },
            { icon: 'fa-tint', text: 'An emergency request for <strong>O-</strong> was created in <strong>New York</strong>.', time: '1h ago' },
        ];


        feed.innerHTML = '';
        mockActivities.forEach(activity => {
            const item = document.createElement('li');
            item.className = 'activity-item';
            item.innerHTML = `
                <i class="fas ${activity.icon} activity-icon"></i>
                <div class="activity-text">${activity.text}</div>
                <div class="activity-time">${activity.time}</div>
            `;
            feed.appendChild(item);
        });
    }


    function initializeGetInvolvedPage() {
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            const tabs = authContainer.querySelectorAll('.auth-tab');
            const forms = authContainer.querySelectorAll('.auth-form');
    
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const formName = tab.dataset.form;
    
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
    
                    forms.forEach(form => {
                        form.classList.toggle('active', form.id === `${formName}-form`);
                    });
                });
            });
        }
    }


    function initializeFaqs() {
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
    }


    function validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');


        inputs.forEach(input => {
            const formGroup = input.closest('.form-group');
            const errorMessage = formGroup.querySelector('.error-message');
            
            if (!input.value.trim()) {
                isValid = false;
                formGroup.classList.add('invalid');
                if (errorMessage) errorMessage.textContent = 'This field is required.';
            } else if (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value)) {
                isValid = false;
                formGroup.classList.add('invalid');
                if (errorMessage) errorMessage.textContent = 'Please enter a valid email address.';
            } else if (input.type === 'number' && input.min && parseInt(input.value) < parseInt(input.min)) {
                isValid = false;
                formGroup.classList.add('invalid');
                if (errorMessage) errorMessage.textContent = `Value must be at least ${input.min}.`;
            }
            else {
                formGroup.classList.remove('invalid');
                if (errorMessage) errorMessage.textContent = '';
            }
        });


        return isValid;
    }


    function initializeAdminPanel() {
        const container = document.getElementById('admin-content-section');
        if (!container) return;
        // Client-side logic for the admin panel, like tab switching
        const tabs = container.querySelectorAll('.admin-tab');
        const tabContents = container.querySelectorAll('.admin-tab-content');
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const target = tab.getAttribute('data-tab');
                    tabContents.forEach(content => {
                        content.classList.toggle('active', content.id === `${target}-content`);
                    });
                });
            });
        }
    }


    function initializeDonorRegisterPage() {
        const registrationForm = document.getElementById('registrationForm');
        if (!registrationForm) return;


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
                const currentFormStep = button.closest('.form-step');
                // Simple validation for required fields in the current step
                const inputs = currentFormStep.querySelectorAll('input[required], select[required]');
                let allValid = true;
                inputs.forEach(input => {
                    if (!input.value.trim()) {
                        allValid = false;
                    }
                });


                if (!allValid) {
                    alert("Please fill out all required fields before proceeding.");
                    return;
                }


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


    function initializeMyProfilePage() {
        // Client-side logic for the profile page, like the edit/save button toggle
        const form = document.getElementById('profile-edit-form');
        if (!form) return;


        const editBtn = document.getElementById('edit-profile-btn');
        const buttonsContainer = document.getElementById('profile-buttons');
        const inputs = form.querySelectorAll('input, select');
        const pictureInput = form.querySelector('#profile-picture');
        const picturePreview = form.querySelector('#picture-preview');


        pictureInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                picturePreview.src = URL.createObjectURL(file);
            }
        });


        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // Enable all inputs except the email
                inputs.forEach(input => {
                    if (input.name !== 'email') {
                        input.disabled = false;
                    }
                });
                // Replace the 'Edit' button with 'Save' and 'Cancel'
                buttonsContainer.innerHTML = `
                    <button type="submit" class="btn-submit">Save Changes</button>
                    <button type="button" id="cancel-edit-btn" class="btn-form">Cancel</button>
                `;
    
                document.getElementById('cancel-edit-btn').addEventListener('click', () => {
                    // Reload the page to cancel changes
                    window.location.reload();
                });
            });
        }
    }


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


    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }


    function toggleMobileMenu() {
        if (menuToggle && mobileSidebar && mobileOverlay) {
            menuToggle.classList.toggle('active');
            mobileSidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            body.style.overflow = mobileSidebar.classList.contains('active') ? 'hidden' : 'auto';
        }
    }


    if (menuToggle) menuToggle.addEventListener('click', toggleMobileMenu);
    if (mobileOverlay) mobileOverlay.addEventListener('click', toggleMobileMenu);


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
    function animateCounter(element) {
            const target = parseInt(element.getAttribute('data-count'));
            const duration = 2000;
            const frameRate = 16;
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
});