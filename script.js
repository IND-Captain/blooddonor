import { db, auth, storage } from './firebase-config.js';
import { collection, getDocs, addDoc, setDoc, doc, getDoc, updateDoc, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-functions.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

    const mainContent = document.getElementById('main-content');
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const body = document.body;
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    const darkModeToggle = document.getElementById('darkModeToggle');

    const bloodCompatibility = {
        'A+': ['A+', 'A-', 'O+', 'O-'],
        'A-': ['A-', 'O-'],
        'B+': ['B+', 'B-', 'O+', 'O-'],
        'B-': ['B-', 'O-'],
        'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        'AB-': ['A-', 'B-', 'AB-', 'O-'],
        'O+': ['O+', 'O-'],
        'O-': ['O-'],
    };

    const pageInitializers = {
        '/': initializeHomepage,
        '/index.html': initializeHomepage,
        '/get-involved.html': initializeGetInvolvedPage,
        '/search-donors.html': initializeSearchDonors,
        '/faqs.html': initializeFaqs,
        '/my-profile.html': initializeMyProfilePage,
        '/admin-panel.html': initializeAdminPanel,
        '/emergency-request.html': initializeEmergencyRequestPage,
        '/admin-login.html': initializeAdminLoginPage,
        '/leaderboard.html': initializeLeaderboard,
    };

    const loadContent = async (url, pushState = true) => {
        try {
            const fetchUrl = url === '/' ? '/index.html' : url;
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                console.error("Page not found:", url);
                mainContent.innerHTML = `<section class="page-header"><div class="container"><h1>404 - Page Not Found</h1><p>Sorry, the page you are looking for does not exist.</p></div></section>`;
                return;
            }

            const newContent = await response.text();
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(newContent, 'text/html');
            const newMain = newDoc.querySelector('#main-content');
            const newTitle = newDoc.querySelector('title').innerText;
            const newBodyClass = newDoc.body.className;

            if (newMain) {
                document.body.className = newBodyClass;
                mainContent.innerHTML = newMain.innerHTML;
                document.title = newTitle;

                if (pushState) {
                    history.pushState({ path: url }, newTitle, url);
                }

                updateUI(auth.currentUser);

                const pagePath = new URL(url, window.location.origin).pathname;
                if (pageInitializers[pagePath]) {
                    pageInitializers[pagePath]();
                }
                initializeScrollAnimations();
                updateActiveLink(url);
            }
        } catch (error) {
            console.error('Error loading page:', error);
        }
    };

    const updateActiveLink = (path) => {
        // First, remove 'active' from all navigation links
        document.querySelectorAll('.sidebar-nav a, .nav-links a').forEach(link => {
            link.classList.remove('active');
        });

        // Normalize the path to match the href attribute.
        const targetFile = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

        // Add 'active' to the matching link(s)
        document.querySelectorAll(`.sidebar-nav a[href="${targetFile}"], .nav-links a[href="${targetFile}"]`).forEach(link => {
            link.classList.add('active');
        });

        // Special case for the root path to activate index.html links
        if (path === '/') {
            document.querySelectorAll(`.sidebar-nav a[href="index.html"], .nav-links a[href="index.html"]`).forEach(link => {
                link.classList.add('active');
            });
        }
    };

    document.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (link && (link.matches('.sidebar-nav a, .nav-links a, .logo, .profile-login-link') || link.closest('.hero-buttons'))) {
            e.preventDefault();
            const href = link.getAttribute('href');
            const targetPath = new URL(href, window.location.origin).pathname;

            if (mobileSidebar.classList.contains('active')) {
                toggleMobileMenu();
            }
            if (targetPath !== window.location.pathname) {
                loadContent(href);
            }
        }
    });

    window.addEventListener('popstate', e => {
        if (e.state && e.state.path) {
            loadContent(e.state.path, false);
        } else {
            loadContent(location.pathname, false);
        }
    });

    const currentPagePath = window.location.pathname;
    if (pageInitializers[currentPagePath]) {
        pageInitializers[currentPagePath]();
    } else if (currentPagePath === '/' || currentPagePath.endsWith('index.html')) {
        initializeHomepage();
    }
    initializeScrollAnimations();
    updateActiveLink(window.location.pathname);

    onAuthStateChanged(auth, user => updateUI(user));

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
        // This function now only needs to set up listeners,
        // as the global updateUI function handles showing/hiding content.
        // The auth state is checked by the global listener and on every page load.

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
    
        const signupForm = document.getElementById('signup-form');
        signupForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.querySelector('#signup-email').value;
            const password = signupForm.querySelector('#signup-password').value;
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Signed up:', userCredential.user);
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: userCredential.user.email,
                    role: 'donor',
                    createdAt: new Date()
                });
            } catch (error) {
                alert(error.message);
            }
        });

        const loginForm = document.getElementById('login-form');
        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const email = form.querySelector('#login-email').value;
            const password = form.querySelector('#login-password').value;
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('Logged in:', userCredential.user);
            } catch (error) {
                alert(error.message);
            }
        });
    }

    function initializeDonorRegisterForm() {
        const registrationForm = document.getElementById('registrationForm');
        if (registrationForm) {
            const formSteps = registrationForm.querySelectorAll('.form-step');
            const nextButtons = registrationForm.querySelectorAll('.btn-next');
            const prevButtons = registrationForm.querySelectorAll('.btn-prev');
            const progress = registrationForm.querySelector('.progress-bar .progress');
            const progressSteps = registrationForm.querySelectorAll('.progress-bar .step');
            let currentStep = 0;

            const pictureInput = registrationForm.querySelector('#profile-picture');
            const picturePreview = registrationForm.querySelector('#picture-preview');
            pictureInput?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    picturePreview.src = URL.createObjectURL(file);
                }
            });

            registrationForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!validateForm(registrationForm.querySelector('.form-step.active'))) {
                    alert("Please ensure all fields in the current step are filled out correctly.");
                    return;
                }

                if (!auth.currentUser) {
                    alert("You must be logged in to register as a donor.");
                    return;
                }

                let profilePictureUrl = "https://i.pravatar.cc/150";
                const file = pictureInput.files[0];
                if (file) {
                    try {
                        const storageRef = ref(storage, `profile-pictures/${auth.currentUser.uid}/${file.name}`);
                        const snapshot = await uploadBytes(storageRef, file);
                        profilePictureUrl = await getDownloadURL(snapshot.ref);
                        console.log('File uploaded successfully:', profilePictureUrl);
                    } catch (error) {
                        console.error("Error uploading profile picture:", error);
                        alert("Could not upload profile picture. Please try again.");
                        return;
                    }
                }

                const formData = new FormData(registrationForm);
                const donorData = {
                    uid: auth.currentUser.uid, 
                    fullName: formData.get('fullname'),
                    dob: new Date(formData.get('dob')),
                    gender: formData.get('gender'),
                    email: auth.currentUser.email,
                    phone: formData.get('phone'),
                    city: formData.get('city'),
                    bloodType: formData.get('bloodgroup'),
                    profilePictureUrl: profilePictureUrl,
                    lastDonationDate: formData.get('last-donation') ? new Date(formData.get('last-donation')) : null,
                    isVerified: false,
                    availability: 'available',
                    totalDonations: 0,
                    createdAt: new Date()
                };

                try {
                    await setDoc(doc(db, "donors", auth.currentUser.uid), donorData);
                    await updateUIForLoggedInUser(auth.currentUser);
                    console.log("Donor registered successfully!");
                } catch (error) {
                    console.error("Error registering donor: ", error);
                    alert("There was an error with your registration. Please try again.");
                }
            });

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
                    if (!validateForm(currentFormStep)) {
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
    }

    async function initializeSearchDonors() {
        const searchGrid = document.querySelector('.search-grid');
        const searchForm = document.querySelector('.search-container');

        if (searchGrid) {
            searchGrid.innerHTML = `<p class="search-results-message">Searching for available donors...</p>`;
            const donorsCol = collection(db, 'donors');
            const donorSnapshot = await getDocs(donorsCol);
            const allDonors = donorSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            renderDonors(allDonors, searchGrid);
        }

        if (searchForm && searchGrid) {
            searchForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const requestedBloodGroup = searchForm.querySelector('#bloodgroup').value;
                const city = searchForm.querySelector('#city').value;

                searchGrid.innerHTML = `<p class="search-results-message">Searching for ${requestedBloodGroup} donors in ${city}...</p>`;

                const compatibleBloodGroups = bloodCompatibility[requestedBloodGroup] || [];

                const donorsRef = collection(db, "donors");
                const q = query(donorsRef, 
                    where("city", "==", city), 
                    where("bloodType", "in", compatibleBloodGroups),
                    where("availability", "==", "available")
                );

                const querySnapshot = await getDocs(q);
                const filteredDonors = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                renderDonors(filteredDonors, searchGrid);
            });

            searchGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-request-donor')) {
                    if (!auth.currentUser) {
                        alert("Please log in to request blood.");
                        loadContent('/get-involved.html');
                        return;
                    }
                    const donorId = e.target.dataset.donorId;
                    const donorName = e.target.dataset.donorName;
                    const donorBloodType = e.target.dataset.donorBloodType;
                    showBloodRequestModal(donorId, donorName, donorBloodType);
                }
            });
        }
    }

    function renderDonors(donors, container) {
        container.innerHTML = '';

        if (donors.length === 0) {
            container.innerHTML = `<p class="search-results-message">No donors found matching your criteria. Please try a different search.</p>`;
            return;
        }

        donors.forEach(donor => {
            const donorCard = document.createElement('div');
            donorCard.className = 'donor-card';

            const verificationStatus = donor.isVerified
                ? `<div class="donor-info"><i class="fas fa-check-circle"></i> Verified Donor</div>`
                : `<div class="donor-info"><i class="fas fa-times-circle" style="color: var(--gray-300);"></i> Not Verified</div>`;
            
            const availability = donor.availability === 'available'
                ? `<div class="donor-info"><i class="fas fa-calendar-alt"></i> Available Now</div>`
                : `<div class="donor-info"><i class="fas fa-calendar-times"></i> Not Available</div>`;

            donorCard.innerHTML = `
                <div class="donor-card-header">
                    <div class="blood-type-icon">${donor.bloodType}</div>
                    <h3 class="donor-card-name">${donor.fullName}</h3>
                </div>
                <div class="donor-card-body">
                    <div class="donor-info"><i class="fas fa-map-marker-alt"></i> ${donor.city}</div>
                    ${verificationStatus}
                    ${availability}
                </div>
                <div class="donor-card-footer">
                    <button class="btn-secondary btn-request-donor" data-donor-id="${donor.id}" data-donor-name="${donor.fullName}" data-donor-blood-type="${donor.bloodType}">Request</button>
                </div>
            `;
            container.appendChild(donorCard);
        });
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

    async function updateUI(user) {
        if (user) {
            await updateUIForLoggedInUser(user);
        } else {
            updateUIForLoggedOutUser();
        }
    }

    async function updateUIForLoggedInUser(user) {
        const donorDoc = await getDoc(doc(db, "donors", user.uid));

        if (document.body.classList.contains('page-get-involved')) {
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.classList.add('hidden');

            const contentContainer = document.getElementById('request-form-container');
            if (contentContainer) {
                contentContainer.classList.remove('hidden');
    
                const userStatusHTML = `
                    <div class="info-box" id="user-status" style="margin-bottom: 30px; text-align: left;">
                        <p>Logged in as: <strong>${user.email}</strong></p>
                        <button id="logout-button" class="btn-form" style="float: right; margin-top: -35px;">Logout</button>
                    </div>
                `;
                
                if (donorDoc.exists()) {
                    const requestFormHTML = `<div class="form-container">${getBloodRequestFormHTML()}</div>`;
                    contentContainer.innerHTML = userStatusHTML + requestFormHTML;
                    addBloodRequestFormListener();
                } else {
                    const registrationFormHTML = `<div class="form-container">${getDonorRegistrationFormHTML()}</div>`;
                    contentContainer.innerHTML = userStatusHTML + registrationFormHTML;
                    initializeDonorRegisterForm();
                }
    
                document.getElementById('logout-button')?.addEventListener('click', async () => {
                    await signOut(auth);
                    console.log('User signed out');
                    loadContent(window.location.pathname);
                });
            }
        }

        const myProfileLink = document.getElementById('my-profile-nav-link');
        if (myProfileLink) myProfileLink.classList.remove('hidden');

        const profileContainer = document.querySelector('.desktop-sidebar .profile');
        if (profileContainer) {
            if (donorDoc.exists()) {
                const donorData = donorDoc.data();

                let ageText = '';
                let age = 0;
                if (donorData.dob && donorData.dob.toDate) {
                    const birthDate = donorData.dob.toDate();
                    const today = new Date();
                    age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                }
                profileContainer.innerHTML = `
                    <img src="${donorData.profilePictureUrl || 'https://i.pravatar.cc/150'}" alt="User profile picture" class="profile-img">
                    <div class="profile-info" style="text-align: center;">
                        <h4 class="profile-name" style="margin-bottom: 5px;">${donorData.fullName}</h4>
                        <div class="profile-detail-links">
                            <a href="my-profile.html">Age: ${age > 0 ? age : 'N/A'}</a>
                            <a href="my-profile.html">Blood: ${donorData.bloodType}</a>
                            <a href="my-profile.html">City: ${donorData.city}</a>
                        </div>
                    </div>
                `;
            } else {
                profileContainer.innerHTML = `
                    <a href="get-involved.html" class="profile-login-link">
                        <i class="fas fa-user-circle profile-icon-default"></i>
                        <div class="profile-info">
                            <h4 class="profile-name">Welcome!</h4>
                            <p class="profile-detail" style="font-size: 0.8rem; color: var(--primary-red);">Complete Your Profile</p>
                        </div>
                    </a>
                `;
            }
        }

        initializeScrollAnimations();
    }

    function updateUIForLoggedOutUser() {
        if (document.body.classList.contains('page-get-involved')) {
            const authContainer = document.getElementById('auth-container');
            const contentContainer = document.getElementById('request-form-container');
            if (authContainer) authContainer.classList.remove('hidden');
            if (contentContainer) {
                contentContainer.classList.add('hidden');
            }
        }

        const myProfileLink = document.getElementById('my-profile-nav-link');
        if (myProfileLink) myProfileLink.classList.add('hidden');

        const profileContainer = document.querySelector('.desktop-sidebar .profile');
        if (profileContainer) {
            profileContainer.innerHTML = `
                <a href="get-involved.html" class="profile-login-link">
                    <i class="fas fa-user-circle profile-icon-default"></i>
                    <div class="profile-info">
                        <h4 class="profile-name">Sign In / Sign Up</h4>
                    </div>
                </a>
            `;
        }

        initializeScrollAnimations();
    }

    function showBloodRequestModal(donorId, donorName, donorBloodType) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Request Blood from ${donorName} (${donorBloodType})</h3>
                    <button id="close-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <form id="modal-request-form" novalidate>
                    <div class="form-group">
                        <label for="patient-name" class="form-label">Patient's Full Name</label>
                        <input type="text" id="patient-name" name="patient-name" class="form-input" placeholder="Enter patient's name" required>
                        <span class="error-message"></span>
                    </div>
                    <div class="form-group">
                        <label for="units" class="form-label">Required Units</label>
                        <input type="number" id="units" name="units" class="form-input" placeholder="Number of units needed" required min="1">
                        <span class="error-message"></span>
                    </div>
                    <div class="form-group">
                        <label for="hospital" class="form-label">Hospital Name & Address</label>
                        <input type="text" id="hospital" name="hospital" class="form-input" placeholder="e.g., City General Hospital, New York" required>
                        <span class="error-message"></span>
                    </div>
                    <div class="form-group">
                        <label for="reason" class="form-label">Reason for Request</label>
                        <textarea id="reason" name="reason" class="form-textarea" placeholder="Briefly describe the reason (e.g., Surgery, Accident)"></textarea>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn-submit"><i class="fas fa-paper-plane"></i> Submit Request</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const closeModal = () => modalOverlay.remove();
        modalOverlay.querySelector('#close-modal').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        const form = modalOverlay.querySelector('#modal-request-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(form)) {
                alert("Please fill out all required fields.");
                return;
            }

            const formData = new FormData(form);
            const donorDoc = await getDoc(doc(db, "donors", donorId));
            if (!donorDoc.exists()) {
                alert("Donor not found.");
                closeModal();
                return;
            }
            const donorData = donorDoc.data();

            const requestData = {
                requesterId: auth.currentUser.uid,
                donorId: donorId,
                patientName: formData.get('patient-name'),
                bloodType: donorData.bloodType,
                unitsRequired: Number(formData.get('units')),
                hospitalName: formData.get('hospital'),
                city: donorData.city,
                isEmergency: false,
                status: 'pending',
                createdAt: new Date(),
            };

            await addDoc(collection(db, "requests"), requestData);
            form.closest('.modal-content').innerHTML = `<div class="form-header"><h3>Request Sent!</h3></div><div class="info-box"><p><i class="fas fa-check-circle"></i> Your request has been sent to ${donorName}. They will be notified to respond.</p></div>`;
        });
    }

    function getDonorRegistrationFormHTML() {
        return `
            <form action="#" method="POST" id="registrationForm">
                <div class="form-header">
                    <h3><i class="fas fa-user-plus"></i> Become a Donor</h3>
                    <p style="color: var(--gray-600); font-size: 0.9rem; margin-top: 10px;">Complete your profile to start saving lives.</p>
                    <div class="progress-bar">
                        <div class="progress"></div>
                        <div class="step active" data-step="1"><div class="step-circle">1</div><div class="step-title">Personal</div></div>
                        <div class="step" data-step="2"><div class="step-circle">2</div><div class="step-title">Contact</div></div>
                        <div class="step" data-step="3"><div class="step-circle">3</div><div class="step-title">Medical</div></div>
                    </div>
                </div>
                <div class="form-step active">
                    <h4 class="form-step-title">Step 1: Personal Information</h4>
                    <div class="form-group profile-picture-group">
                        <label for="profile-picture" class="form-label">Profile Picture</label>
                        <input type="file" id="profile-picture" name="profile-picture" class="form-input" accept="image/*">
                        <img id="picture-preview" src="https://i.pravatar.cc/150" alt="Profile picture preview" class="profile-img-preview">
                    </div>
                    <div class="form-group"><label for="fullname" class="form-label">Full Name</label><input type="text" id="fullname" name="fullname" class="form-input" placeholder="John Doe" required><span class="error-message"></span></div>
                    <div class="form-group"><label for="dob" class="form-label">Date of Birth</label><input type="date" id="dob" name="dob" class="form-input" required><span class="error-message"></span></div>
                    <div class="form-group"><label for="gender" class="form-label">Gender</label><select id="gender" name="gender" class="form-select" required><option value="" disabled selected>Select your gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Prefer not to say</option></select><span class="error-message"></span></div>
                    <div class="form-buttons"><button type="button" class="btn-form btn-next">Next <i class="fas fa-arrow-right"></i></button></div>
                </div>
                <div class="form-step">
                    <h4 class="form-step-title">Step 2: Contact Details</h4>
                    <div class="form-group"><label for="phone" class="form-label">Phone Number</label><input type="tel" id="phone" name="phone" class="form-input" placeholder="Your contact number" required><span class="error-message"></span></div>
                    <div class="form-group"><label for="city" class="form-label">City / Town</label><input type="text" id="city" name="city" class="form-input" placeholder="e.g., New York" required><span class="error-message"></span></div>
                    <div class="form-buttons"><button type="button" class="btn-form btn-prev"><i class="fas fa-arrow-left"></i> Previous</button><button type="button" class="btn-form btn-next">Next <i class="fas fa-arrow-right"></i></button></div>
                </div>
                <div class="form-step">
                    <h4 class="form-step-title">Step 3: Medical Information</h4>
                    <div class="form-group"><label for="bloodgroup-donor" class="form-label">Blood Group</label><select id="bloodgroup-donor" name="bloodgroup" class="form-select" required><option value="" disabled selected>Select blood group</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select><span class="error-message"></span></div>
                    <div class="form-group"><label for="last-donation" class="form-label">Last Donation Date (if any)</label><input type="date" id="last-donation" name="last-donation" class="form-input"><span class="error-message"></span></div>
                    <div class="form-group"><label class="form-label">Have you had any major illnesses or surgeries in the past year?</label><textarea id="medical-history" name="medical-history" class="form-textarea" placeholder="Please provide details if yes."></textarea></div>
                    <div class="form-buttons"><button type="button" class="btn-form btn-prev"><i class="fas fa-arrow-left"></i> Previous</button><button type="submit" class="btn-submit">Register as Donor</button></div>
                </div>
            </form>
        `;
    }

    function getBloodRequestFormHTML() {
        return `
            <form action="#" method="POST" id="bloodRequestForm" novalidate>
                <div class="form-header">
                    <h3><i class="fas fa-tint"></i> Request Blood</h3>
                    <p style="color: var(--gray-600); font-size: 0.9rem; margin-top: 10px;">For standard, non-emergency requests.</p>
                </div>
                <div class="form-group"><label for="patient-name" class="form-label">Patient's Full Name</label><input type="text" id="patient-name" name="patient-name" class="form-input" placeholder="Enter patient's name" required><span class="error-message"></span></div>
                <div class="form-group"><label for="bloodgroup-request" class="form-label">Required Blood Group</label><select id="bloodgroup-request" name="bloodgroup" class="form-select" required><option value="" disabled selected>Select blood group</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select><span class="error-message"></span></div>
                <div class="form-group"><label for="units" class="form-label">Required Units</label><input type="number" id="units" name="units" class="form-input" placeholder="Number of units needed" required min="1"><span class="error-message"></span></div>
                <div class="form-group"><label for="hospital" class="form-label">Hospital Name & Address</label><input type="text" id="hospital" name="hospital" class="form-input" placeholder="e.g., City General Hospital, New York" required><span class="error-message"></span></div>
                <div class="form-group"><label for="contact-person" class="form-label">Contact Person</label><input type="text" id="contact-person" name="contact-person" class="form-input" placeholder="Name of the person to contact" required><span class="error-message"></span></div>
                <div class="form-group"><label for="contact-phone" class="form-label">Contact Phone</label><input type="tel" id="contact-phone" name="contact-phone" class="form-input" placeholder="A phone number for contact" required><span class="error-message"></span></div>
                <div class="form-group"><label for="reason" class="form-label">Reason for Request</label><textarea id="reason" name="reason" class="form-textarea" placeholder="Briefly describe the reason (e.g., Surgery, Accident)"></textarea></div>
                <div class="form-group"><button type="submit" class="btn-submit"><i class="fas fa-paper-plane" aria-hidden="true"></i> Submit Request</button></div>
            </form>
        `;
    }
    
    function addBloodRequestFormListener() {
        const requestForm = document.getElementById('bloodRequestForm');
        if (!requestForm) return;

        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(requestForm)) {
                alert("Please fill out all required fields correctly.");
                return;
            }
            if (!auth.currentUser) {
                alert("You must be logged in to make a request.");
                return;
            }

            const formData = new FormData(requestForm);
            const requestData = {
                requesterId: auth.currentUser.uid,
                patientName: formData.get('patient-name'),
                bloodType: formData.get('bloodgroup'),
                unitsRequired: Number(formData.get('units')),
                hospitalName: formData.get('hospital'),
                city: formData.get('hospital').split(',')[1]?.trim() || 'Unknown',
                isEmergency: false,
                status: 'pending',
                createdAt: new Date(),
            };

            try {
                const docRef = await addDoc(collection(db, "requests"), requestData);
                console.log("Request submitted with ID: ", docRef.id);
                const formContainer = requestForm.closest('.form-container');
                formContainer.innerHTML = `
                    <div class="form-header">
                        <h3>Thank You!</h3>
                    </div>
                    <div class="info-box" style="text-align: center;">
                        <p><i class="fas fa-check-circle"></i> Your blood request has been submitted. Our system will now find and notify compatible donors.</p>
                    </div>
                `;
            } catch (error) {
                console.error("Error adding request: ", error);
                alert("There was an error submitting your request. Please try again.");
            }
        });
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

    async function initializeAdminPanel() {
        const container = document.getElementById('admin-content-section');
        if (!container) return;

        const user = auth.currentUser;
        if (!user) {
            container.innerHTML = `<div class="info-box"><p>Please log in to access the admin panel.</p></div>`;
            return;
        }

        const idTokenResult = await user.getIdTokenResult();
        if (!idTokenResult.claims.admin) {
            container.innerHTML = `<div class="info-box" style="border-color: var(--primary-red);"><p><i class="fas fa-exclamation-triangle"></i> Access Denied. You do not have administrative privileges.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="admin-tabs">
                <div class="admin-tab active" data-tab="donors">Donor Management</div>
                <div class="admin-tab" data-tab="requests">Request Management</div>
                <div class="admin-tab" data-tab="broadcast">Broadcast</div>
                <div class="admin-tab" data-tab="reports">Reports</div>
            </div>
            <div id="donors-content" class="admin-tab-content active">
                <h3>All Donors</h3>
                <table class="admin-table" id="donors-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody><tr><td colspan="5" style="text-align:center;">Loading users...</td></tr></tbody>
                </table>
            </div>
            <div id="requests-content" class="admin-tab-content">
                <h3>All Blood Requests</h3>
                <table class="admin-table" id="requests-table">
                    <thead><tr><th>Patient</th><th>Blood Type</th><th>City</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody><tr><td colspan="6" style="text-align:center;">Loading requests...</td></tr></tbody>
                </table>
            </div>
            <div id="broadcast-content" class="admin-tab-content">
                <h3>Send Broadcast Message</h3>
                <form id="broadcast-form">
                    <div class="form-group">
                        <label for="broadcast-city" class="form-label">Select City</label>
                        <select id="broadcast-city" class="form-select" required></select>
                    </div>
                    <div class="form-group">
                        <label for="broadcast-message" class="form-label">Message</label>
                        <textarea id="broadcast-message" class="form-textarea" required placeholder="Enter your message to donors..."></textarea>
                    </div>
                    <button type="submit" class="btn-submit">Send Broadcast</button>
                </form>
            </div>
            <div id="reports-content" class="admin-tab-content">
                <h3>Platform Analytics</h3>
                <div class="stats-grid" style="padding-top: 20px;">
                    <div class="stat-card"><div id="total-donors" class="stat-number">0</div><div class="stat-label">Total Donors</div></div>
                    <div class="stat-card"><div id="total-requests" class="stat-number">0</div><div class="stat-label">Total Requests</div></div>
                </div>
            </div>
        `;

        const tabs = container.querySelectorAll('.admin-tab');
        const tabContents = container.querySelectorAll('.admin-tab-content');
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

        await loadDonorsForAdmin();
        loadRequestsForAdmin();
        await initializeBroadcastForm();
        await loadAdminReports();
    }

    async function loadDonorsForAdmin() {
        const tableBody = document.querySelector('#donors-table tbody');
        if (!tableBody) return;

        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = '';
        for (const docSnap of querySnapshot.docs) {
            const user = docSnap.data();
            const uid = docSnap.id;
            const donorSnap = await getDoc(doc(db, "donors", uid));
            const donor = donorSnap.exists() ? donorSnap.data() : {};
            const row = document.createElement('tr');
            row.dataset.uid = uid;

            let statusHtml = '';
            if (donor.availability === 'suspended') {
                statusHtml = `<span style="color: var(--warning-orange); font-weight: bold;">Suspended</span>`;
            } else if (donor.isVerified) {
                statusHtml = `<span style="color: var(--success-green);">Verified</span>`;
            } else {
                statusHtml = `<span>Not Verified</span>`;
            }

            const actionsHtml = `
                ${!donor.isVerified ? `<button class="btn-verify" data-uid="${uid}">Verify</button>` : ''}
                <button class="btn-suspend" data-uid="${uid}" data-disabled="${donor.availability !== 'suspended'}">
                    ${donor.availability !== 'suspended' ? 'Suspend' : 'Unsuspend'}
                </button>
                <button class="btn-change-role" data-uid="${uid}" data-current-role="${user.role}">Change Role</button>
                <button class="btn-delete" data-uid="${uid}">Delete</button>
            `;

            row.innerHTML = `
                <td>${donor.fullName || user.email}</td>
                <td>${user.email}</td>
                <td>${user.role || 'donor'}</td>
                <td>${statusHtml}</td>
                <td>${actionsHtml}</td>
            `;
            tableBody.appendChild(row);
        }

        tableBody.addEventListener('click', async (e) => {
            const target = e.target;
            const uid = target.dataset.uid;
            if (!uid) return;

            const functions = getFunctions();

            if (target.classList.contains('btn-verify')) {
                const donorRef = doc(db, "donors", uid);
                await updateDoc(donorRef, { isVerified: true });
                alert(`Donor ${uid} has been verified.`);
                loadDonorsForAdmin();
            }

            if (target.classList.contains('btn-suspend')) {
                const shouldDisable = target.dataset.disabled === 'true';
                if (confirm(`Are you sure you want to ${shouldDisable ? 'suspend' : 'unsuspend'} this user?`)) {
                    const suspendUser = httpsCallable(functions, 'suspendUser');
                    await suspendUser({ uid, disabled: shouldDisable });
                    loadDonorsForAdmin();
                }
            }

            if (target.classList.contains('btn-delete')) {
                if (confirm(`Are you sure you want to permanently delete this user? This action cannot be undone.`)) {
                    const deleteUser = httpsCallable(functions, 'deleteUser');
                    await deleteUser({ uid });
                    target.closest('tr').remove();
                }
            }

            if (target.classList.contains('btn-change-role')) {
                const currentRole = target.dataset.currentRole;
                showRoleChangeModal(uid, currentRole);
            }
        });
    }

    function showRoleChangeModal(uid, currentRole) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Change Role for User ${uid}</h3>
                    <button id="close-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="form-group">
                    <label for="role-select">New Role</label>
                    <select id="role-select" class="form-select">
                        <option value="donor" ${currentRole === 'donor' ? 'selected' : ''}>Donor</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div class="form-buttons">
                    <button id="save-role-btn" class="btn-submit">Save Role</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const closeModal = () => modalOverlay.remove();
        modalOverlay.querySelector('#close-modal').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        document.getElementById('save-role-btn').addEventListener('click', async () => {
            const newRole = document.getElementById('role-select').value;
            if (confirm(`Are you sure you want to change this user's role to "${newRole}"?`)) {
                const functions = getFunctions();
                const changeUserRole = httpsCallable(functions, 'changeUserRole');
                await changeUserRole({ uid, newRole });
                alert('Role updated successfully!');
                closeModal();
                loadDonorsForAdmin();
            }
        });
    }

    function loadRequestsForAdmin() {
        const tableBody = document.querySelector('#requests-table tbody');
        if (!tableBody) return;

        const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));

        onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No blood requests found.</td></tr>`;
                return;
            }

            tableBody.innerHTML = '';
            querySnapshot.forEach(docSnap => {
                const request = docSnap.data();
                const requestId = docSnap.id;
                const row = document.createElement('tr');

                const statusColors = {
                    pending: '#F59E0B',
                    fulfilled: '#10B981',
                    closed: '#4B5563'
                };

                row.innerHTML = `
                    <td>${request.patientName}</td>
                    <td>${request.bloodType}</td>
                    <td>${request.city}</td>
                    <td><span class="status" style="background-color:${statusColors[request.status] || '#ccc'}; color:white;">${request.status}</span></td>
                    <td>${request.createdAt.toDate().toLocaleDateString()}</td>
                    <td>
                        ${request.status === 'pending' ? `<button class="btn-delete" data-id="${requestId}">Close</button>` : ''}
                    </td>
                `;
                tableBody.appendChild(row);
            });

            tableBody.querySelectorAll('.btn-delete').forEach(button => {
                button.addEventListener('click', async () => {
                    const requestId = button.dataset.id;
                    await updateDoc(doc(db, "requests", requestId), { status: 'closed' });
                });
            });
        });
    }

    async function loadAdminReports() {
        const donorsSnapshot = await getDocs(collection(db, "donors"));
        const requestsSnapshot = await getDocs(collection(db, "requests"));
        document.getElementById('total-donors').textContent = donorsSnapshot.size;
        document.getElementById('total-requests').textContent = requestsSnapshot.size;
    }

    async function initializeBroadcastForm() {
        const citySelect = document.getElementById('broadcast-city');
        const broadcastForm = document.getElementById('broadcast-form');
        if (!citySelect || !broadcastForm) return;

        const donorsSnapshot = await getDocs(collection(db, "donors"));
        const cities = new Set();
        donorsSnapshot.forEach(doc => {
            cities.add(doc.data().city);
        });

        citySelect.innerHTML = '<option value="">Select a City</option>';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        broadcastForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const city = citySelect.value;
            const message = document.getElementById('broadcast-message').value;

            if (!city || !message) {
                alert("Please select a city and enter a message.");
                return;
            }

            const functions = getFunctions();
            const sendBroadcast = httpsCallable(functions, 'sendBroadcast');
            const result = await sendBroadcast({ city, message });
            alert(result.data.message);
        });
    }

    async function initializeMyProfilePage() {
        const user = auth.currentUser;
        const container = document.getElementById('profile-form-container');

        if (!user) {
            container.innerHTML = `<p>You must be logged in to view your profile.</p>`;
            return;
        }

        const donorRef = doc(db, "donors", user.uid);
        const donorSnap = await getDoc(donorRef);

        if (!donorSnap.exists()) {
            container.innerHTML = `<p>You have not created a donor profile yet. Please go to the "Get Involved" page to register.</p>`;
            return;
        }

        const donorData = donorSnap.data();

        const dob = donorData.dob && donorData.dob.toDate ? donorData.dob.toDate().toISOString().split('T')[0] : '';

        container.innerHTML = `
            <form id="profile-edit-form" novalidate>
                <div class="form-header"><h3>Edit Your Profile</h3></div>
                <div class="form-group profile-picture-group">
                    <label for="profile-picture" class="form-label">Profile Picture</label>
                    <input type="file" id="profile-picture" name="profile-picture" class="form-input" accept="image/*">
                    <img id="picture-preview" src="${donorData.profilePictureUrl || 'https://i.pravatar.cc/150'}" alt="Profile picture preview" class="profile-img-preview">
                </div>
                <div class="form-group">
                    <label for="profile-fullname" class="form-label">Full Name</label>
                    <input type="text" id="profile-fullname" name="fullName" class="form-input" value="${donorData.fullName}" required disabled>
                </div>
                <div class="form-group">
                    <label for="profile-phone" class="form-label">Phone</label>
                    <input type="tel" id="profile-phone" name="phone" class="form-input" value="${donorData.phone}" required disabled>
                </div>
                <div class="form-group">
                    <label for="profile-city" class="form-label">City</label>
                    <input type="text" id="profile-city" name="city" class="form-input" value="${donorData.city}" required disabled>
                </div>
                <div class="form-group">
                    <label for="profile-dob" class="form-label">Date of Birth</label>
                    <input type="date" id="profile-dob" name="dob" class="form-input" value="${dob}" required disabled>
                </div>
                <div class="form-group">
                    <label for="profile-bloodgroup" class="form-label">Blood Group</label>
                    <select id="profile-bloodgroup" name="bloodType" class="form-select" disabled><option value="A+" ${donorData.bloodType === 'A+' ? 'selected' : ''}>A+</option><option value="A-" ${donorData.bloodType === 'A-' ? 'selected' : ''}>A-</option><option value="B+" ${donorData.bloodType === 'B+' ? 'selected' : ''}>B+</option><option value="B-" ${donorData.bloodType === 'B-' ? 'selected' : ''}>B-</option><option value="AB+" ${donorData.bloodType === 'AB+' ? 'selected' : ''}>AB+</option><option value="AB-" ${donorData.bloodType === 'AB-' ? 'selected' : ''}>AB-</option><option value="O+" ${donorData.bloodType === 'O+' ? 'selected' : ''}>O+</option><option value="O-" ${donorData.bloodType === 'O-' ? 'selected' : ''}>O-</option></select>
                </div>
                <div class="form-group">
                    <label for="profile-availability" class="form-label">Availability</label>
                    <select id="profile-availability" name="availability" class="form-select" disabled>
                        <option value="available" ${donorData.availability === 'available' ? 'selected' : ''}>Available</option>
                        <option value="unavailable" ${donorData.availability === 'unavailable' ? 'selected' : ''}>Unavailable</option>
                    </select>
                </div>
                <div id="profile-buttons" class="form-buttons">
                    <button type="button" id="edit-profile-btn" class="btn-primary">Edit Profile</button>
                </div>
            </form>
        `;

        const form = document.getElementById('profile-edit-form');
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

        editBtn.addEventListener('click', () => {
            inputs.forEach(input => input.disabled = false);
            buttonsContainer.innerHTML = `
                <button type="submit" class="btn-submit">Save Changes</button>
                <button type="button" id="cancel-edit-btn" class="btn-form">Cancel</button>
            `;

            document.getElementById('cancel-edit-btn').addEventListener('click', () => {
                initializeMyProfilePage();
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(form)) {
                alert("Please fill out all fields correctly.");
                return;
            }

            const file = pictureInput.files[0];
            const updatedData = {
                fullName: form.querySelector('#profile-fullname').value,
                phone: form.querySelector('#profile-phone').value,
                city: form.querySelector('#profile-city').value,
                availability: form.querySelector('#profile-availability').value,
                dob: new Date(form.querySelector('#profile-dob').value),
                bloodType: form.querySelector('#profile-bloodgroup').value,
            };

            if (file) {
                try {
                    const storageRef = ref(storage, `profile-pictures/${user.uid}/${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    updatedData.profilePictureUrl = await getDownloadURL(snapshot.ref);
                } catch (error) {
                    console.error("Error uploading new profile picture:", error);
                    alert("Could not upload new profile picture. Please try again.");
                    return;
                }
            }

            try {
                await updateDoc(donorRef, updatedData);
                alert("Profile updated successfully!");
                await updateUIForLoggedInUser(user);
                initializeMyProfilePage();
            } catch (error) {
                console.error("Error updating profile: ", error);
                alert("Failed to update profile. Please try again.");
            }
        });
    }

    function initializeEmergencyRequestPage() {
        const emergencyForm = document.querySelector('.page-emergency-request form');
        if (!emergencyForm) return;

        emergencyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) {
                alert("You must be logged in to make an emergency request.");
                return;
            }

            const bloodGroup = emergencyForm.querySelector('#bloodgroup').value;
            const city = emergencyForm.querySelector('#city').value;
            const phone = emergencyForm.querySelector('#contact-phone').value;

            if (!bloodGroup || !city || !phone) {
                alert("Please fill out all fields.");
                return;
            }

            const requestData = {
                requesterId: auth.currentUser.uid,
                patientName: 'Emergency',
                bloodType: bloodGroup,
                hospitalName: city,
                city: city.split(',')[1]?.trim() || 'Unknown',
                isEmergency: true,
                status: 'pending',
                createdAt: new Date(),
            };

            await addDoc(collection(db, "requests"), requestData);
            emergencyForm.closest('.form-container').innerHTML = `<div class="form-header"><h3>Alert Sent!</h3></div><div class="info-box"><p><i class="fas fa-check-circle"></i> The emergency alert has been broadcast to all compatible donors in the area.</p></div>`;
        });
    }

    function initializeAdminLoginPage() {
        const adminLoginForm = document.getElementById('admin-login-form');
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = adminLoginForm.querySelector('#admin-email').value;
                const password = adminLoginForm.querySelector('#admin-password').value;
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    const user = auth.currentUser;
                    if (user) {
                        const idTokenResult = await user.getIdTokenResult(true); // Force refresh
                        if (idTokenResult.claims.admin) {
                            loadContent('/admin-panel.html');
                        } else {
                            await signOut(auth);
                            alert('Access Denied. You do not have administrative privileges.');
                        }
                    }
                } catch (error) {
                    console.error("Admin login failed:", error);
                    alert(`Login failed. Please check your credentials.`);
                }
            });
        }
    }

    function initializeLeaderboard() {
        renderLeaderboard();
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

    async function renderLeaderboard() {
        const leaderboardBody = document.getElementById('leaderboard-body');
        if (!leaderboardBody) return;

        leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading leaderboard...</td></tr>`;

        const donorsRef = collection(db, "donors");
        const q = query(donorsRef, orderBy("totalDonations", "desc"), limit(10));

        const querySnapshot = await getDocs(q);
        const donors = querySnapshot.docs.map(doc => doc.data());

        if (donors.length === 0) {
            leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No donor data available yet.</td></tr>`;
            return;
        }

        leaderboardBody.innerHTML = '';

        donors.forEach((donor, index) => {
            const rank = index + 1;
            const prize = rank === 1 ? '$500' : (rank === 2 ? '$250' : (rank === 3 ? '$100' : '---'));
            const rankIcon = rank === 1 ? '<i class="fas fa-trophy rank-gold"></i>' :
                             rank === 2 ? '<i class="fas fa-trophy rank-silver"></i>' :
                             rank === 3 ? '<i class="fas fa-trophy rank-bronze"></i>' : rank;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rankIcon}</td>
                <td>${donor.fullName}</td>
                <td>${donor.city}</td>
                <td>${donor.totalDonations}</td>
                <td>${prize}</td>
            `;
            leaderboardBody.appendChild(row);
        });
    }
