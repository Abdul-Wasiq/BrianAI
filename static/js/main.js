// alert("Working")
const dictate = new Dictate();

// Expose functions to global scope
window.handleSidebarHover = handleSidebarHover;
window.toggleSidebar = toggleSidebar;
window.toggleSidebarSection = toggleSidebarSection;
window.toggleTheme = toggleTheme;
window.sendMessage = sendMessage;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.submitAuth = submitAuth;
window.resendVerification = resendVerification;

// Add these variables with your other global variables at the top

const PROMPT_INTERVAL_SECONDS = 300; // Change this to 300 for 5 minutes after testing.
let guestPromptInterval = null;

// === NEW GUEST PROMPT VARIABLES AND FUNCTIONS ===
// Change this to 300 for 5 minutes after testing
let isGuest = true;

// A new function to handle the guest prompt logic
function handleGuestPrompt() {
  // If the user is a guest, start the repeating timer.
  if (isGuest && !guestPromptInterval) {
    guestPromptInterval = setInterval(() => {
      showNotification("For a better experience, please sign up or log in to save your chat! ✨", "yellow");
      openAuthModal();
    }, PROMPT_INTERVAL_SECONDS * 1000);
  }
}

// Function to stop the repeating timer
function stopGuestPrompt() {
  if (guestPromptInterval) {
    clearInterval(guestPromptInterval);
    guestPromptInterval = null;
  }
}

// === UPDATED auth.onAuthStateChanged LISTENER ===
// This listener now handles starting/stopping the guest prompt timer.
auth.onAuthStateChanged((user) => {
  isGuest = !user; // Update guest status
  updateUserProfileUI(user);

  if (user) {
    console.log("User logged in:", user.email);
    stopGuestPrompt(); // Stop the timer if the user logs in
    if (!user.emailVerified) {
      document.getElementById("resendVerificationContainer").style.display = "block";
      document.getElementById("verificationStatus").style.display = "none";
    } else {
      document.getElementById("verificationStatus").style.display = "block";
      document.getElementById("resendVerificationContainer").style.display = "none";
    }
  } else {
    console.log("No user logged in");
    handleGuestPrompt(); // Start the timer if the user is a guest
    document.getElementById("verificationStatus").style.display = "none";
    document.getElementById("resendVerificationContainer").style.display = "none";
  }
});

// === UPDATED sendMessage() FUNCTION ===
async function sendMessage() {
  // 1) Get user data
    const user = JSON.parse(localStorage.getItem("user"));
    const uid = user?.uid || "guest_user";
    
    // 2) Get and clear input
    const input = document.getElementById("userInput");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    adjustTextareaHeight();

    // 3) Show chat interface if first message
    if (!isChatActive) {
        document.getElementById("welcomeScreen").style.display = "none";
        document.getElementById("chatInterface").style.visibility = "visible";
        document.body.classList.remove("welcome-screen-active");
        isChatActive = true;
        clearTimeout(typeEffectTimeout);
    }

    // 4) Render user message
    const chat = document.getElementById("chat");
    const userMsgContainer = document.createElement("div");
    userMsgContainer.className = "chat-message-container user";
    userMsgContainer.innerHTML = `
        <div class="chat-avatar">You</div>
        <div class="message">${message}</div>
    `;
    chat.appendChild(userMsgContainer);
    chat.scrollTo({
        top: chat.scrollHeight,
        behavior: 'smooth'
    });

    // 5) Render "thinking..." placeholder
    const thinkingMsgContainer = document.createElement("div");
    thinkingMsgContainer.className = "chat-message-container bot";
    thinkingMsgContainer.id = "thinking-message-container";
    thinkingMsgContainer.innerHTML = `
        <div class="chat-avatar">${createBrianAvatarSVG().outerHTML}</div>
        <div class="message">Brian is thinking... <i class="fas fa-spinner fa-spin"></i></div>
    `;
    chat.appendChild(thinkingMsgContainer);
    chat.scrollTo({
        top: chat.scrollHeight,
        behavior: 'smooth'
    });

    try {
        // 6) Prepare payload with proper name handling for Google users
        const sessionId = localStorage.getItem("currentSessionId") || `session_${Date.now()}`;
        const history = await getChatHistory(sessionId, uid);

        // Get the proper display name (handles Google users)
        const displayName = user?.displayName || user?.name || "Friend";

        const payload = {
            message: message,
            history: history,
            user_name: displayName,  // Use the proper display name
            user_data: {
                name: displayName,
                email: user?.email,
                is_google_user: !!user?.providerData?.find(p => p.providerId === 'google.com'),
                full_name: displayName
            }
        };

        // 7) Call Flask /chat endpoint
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        const reply = data.reply;

    // 8) Remove thinking placeholder
    thinkingMsgContainer.remove();

    // 9) Render bot reply wrapper
    const botReplyContainer = document.createElement("div");
    botReplyContainer.className = "chat-message-container bot";
    botReplyContainer.innerHTML = `
      <div class="chat-avatar">${createBrianAvatarSVG().outerHTML}</div>
      <div class="message"></div>
    `;
    chat.appendChild(botReplyContainer);
    const botMessageContent = botReplyContainer.querySelector(".message");

    // 10) Parse & render text/code parts
    const parts = parseReply(reply);
    for (const part of parts) {
      if (part.type === "text") {
        botMessageContent.innerHTML = marked.parse(part.content);
        const ts = document.createElement("div");
        ts.className = "message-timestamp";
        ts.textContent = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        botMessageContent.appendChild(ts);
      } else if (part.type === "code") {
        await createToolOutputBox(chat, part.lang, part.content, botReplyContainer);
      }
    }
    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: 'smooth'
    });

    // 11) Save to Firestore
    if (uid !== "guest_user") {
      if (!localStorage.getItem("currentSessionId")) {
        localStorage.setItem("currentSessionId", sessionId);
        await firebase.firestore()
          .collection("users").doc(uid)
          .collection("sessions").doc(sessionId)
          .set({
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
      }

      await firebase.firestore()
        .collection("users").doc(uid)
        .collection("sessions").doc(sessionId)
        .collection("messages")
        .add({
          question: message,
          answer: reply,
          timestamp: new Date(),
          role: "user"
        });
    }

    console.log("✅ Chat saved under session:", sessionId);

  } catch (err) {
    console.error("Fetch error:", err);
    const errContainer = document.getElementById("thinking-message-container") || (() => {
      const e = document.createElement("div");
      e.className = "chat-message-container bot";
      chat.appendChild(e);
      return e;
    })();
    errContainer.innerHTML = `
      <div class="chat-avatar">${createBrianAvatarSVG().outerHTML}</div>
      <div class="message" style="color:red">Error: ${err.message}</div>
    `;
    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// A new function to check if the user is a guest and start/stop the timer
function checkGuestStatus(user) {
    isGuest = !user;
    if (isGuest) {
        startGuestTimer();
    } else {
        stopGuestTimer();
    }
}

// New functions for the guest prompt box
function showGuestPrompt(message) {
    const box = document.getElementById("guestPromptBox");
    document.getElementById("guestPromptMessage").innerText = message;
    box.style.display = "flex";
}

function hideGuestPrompt() {
    document.getElementById("guestPromptBox").style.display = "none";
}



const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentSessionId = localStorage.getItem("currentSessionId");

// --- New Sidebar Section Toggling Logic ---
// === [SIDEBAR SECTION TOGGLING] === 
let activeSidebarSection = null;

// const isMobile = () => window.innerWidth <= 768;


// Map section IDs to their panel container IDs
const sidebarPanels = {
  profile: 'profileDetailsContainer',
  settings: 'settingsDetailsContainer',
  today: 'todayHistoryList'
};

function toggleSidebarSection(sectionId) {
  // Hide whatever was open before
  hideAllSidebarPanels();

  // If clicking the same section, just reset active and return
  if (activeSidebarSection === sectionId) {
    activeSidebarSection = null;
    return;
  }

  // Otherwise show the new section
  const containerId = sidebarPanels[sectionId];
  const container = document.getElementById(containerId);
  if (!container) return;

  // Show the panel
  container.style.display = 'block';
  activeSidebarSection = sectionId;

  // Special handling for each section
  if (sectionId === 'profile') {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      document.getElementById('profileName').textContent = user.name || 'N/A';
      document.getElementById('profileEmail').textContent = user.email || 'N/A';
      document.getElementById('profilePlan').textContent = user.plan || 'Free';
    }
  } else if (sectionId === 'settings') {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.settings) {
      updateThemeText(user.settings.theme);
      document.getElementById('settingsLanguage').textContent = user.settings.language;
      document.getElementById('settingsVoice').textContent = user.settings.voice;
    }
  }
  // Note: Removed today tab handling from here - it's handled in the click handler
}

function toggleSidebar(sidebarElement) {
    if (!sidebarElement) return;
    sidebarElement.classList.toggle("sidebar-active");
}


async function loadTodayChats() {
  const historyList = document.getElementById('todayHistoryList');
  if (!historyList) return;

  // Skip if already loading
  if (historyList.dataset.loading === 'true') return;
  historyList.dataset.loading = 'true';
  historyList.innerHTML = "Loading...";

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      historyList.innerHTML = "<p style='color: red;'>Please log in first.</p>";
      return;
    }

    const snapshot = await firebase.firestore()
      .collection("users").doc(user.uid)
      .collection("sessions")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    historyList.innerHTML = "";
    
    if (snapshot.empty) {
      historyList.innerHTML = "<p>No chat history found</p>";
      return;
    }

    snapshot.forEach(doc => {
      // ... existing session item creation code ...
    });
  } catch (err) {
    console.error("Error loading chat history:", err);
    historyList.innerHTML = "<p style='color: red;'>Failed to load chats.</p>";
  } finally {
    historyList.dataset.loading = 'false';
  }
}


function hideAllSidebarPanels() {
  // Hide every mapped panel
  Object.values(sidebarPanels).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}


//  === [LOGIN/SIGN UP] === 
// Update the updateUserProfileUI function to load profile and settings data
// and ensure the correct sections are populated.
function updateUserProfileUI(user) {
    if (user) {
        // User is logged in
        const displayName = user.displayName || (user.providerData?.find(p => p.providerId === 'google.com')?.displayName || user.email.split('@')[0]);
        
        document.getElementById("profileName").textContent = displayName;
        document.getElementById("profileEmail").textContent = user.email;
        document.querySelector(".profile-picture").src = user.photoURL || '/static/default_profile.png';
        document.getElementById("greeting").textContent = `Hi ${displayName}!`;
        
        // Update verification status
        if (user.emailVerified) {
            document.getElementById("verificationStatus").style.display = "block";
            document.getElementById("resendVerificationContainer").style.display = "none";
        } else {
            document.getElementById("resendVerificationContainer").style.display = "block";
            document.getElementById("verificationStatus").style.display = "none";
        }
    } else {
        // User is logged out
        document.getElementById("profileName").textContent = "Guest";
        document.getElementById("profileEmail").textContent = "Not Logged In";
        document.querySelector(".profile-picture").src = 'https://via.placeholder.com/60';
        document.getElementById("greeting").textContent = "Hi there!";
        document.getElementById("verificationStatus").style.display = "none";
        document.getElementById("resendVerificationContainer").style.display = "none";
    }
  }

/*Changes here end I changed auth.onAuth and updateUserProfileUI(user)*/
    // login box
    let isSignup = false;

function openAuthModal() {
  document.getElementById("authModal").style.display = "flex";
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
}

function toggleAuthMode() {
  isSignup = !isSignup;
  const title = document.getElementById("authTitle");
  const toggle = document.querySelector(".toggle-auth a");
  const nameGroup = document.getElementById("nameGroup");

  if (isSignup) {
    title.textContent = "Create Account";
    toggle.textContent = "Already have an account? Login";
    nameGroup.style.display = "block";
  } else {
    title.textContent = "Login";
    toggle.textContent = "Don't have an account? Create one";
    nameGroup.style.display = "none";
  }
}

function showNotification(message, type = "success") {
    const notificationBox = document.getElementById("notificationBox");
    const notificationMessage = document.getElementById("notificationMessage");

    // Remove any previous type classes
    notificationBox.classList.remove('success', 'warning', 'error');

    // Add the new type class
    notificationBox.classList.add(type);
    
    notificationMessage.textContent = message;
    notificationBox.style.transform = "translateY(0)"; // Slide in
    setTimeout(() => {
        hideNotification();
    }, 5000); // Hide after 5 seconds
}

function hideNotification() {
  const box = document.getElementById("notificationBox");
  box.style.transform = "translateY(-100px)"; // This will smoothly slide the box out of view
}

/* new changes start */
// Change this function to send the verification email
function sendVerificationEmail(user) {
    user.sendEmailVerification().then(() => {
        // showNotification(`Verification email sent to ${email}. Please check your inbox.`, "warning");
        showNotification(`You can login now as ${email}`, "success");
    }).catch((error) => {
        console.error("Error sending verification email:", error);
        showNotification("Failed to send verification email. Please try again.", "red");
    });
}

// Update the resendVerification function to call the new one
function resendVerification() {
    const user = auth.currentUser;
    if (user) {
        user.sendEmailVerification().then(() => {
            // showNotification("Verification email sent! Please check your inbox.", "warning"); // Yellow for warning
           showNotification("You can login now", "success");
          }).catch((error) => {
            console.error("Error sending verification email:", error);
            showNotification("Failed to send verification email. Please try again.", "error"); // Red for error
        });
    } else {
        showNotification("No user logged in to resend verification to.", "error"); // Red for error
    }
}
/* new changes end */

// new changes here
// Update the Google sign-in function
function signInWithGoogle() {
    firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
        const user = result.user;
        console.log("Google user signed in:", user);
        
        // Store complete user data including display name
        const userData = {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            uid: user.uid,
            verified: user.emailVerified,
            settings: { theme: "light" },
            isGoogleUser: true  // Add this flag
        };
        localStorage.setItem("user", JSON.stringify(userData));
        
        updateUserProfileUI(user);
        closeAuthModal();
        showNotification(`Welcome, ${user.displayName || user.email}! 😊`, "success");
    })
    .catch((error) => {
        console.error("Google sign-in error:", error);
        showNotification("Failed to sign in with Google. Please try again.", "error");
    });
}

async function submitAuth() {
    const name = document.getElementById("authName").value;
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (!email || !password || (isSignup && !name)) {
        showNotification("Please fill all required fields.", "error");
        return;
    }

    try {
        // main.js
if (isSignup) {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Add these lines RIGHT AFTER user creation:
    await user.updateProfile({
        displayName: name  // Set the user's name immediately
    });

    // Update UI and localStorage BEFORE showing notification
    updateUserProfileUI({
        displayName: name,
        email: email,
        uid: user.uid
    });
    
    localStorage.setItem("user", JSON.stringify({
        name: name,
        email: email,
        uid: user.uid,
        verified: false,
        settings: { theme: "light" }
    }));

    // Then send verification email
    fetch("/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
    });

    showNotification(`You can login now as ${email}`, "success");
    toggleAuthMode(); // Switch to login view
} else {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Add these lines RIGHT AFTER login:
    updateUserProfileUI({
        displayName: user.displayName || name || "User", // Fallback chain
        email: user.email,
        uid: user.uid
    });

    localStorage.setItem("user", JSON.stringify({
        name: user.displayName || name || "User",
        email: user.email,
        uid: user.uid,
        verified: true,
        settings: { theme: "light" }
    }));

    closeAuthModal();
    showNotification("Login successful! Welcome back. 😊", "success");
}
    } catch (error) {
        console.error("Auth error:", error);
        showNotification(formatFirebaseError(error), "error");
    }
}

function checkEmailVerification(user) {
  if (user && user.emailVerified) {
    document.getElementById("verificationStatus").style.display = "block";
    document.getElementById("resendVerificationContainer").style.display = "none";
  } else if (user && !user.emailVerified) {
    document.getElementById("resendVerificationContainer").style.display = "block";
    document.getElementById("verificationStatus").style.display = "none";
  } else {
    // For a logged-out state, hide both
    document.getElementById("resendVerificationContainer").style.display = "none";
    document.getElementById("verificationStatus").style.display = "none";
  }
}

function formatFirebaseError(error) {
    switch (error.code) {
        case "auth/email-already-in-use":
            return "Email already in use. Please login instead.";
        case "auth/requires-recent-login":
            return "Session expired. Please login again.";
        case "auth/user-not-found":
            return "Email not found. Please sign up first.";
        case "auth/wrong-password":
            return "Incorrect password.";
        case "auth/too-many-requests":
            return "Too many attempts. Try again later.";
        case "auth/email-not-verified":
            return "Please verify your email first.";
        case "auth/invalid-email":
            return "The email address is badly formatted.";
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        default:
            return error.message;
    }
}

// Add this to your formatFirebaseError function
function formatFirebaseError(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "Email already in use. Please login instead.";
    case "auth/requires-recent-login":
      return "Session expired. Please login again.";
    case "auth/user-not-found":
      return "Email not found. Please sign up first.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/email-not-verified":
      return "Please verify your email first.";
    default:
      return error.message;
  }
}



function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  document.getElementById("sun-icon").style.display = isDark ? "none" : "inline-block";
  document.getElementById("moon-icon").style.display = isDark ? "inline-block" : "none";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


document.addEventListener("DOMContentLoaded", function() {
  // Apply theme
  const savedTheme = localStorage.getItem("theme") || "light";
  const isDark = savedTheme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  document.getElementById("sun-icon").style.display = isDark ? "none" : "block";
  document.getElementById("moon-icon").style.display = isDark ? "block" : "none";
  updateThemeText(savedTheme);

  // Initialize UI
  adjustTextareaHeight();
  const mainSidebar = document.getElementById("mainSidebar");
  const historySidebar = document.getElementById("historySidebar");
  mainSidebar.classList.remove("expanded", "locked");
  historySidebar.classList.remove("expanded", "locked");
  document.body.classList.add("main-sidebar-collapsed", "history-sidebar-collapsed");

  // Show welcome screen
  document.getElementById("welcomeScreen").style.display = "flex";
  document.getElementById("chatInterface").style.display = "flex";
  document.getElementById("chatInterface").style.visibility = "hidden";
  document.body.classList.add("welcome-screen-active");
  startTypeEffect();

  // Check auth state
  const user = JSON.parse(localStorage.getItem("user"));
  updateUserProfileUI(user);
  
  // Set up logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function(e) {
      e.preventDefault();
      auth.signOut().then(() => {
        localStorage.removeItem("user");
        location.reload();
      });
    });
  }

  // Show auth modal if no user
  setTimeout(() => {
    if (!user) {
      openAuthModal();
    }
  }, 100);
// --- DICTATE(Control when clicked on button then run the functions which we made in bottom) ---
    // Listen for clicks on the show text button
    const showTextBtn = document.getElementById('dictation-show-text-btn');
    if (showTextBtn) {
        showTextBtn.addEventListener('click', showTextDictation);
    }

    const sendBtn = document.getElementById('dictation-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
      sendDictation();
    });
}

    const stopBtn = document.getElementById('dictation-close-btn');
    if (stopBtn) {
     stopBtn.addEventListener('click', () => {
     stopDictation();
  });
}

// --- END OF DICTATE SETUP ---

});

function updateThemeText(newTheme) {
    const settingsThemeEl = document.getElementById("settingsTheme");
    if (settingsThemeEl) {
        const theme = newTheme || localStorage.getItem("theme") || "light";
        settingsThemeEl.textContent = theme === "dark" ? "Dark" : "Light";
    }
}


 // === END LOGIN/SIGN UP CODE ===

    // --- Global Variables ---
    let isChatActive = false; // Flag to track if chat interface is active

    //   === [LIGHT AND DARK MODE - STARTING] === 
    // --- Theme Toggle ---
function toggleTheme() {
    const isDarkMode = document.body.classList.toggle("dark-mode");
    const newTheme = isDarkMode ? "dark" : "light";

    // ✅ Save to both theme key and user.settings.theme
    localStorage.setItem("theme", newTheme);

    let user = JSON.parse(localStorage.getItem("user"));
    if (user && user.settings) {
        user.settings.theme = newTheme;
        localStorage.setItem("user", JSON.stringify(user));
    }

    // ✅ Update backend
    if (user && user.email) {
        fetch("http://127.0.0.1:5000/update-theme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, theme: newTheme })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Theme updated in backend:", data);
        })
        .catch(err => console.error("Failed to update theme:", err));
    }

    // ✅ Update text safely
    updateThemeText(newTheme);

    // ✅ Update icons
    document.getElementById("sun-icon").style.display = isDarkMode ? "none" : "block";
    document.getElementById("moon-icon").style.display = isDarkMode ? "block" : "none";

    // ✅ Re-render avatars
    document.querySelectorAll('.bot .chat-avatar').forEach(avatarDiv => {
        while (avatarDiv.firstChild) avatarDiv.removeChild(avatarDiv.firstChild);
        avatarDiv.appendChild(createBrianAvatarSVG());
    });
}

// Make sure isMobile is properly defined (add this if not already in your code)
function isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}


// Add this at the top of your file (if not already present)
const mobile = isMobile(); // Make sure isMobile() is properly defined

// Updated toggleSidebar function
// Unified toggleSidebar function
function toggleSidebar(sidebarElement) {
    if (!sidebarElement) return;
    
    const isOpening = !sidebarElement.classList.contains('sidebar-active');
    const overlay = document.querySelector('.sidebar-overlay');
    
    // Close all sidebars first
    document.querySelectorAll('.sidebar-base').forEach(sidebar => {
        sidebar.classList.remove('sidebar-active');
    });
    
    // Toggle the clicked sidebar
    if (isOpening) {
        sidebarElement.classList.add('sidebar-active');
        if (overlay) overlay.style.display = 'block';
        
        // Add this to prevent text from disappearing
        sidebarElement.addEventListener('mouseleave', function onMouseLeave() {
            // Keep text visible even when mouse leaves
            sidebarElement.removeEventListener('mouseleave', onMouseLeave);
        });
    } else {
        if (overlay) overlay.style.display = 'none';
    }
    
    // Desktop behavior
    const isExpanding = !sidebarElement.classList.contains('expanded');
    
    // Toggle sidebar state
    sidebarElement.classList.toggle('expanded', isExpanding);
    sidebarElement.classList.toggle('locked', isExpanding);

    // Update body classes
    if (sidebarElement.id === 'mainSidebar') {
        document.body.classList.toggle('main-sidebar-collapsed', !isExpanding);
    } else if (sidebarElement.id === 'historySidebar') {
        document.body.classList.toggle('history-sidebar-collapsed', !isExpanding);
    }

    // When closing sidebar, hide tab contents
    if (!isExpanding) {
        const tabContents = sidebarElement.querySelectorAll(".sidebar-panel, .tab-content, .chat-history-list");
        tabContents.forEach(content => {
            content.style.display = 'none';
        });
        activeSidebarSection = null;
        if (sidebarElement.id === 'historySidebar') {
            document.getElementById('todayHistoryList').innerHTML = '';
        }
    }
}

// Initialize overlay (put this in your DOMContentLoaded event)
function initSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function() {
        document.querySelectorAll('.sidebar-base.sidebar-active').forEach(sidebar => {
            sidebar.classList.remove('sidebar-active');
        });
        overlay.style.display = 'none';
    });
    
    document.addEventListener('click', function(e) {
        const isSidebar = e.target.closest('.sidebar-base');
        const isHamburger = e.target.closest('.hamburger-left, .hamburger-right');
        
        if (!isSidebar && !isHamburger) {
            document.querySelectorAll('.sidebar-base.sidebar-active').forEach(sidebar => {
                sidebar.classList.remove('sidebar-active');
            });
            overlay.style.display = 'none';
        }
    });
}


// Add to your main.js or script section
document.addEventListener('DOMContentLoaded', function() {
  initSidebarOverlay();
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    
    // Close sidebar when clicking overlay
    overlay.addEventListener('click', function() {
        document.querySelectorAll('.sidebar-base.sidebar-active').forEach(sidebar => {
            sidebar.classList.remove('sidebar-active');
        });
        overlay.style.display = 'none';
    });
    
    // Close sidebar when clicking anywhere else
    document.addEventListener('click', function(e) {
        const isSidebar = e.target.closest('.sidebar-base');
        const isHamburger = e.target.closest('.hamburger-left, .hamburger-right');
        
        if (!isSidebar && !isHamburger) {
            document.querySelectorAll('.sidebar-base.sidebar-active').forEach(sidebar => {
                sidebar.classList.remove('sidebar-active');
            });
            overlay.style.display = 'none';
        }
    });
    
    // Update your toggleSidebar function to handle overlay
    function toggleSidebar(sidebar) {
        const isActive = sidebar.classList.contains('sidebar-active');
        
        // Close all sidebars first
        document.querySelectorAll('.sidebar-base').forEach(s => {
            s.classList.remove('sidebar-active');
        });
        
        // Toggle the clicked sidebar
        if (!isActive) {
            sidebar.classList.add('sidebar-active');
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    }
});



  // Updated handleSidebarHover function
function handleSidebarHover(sidebarElement, isHovering) {
  // Ignore hover events on mobile
  if (isMobile()) {
    return;
  }
  
  // Only proceed if sidebar isn't locked (user hasn't explicitly toggled it)
  if (!sidebarElement.classList.contains('locked')) {
    if (isHovering) {
      if (!sidebarElement.classList.contains("expanded")) {
        sidebarElement.classList.add("expanded");
        if (sidebarElement.id === 'mainSidebar') {
          document.body.classList.remove("main-sidebar-collapsed");
        } else if (sidebarElement.id === 'historySidebar') {
          document.body.classList.remove("history-sidebar-collapsed");
        }
      }
    } else {
      // Only auto-close if not locked
      if (!sidebarElement.classList.contains('locked')) {
        sidebarElement.classList.remove("expanded");
        if (sidebarElement.id === 'mainSidebar') {
          document.body.classList.add("main-sidebar-collapsed");
        } else if (sidebarElement.id === 'historySidebar') {
          document.body.classList.add("history-sidebar-collapsed");
        }
        
        // Also hide any open panels
        const tabContents = sidebarElement.querySelectorAll(".sidebar-panel, .tab-content, .chat-history-list");
        tabContents.forEach(content => {
          content.style.display = 'none';
        });
        activeSidebarSection = null;
      }
    }
  }
}


// Textarea Auto-Resize Logic (unchanged)
const userInputTextarea = document.getElementById("userInput");
userInputTextarea.addEventListener("input", adjustTextareaHeight);

function adjustTextareaHeight() {
    userInputTextarea.style.height = 'auto';
    userInputTextarea.style.height = userInputTextarea.scrollHeight + 'px';
}


    // --- Typing Animation on greeting Logic ===
    const phrases = [
    "So… what’s the move?",
    "You want something. Name it.",
    "Every answer starts with a question."
];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingSpeed = 70; // typing speed in ms
    const deletingSpeed = 40; // deleting speed in ms
    const pauseTime = 1500; // pause before deleting/typing next phrase in ms
    let typeEffectTimeout;

    function typeEffect() {
        const currentPhrase = phrases[phraseIndex];
        const animatedTextElement = document.getElementById("animatedText");

        if (isDeleting) {
            animatedTextElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            if (charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                typeEffectTimeout = setTimeout(typeEffect, pauseTime);
            } else {
                typeEffectTimeout = setTimeout(typeEffect, deletingSpeed);
            }
        } else {
            animatedTextElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            if (charIndex === currentPhrase.length) {
                isDeleting = true;
                typeEffectTimeout = setTimeout(typeEffect, pauseTime);
            } else {
                typeEffectTimeout = setTimeout(typeEffect, typingSpeed);
            }
        }
    }

    function startTypeEffect() {
        // Clear any existing timeout to prevent multiple animations running
        if (typeEffectTimeout) {
            clearTimeout(typeEffectTimeout);
        }
        typeEffect();
    }


    // --- Brian AI Logo SVG Generation Function === 
    function createBrianAvatarSVG() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");

        // Generate a unique ID for the gradient for each avatar instance
        const gradientId = "gradientActive-" + Math.random().toString(36).substr(2, 9);

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const linearGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        linearGradient.setAttribute("id", gradientId);
        linearGradient.setAttribute("x1", "0%");
        linearGradient.setAttribute("y1", "0%");
        linearGradient.setAttribute("x2", "100%");
        linearGradient.setAttribute("y2", "0%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("style", "stop-color:#3f51b5;stop-opacity:1"); // Fixed blue
        linearGradient.appendChild(stop1);

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("style", "stop-color:#a0c4ff;stop-opacity:1"); // Fixed light blue
        linearGradient.appendChild(stop2);

        defs.appendChild(linearGradient);
        svg.appendChild(defs);

        // Outer spinning ring (uses the unique gradient)
        const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path1.setAttribute("class", "spin-element"); // Applies the spin animation
        path1.setAttribute("fill", `url(#${gradientId})`);
        path1.setAttribute("d", "M50,10 C27.9,10 10,27.9 10,50 C10,72.1 27.9,90 50,90 C72.1,90 90,72.1 90,50 C90,27.9 72.1,10 50,10 Z M50,14 C69.9,14 86,30.1 86,50 C86,69.9 69.9,86 50,86 C30.1,86 14,69.9 14,50 C14,30.1 30.1,14 50,14 Z");
        svg.appendChild(path1);

        // Get computed style for dynamic colors (for inner elements)
        const rootStyles = getComputedStyle(document.documentElement);
        const logoColor = rootStyles.getPropertyValue('--logo-color');

        // Diamond shape (use computed --logo-color)
        const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path3.setAttribute("fill", logoColor);
        path3.setAttribute("d", "M50 40 L65 50 L50 60 L35 50 Z");
        svg.appendChild(path3);

        return svg;
    }


    // --- Message Parsing and Display ===
    function parseReply(reply) {
        const codeBlockRegex = /```(javascript|js|html)?\n?([\s\S]*?)```/g;
        let lastIndex = 0;
        const parts = [];

        let match;
        while ((match = codeBlockRegex.exec(reply)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: "text", content: reply.slice(lastIndex, match.index) });
            }
            parts.push({ type: "code", lang: match[1], content: match[2].trim() });
            lastIndex = codeBlockRegex.lastIndex;
        }
        if (lastIndex < reply.length) {
            parts.push({ type: "text", content: reply.slice(lastIndex) });
        }
        return parts;
    }

// Add this new helper function right after sendMessage()
async function getChatHistory(sessionId, uid) {
  if (!sessionId || !uid) return [];
  
  try {
    const snapshot = await firebase.firestore()
      .collection("users").doc(uid)
      .collection("sessions").doc(sessionId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        role: data.role || "user",
        content: data.question || data.answer || ""
      };
    });
  } catch (err) {
    console.error("Error loading history:", err);
    return [];
  }
}

// typing animation effect ===
    function typeText(container, text) {
        return new Promise((resolve) => {
            let i = 0;
            const interval = setInterval(() => {
                if (i < text.length) {
                    const char = text.charAt(i);
                    if (char === '<') {
                        const nextGt = text.indexOf('>', i);
                        if (nextGt !== -1) {
                            const tag = text.substring(i, nextGt + 1);
                            container.innerHTML += tag;
                            i = nextGt;
                        }
                    } else {
                        container.innerHTML += char;
                    }
                    i++;
                } else {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });
    }
    

    // CODE,OUTPUT,PREVIEW, (No changes to this section unless specified) ===
async function createToolOutputBox(parentChatContainer, lang, content, precedingElement) {
    const container = document.createElement("div");
    container.className = "tool-output-container";

    const header = document.createElement("div");
    header.className = "tool-output-header";
    container.appendChild(header);

    const tabs = document.createElement("div");
    tabs.className = "tool-output-tabs";
    header.appendChild(tabs);

    const codeButton = document.createElement("button");
    codeButton.textContent = "Code";
    codeButton.onclick = () => showToolOutputTab(container, 'code');
    tabs.appendChild(codeButton);

    const outputButton = document.createElement("button");
    outputButton.textContent = "Output";
    outputButton.onclick = () => showToolOutputTab(container, 'output');
    tabs.appendChild(outputButton);

    let previewButton;
    if (lang === "html") {
        previewButton = document.createElement("button");
        previewButton.textContent = "Preview";
        previewButton.onclick = () => showToolOutputTab(container, 'preview');
        tabs.appendChild(previewButton);
    }

    // === ✅ Fullscreen Button ===
    const fullscreenToggle = document.createElement("button");
    fullscreenToggle.className = "tool-output-fullscreen-toggle";
    fullscreenToggle.innerHTML = '<i class="fas fa-expand-alt"></i>';
    fullscreenToggle.onclick = () => toggleFullscreen(container);

    // === ✅ Copy Button ===
    const copyButton = document.createElement("button");
    // copyButton.className = "tool-output-copy-button";
    copyButton.className = "tool-output-copy-button"; // same class as fullscreen
    copyButton.style.display = "none"; // Only show in Code tab
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.onclick = () => {
        const code = codeContent.querySelector('pre').innerText;
        navigator.clipboard.writeText(code)
            .then(() => {
                copyButton.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => copyButton.innerHTML = '<i class="fas fa-copy"></i>', 1200);
            });
    };

    // === ✅ Right Side Button Container (holds fullscreen + copy buttons)
    const rightButtons = document.createElement("div");
    rightButtons.style.display = "flex";
    rightButtons.style.alignItems = "center";
    rightButtons.appendChild(fullscreenToggle);
    rightButtons.appendChild(copyButton);
    header.appendChild(rightButtons);

    const codeContent = document.createElement("div");
    codeContent.className = "tool-output-content code-view";
    codeContent.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
    container.appendChild(codeContent);

    const outputContent = document.createElement("div");
    outputContent.className = "tool-output-content output-view";
    outputContent.innerHTML = `<pre></pre>`;
    container.appendChild(outputContent);

    let previewIframe;
    if (lang === "html") {
        const previewContent = document.createElement("div");
        previewContent.className = "tool-output-content preview-view";
        previewIframe = document.createElement("iframe");
        previewContent.appendChild(previewIframe);
        container.appendChild(previewContent);
    }

    parentChatContainer.insertBefore(container, precedingElement.nextSibling);

    let activeTab = 'code';
    if (lang === 'html') {
        activeTab = 'preview';
    } else if (lang === 'javascript' || lang === 'js') {
        activeTab = 'output';
    }
    showToolOutputTab(container, activeTab);

    if (lang === "html" && previewIframe) {
        requestAnimationFrame(() => {
            const doc = previewIframe.contentDocument || previewIframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();
        });
    } else if (lang === "javascript" || lang === "js") {
        let output = "";
        const originalLog = console.log;
        console.log = (msg) => output += msg + "\n";

        try {
            const script = document.createElement('script');
            script.textContent = content;
            document.body.appendChild(script);
            document.body.removeChild(script);

            outputContent.querySelector('pre').innerText = output || "✅ Code ran successfully.";
        } catch (err) {
            outputContent.querySelector('pre').innerText = `❌ Error: ${err.message}`;
            console.error("Code Execution Error:", err);
        } finally {
            console.log = originalLog;
        }
    } 
}


    function showToolOutputTab(container, tabName) {
        const buttons = container.querySelectorAll(".tool-output-tabs button");
        buttons.forEach(btn => {
            btn.classList.remove("active");
            btn.style.color = '';
        });

        const contents = container.querySelectorAll(".tool-output-content");
        contents.forEach(content => content.classList.remove("active"));

        let targetButton, targetContent;

        if (tabName === 'code') {
            targetButton = container.querySelector(".tool-output-tabs button:nth-child(1)");
            targetContent = container.querySelector(".tool-output-content.code-view");
        } else if (tabName === 'output') {
            targetButton = container.querySelector(".tool-output-tabs button:nth-child(2)");
            targetContent = container.querySelector(".tool-output-content.output-view");
        } else if (tabName === 'preview') {
            targetButton = container.querySelector(".tool-output-tabs button:nth-child(3)");
            targetContent = container.querySelector(".tool-output-content.preview-view");
        }

        if (targetButton) {
            targetButton.classList.add("active");
            targetButton.style.color = 'var(--button-bg)';
            if (document.body.classList.contains("dark-mode")) {
                 targetButton.style.color = 'var(--highlight-color)';
            }
        }
        if (targetContent) {
            targetContent.classList.add("active");
        }
        const copyBtn = container.querySelector(".tool-output-copy-button");
        if (copyBtn) {
         copyBtn.style.display = tabName === "code" ? "inline-block" : "none";
        }


    }
// GET FULL SCREEN ===
    function toggleFullscreen(container) {
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
            container.classList.add("fullscreen");
            container.querySelector(".tool-output-fullscreen-toggle i").className = "fas fa-compress-alt";
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            container.classList.remove("fullscreen");
            container.querySelector(".tool-output-fullscreen-toggle i").className = "fas fa-expand-alt";
        }
    }
// remove &, >,< etc from code ===
    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
// SEND MESSAGE by clicking on Enter ===
    // With this updated version:
userInputTextarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        // On mobile, we want Enter to create new lines by default
        if (isMobile()) {
            // Only send message if it's a plain Enter (no Shift)
            if (!e.shiftKey) {
                // Check if the textarea has content before sending
                if (userInputTextarea.value.trim()) {
                    e.preventDefault();
                    sendMessage();
                }
            }
        } 
        // On desktop, maintain current behavior
        else {
            if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }
    }
});


    // --- Input Area Fullscreen Toggle ---
    function toggleInputFullscreen() {
        const inputArea = document.getElementById("input-area");
        const fullscreenIcon = document.getElementById("fullscreen-icon");

        inputArea.classList.toggle("fullscreen");
        document.body.classList.toggle("no-scroll", inputArea.classList.contains("fullscreen")); // Optional: prevent body scroll

        if (inputArea.classList.contains("fullscreen")) {
            fullscreenIcon.className = "fas fa-compress-alt";
        } else {
            fullscreenIcon.className = "fas fa-expand-alt";
        }
        adjustTextareaHeight(); // Re-adjust height in new size
        userInputTextarea.focus(); // Keep focus on the textarea 
    }


  function hideAllSidebarPanels() {
  const panels = document.querySelectorAll(".sidebar-panel");
  panels.forEach(panel => {
    panel.style.display = "none";
  });
}

function hideAllSidebarPanels() {
  document.getElementById('profileDetailsContainer').style.display = 'none';
  document.getElementById('settingsDetailsContainer').style.display = 'none';
}

// Sync login/logout across tabs
window.addEventListener("storage", function (event) {
  if (event.key === "user") {
    const currentUser = localStorage.getItem("user");

    if (!currentUser) {
      // User logged out in another tab
      console.log("Detected logout from another tab.");
      location.reload(); // Or redirect to login
    } else {
      // User logged in from another tab
      console.log("Detected login from another tab.");
      location.reload(); // Refresh UI
    }
  }
});

function addCopyButtons() {
    document.querySelectorAll("pre code").forEach((codeBlock) => {
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-container";

        const pre = codeBlock.parentNode;
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const button = document.createElement("button");
        button.className = "copy-btn";
        button.textContent = "Copy";

        button.addEventListener("click", () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                button.textContent = "Copied!";
                setTimeout(() => (button.textContent = "Copy"), 1500);
            });
        });

        wrapper.appendChild(button);
    });
}


// === [LOAD TODAY'S CHAT HISTORY] ===
let isTodayTabLoading = false;

document.getElementById("todayTab").addEventListener("click", async (e) => {
  e.preventDefault();
  
  // First handle the tab toggle
  toggleSidebarSection('today');
  
  // Then load the chats if not already loading
  if (isTodayTabLoading) return;
  isTodayTabLoading = true;

  const historyList = document.getElementById("todayHistoryList");
  if (!historyList) {
    isTodayTabLoading = false;
    return;
  }

  historyList.innerHTML = "Loading...";

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      historyList.innerHTML = "<p style='color: red;'>Please log in first.</p>";
      isTodayTabLoading = false;
      return;
    }

    const snapshot = await firebase.firestore()
      .collection("users").doc(user.uid)
      .collection("sessions")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    historyList.innerHTML = ""; // Clear loading message
    
    if (snapshot.empty) {
      historyList.innerHTML = "<p>No chat history found</p>";
      return;
    }

    snapshot.forEach(doc => {
      const sessionId = doc.id;
      const createdTs = doc.data().createdAt;
      const created = createdTs
        ? createdTs.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "—";

      const item = document.createElement("div");
      item.className = "chat-history-item";
      item.textContent = `Session @ ${created}`;

      item.addEventListener("click", async () => {
        if (window._isChatLoading) return;
        window._isChatLoading = true;
        document.getElementById("chatInterface").style.visibility = "visible";
        document.body.classList.remove("welcome-screen-active");
        try {
          await loadChatSession(sessionId);
        } finally {
          window._isChatLoading = false;
        }
      });

      const del = document.createElement("button");
      del.className = "delete-chat-btn";
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await firebase.firestore()
          .collection("users").doc(user.uid)
          .collection("sessions").doc(sessionId)
          .delete();
        item.remove();
      });

      item.appendChild(del);
      historyList.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading chat history:", err);
    historyList.innerHTML = "<p style='color: red;'>Failed to load chats.</p>";
  } finally {
    isTodayTabLoading = false;
  }
});


// === [RESTORE CHAT TO MAIN WINDOW] ===
function restoreChatToScreen(question, answer) {
  const chat = document.getElementById("chat");
  chat.innerHTML = ""; // Clear old chat

  const userMsgContainer = document.createElement("div");
  userMsgContainer.className = "chat-message-container user";
  userMsgContainer.innerHTML = `
    <div class="chat-avatar">You</div>
    <div class="message">${question}</div>
  `;
  chat.appendChild(userMsgContainer);

  const botReplyContainer = document.createElement("div");
  botReplyContainer.className = "chat-message-container bot";
  botReplyContainer.innerHTML = `
    <div class="chat-avatar">${createBrianAvatarSVG().outerHTML}</div>
    <div class="message">${marked.parse(answer)}</div>
  `;
  chat.appendChild(botReplyContainer);

  chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
}

async function loadChatSession(sessionId) {
  const chat = document.getElementById("chat");
  if (!chat) return;

  // 1. HIDE WELCOME SCREEN IMMEDIATELY
  document.getElementById("welcomeScreen").style.display = "none";
  document.getElementById("chatInterface").style.visibility = "visible";
  document.body.classList.remove("welcome-screen-active");

  // 2. Clear any existing content (including welcome message)
  chat.innerHTML = "";

  // 3. Show loading state
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "loading-msg";
  loadingMsg.textContent = "Loading chat...";
  chat.appendChild(loadingMsg);

  localStorage.setItem("currentSessionId", sessionId);

  // Show chat interface if hidden
  document.getElementById("chatInterface").style.visibility = "visible";
  document.body.classList.remove("welcome-screen-active");


  const uid = firebase.auth().currentUser?.uid;
  if (!uid || !sessionId) return;

  try {
    const messagesRef = firebase.firestore()
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .orderBy("timestamp", "asc");

    const snapshot = await messagesRef.get();

    // Clear loading message before rendering
    chat.innerHTML = "";

    if (snapshot.empty) {
      chat.innerHTML = `<div class="empty-msg">No messages found for this session.</div>`;
      return;
    }

    snapshot.forEach(doc => {
      const { question, answer } = doc.data();

      // === User Message
      const userMsgContainer = document.createElement("div");
      userMsgContainer.className = "chat-message-container user";

      const userAvatar = document.createElement("div");
      userAvatar.className = "chat-avatar";
      userAvatar.textContent = "You";
      userMsgContainer.appendChild(userAvatar);

      const userMsg = document.createElement("div");
      userMsg.className = "message";
      userMsg.innerHTML = question || "";
      userMsgContainer.appendChild(userMsg);
      chat.appendChild(userMsgContainer);

      // === Brian's Reply
      const botReplyContainer = document.createElement("div");
      botReplyContainer.className = "chat-message-container bot";

      const botAvatar = document.createElement("div");
      botAvatar.className = "chat-avatar";
      botAvatar.appendChild(createBrianAvatarSVG());
      botReplyContainer.appendChild(botAvatar);

      const botMsg = document.createElement("div");
      botMsg.className = "message";
      botMsg.innerHTML = marked.parse(answer || "");
      botReplyContainer.appendChild(botMsg);

      chat.appendChild(botReplyContainer);
    });

    // Auto-scroll to bottom
    chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });

  } catch (error) {
    console.error("Error loading chat session:", error);
    chat.innerHTML = `<div class="error-msg">Failed to load chat history.</div>`;
  }
}


async function startNewChat() {
  // 0) Close both sidebars (mobile + desktop)
  const mainSidebar = document.getElementById("mainSidebar");
  const historySidebar = document.getElementById("historySidebar");
  const overlay = document.querySelector(".sidebar-overlay");

  // Mobile: Remove 'sidebar-active' class and hide overlay
  mainSidebar.classList.remove("sidebar-active");
  historySidebar.classList.remove("sidebar-active");
  if (overlay) overlay.style.display = "none";

  // Desktop: Collapse sidebars
  mainSidebar.classList.remove("expanded", "locked");
  historySidebar.classList.remove("expanded", "locked");
  document.body.classList.add("main-sidebar-collapsed", "history-sidebar-collapsed");

  // 1) Reset chat session
  await fetch("/reset-context", { method: "POST" });
  localStorage.removeItem("currentSessionId");

  // 2) Clear chat UI
  document.getElementById("chat").innerHTML = "";
  document.getElementById("userInput").value = "";
  isChatActive = false;

  // 3) Show welcome screen
  document.getElementById("welcomeScreen").style.display = "flex";
  document.getElementById("chatInterface").style.visibility = "hidden";
  document.body.classList.add("welcome-screen-active");
  startTypeEffect();

  // 4) Focus input (now visible since sidebars are closed)
  document.getElementById("userInput").focus();
}

        // === [PHASE 1] === 
document.querySelectorAll('.input-action-button').forEach(button => {
  button.addEventListener('click', function(e) {
    e.preventDefault();

    // Check if the clicked button is our dictate button
    if (this.classList.contains('dictate-button')) {
      // If it is, call our new function and STOP the rest of the code from running
      handleDictateButtonClick();
      return; // This exits the function early
    }

    // The code below will only run for non-dictate buttons (video and desktop)
    const icon = this.querySelector('i');
    const originalIcon = icon.className;

    // Show loading state
    icon.className = 'fas fa-spinner fa-spin';

    // Remove tooltip during loading 
    const tooltip = this.querySelector('.tooltip');
    
    // Check if the tooltip element exists before trying to use it
    let originalDisplay = ''; // Default value
    if (tooltip) {
      originalDisplay = tooltip.style.display;
      tooltip.style.display = 'none';
    }

    // Random delay between 1-2 seconds
    const delay = 1000 + Math.random() * 6000;

    setTimeout(() => {
      // Restore original icon
      icon.className = originalIcon;

      // Show red notification
      const notification = document.createElement('div');
      notification.className = 'feature-notification';

      // Set different messages based on which button
      if (this.querySelector('.fa-video')) {
        notification.textContent = 'Privacy first. We’ve temporarily paused this feature to perform a security review. It will be back online soon.';
      } else if (this.querySelector('.fa-desktop')) {
        notification.textContent = 'Privacy first. We’ve temporarily paused this feature to perform a security review. It will be back online soon.';
      }

      // Add to DOM
      document.body.appendChild(notification);

      // Auto-remove after 6 seconds
      setTimeout(() => {
        notification.remove();
      }, 6000);

      // Restore tooltip, but only if it exists
      if (tooltip) {
        tooltip.style.display = originalDisplay;
      }
    }, delay);
  });
});

/**
 * This function handles the click on the dictate (microphone) button.
 */
// === [PHASE 2] === 
/**
 * This function handles the click on the dictate (microphone) button.
 */
const inputArea = document.getElementById('input-area');
const fullscreenBtn = document.querySelector('.input-fullscreen-toggle');

// Dictate button (start / stop toggle)
function handleDictateButtonClick() {
    console.log("🎤 Dictate button clicked.");
    const isNowActive = !inputArea.classList.contains('dictation-active');
    inputArea.classList.toggle('dictation-active');

    if (isNowActive) {
        console.log("🎙️ Listening...");
        dictate.start();
        fullscreenBtn.style.display = "none";
    } else {
        console.log("🛑 Dictation manually toggled off.");
        dictate.stop();
        fullscreenBtn.style.display = "inline-block";
    }
}

// Stop button → stop listening & clear transcript
function stopDictation() {
    console.log("⏹️ Stop button clicked.");
    inputArea.classList.remove('dictation-active');
    dictate.stop();
    dictate.clearTranscript();  // delete text completely
    fullscreenBtn.style.display = "inline-block";
}

// Show Text button → stop listening & put transcript in input box
function showTextDictation() {
    console.log("📜 Show Text button clicked.");
    inputArea.classList.remove('dictation-active');
    dictate.stop();

    const transcript = dictate.getTranscript();
    document.getElementById('userInput').value = transcript;
    adjustTextareaHeight();

    fullscreenBtn.style.display = "inline-block";
}

// Send button → stop listening & send transcript
function sendDictation() {
    console.log("📤 Send button clicked.");
    inputArea.classList.remove('dictation-active');
    dictate.stop();

    const transcript = dictate.getTranscript();
    document.getElementById('userInput').value = transcript;

    // You already have sendMessage() in Python backend
    // sendMessage();

    fullscreenBtn.style.display = "inline-block";
}



// [PHASE 2 END]
// [PHASE 1 END]