import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const authHeading = document.querySelector("#auth-heading");
const authIntro = document.querySelector("#auth-intro");
const authSubmit = document.querySelector("#auth-submit");
const authSwitchPrompt = document.querySelector("#auth-switch-prompt");
const authSwitch = document.querySelector("#auth-switch");
const authStatus = document.querySelector("#auth-status");
const appStatus = document.querySelector("#app-status");
const projectForm = document.querySelector("#project-form");
const projectList = document.querySelector("#project-list");
const projectsStatus = document.querySelector("#projects-status");
const emptyState = document.querySelector("#empty-state");
const projectStatusMessage = document.querySelector("#project-status-message");
const saveProjectButton = document.querySelector("#save-project-button");
const projectFormTitle = document.querySelector("#project-form-title");
const progressInput = document.querySelector("#project-progress");
const progressValue = document.querySelector("#progress-value");
const logoutButton = document.querySelector("#logout-button");

let isSignUp = false;
let currentUser = null;
let stopListeningToProjects = null;
let editingProjectId = null;
let appFeedbackTimer = null;
let auth = null;
let db;

function showNotice(element, message, kind = "") {
  element.textContent = message;
  element.className = `notice${kind ? ` notice-${kind}` : ""}`;
  element.hidden = false;
}

function clearNotice(element) {
  element.textContent = "";
  element.hidden = true;
  element.className = "notice";
}

function showAppFeedback(message, kind = "success") {
  if (appFeedbackTimer) window.clearTimeout(appFeedbackTimer);
  showNotice(appStatus, message, kind);
  appFeedbackTimer = window.setTimeout(() => clearNotice(appStatus), 4500);
}

function authErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "That email and password combination doesn’t look right.";
    case "auth/email-already-in-use":
      return "An account already exists for this email. Try signing in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little while and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email and password sign-in isn’t enabled in Firebase Authentication.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    default:
      return "We couldn’t complete that request. Check your Firebase setup and try again.";
  }
}

function setAuthMode(signUp) {
  isSignUp = signUp;
  authHeading.textContent = signUp ? "Create your account" : "Welcome back";
  authIntro.textContent = signUp
    ? "Start bringing your projects into focus."
    : "Sign in to pick up where you left off.";
  authSubmit.innerHTML = signUp
    ? 'Create account <span aria-hidden="true">→</span>'
    : 'Sign in <span aria-hidden="true">→</span>';
  authSwitchPrompt.textContent = signUp
    ? "Already have an account?"
    : "New to Project Tracker?";
  authSwitch.textContent = signUp ? "Sign in" : "Create an account";
  passwordInput.autocomplete = signUp ? "new-password" : "current-password";
  clearNotice(authStatus);
}

function setUserDetails(user) {
  const email = user.email || "Project Tracker user";
  const initial = email.charAt(0).toUpperCase() || "U";
  document.querySelector("#user-email").textContent = email;
  document.querySelector("#topbar-email").textContent = email;
  document.querySelector("#user-avatar").textContent = initial;
  document.querySelector("#topbar-avatar").textContent = initial;
}

function displayDate(dateString) {
  if (!dateString) return "No deadline";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function makeProjectCard(project, projectId) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.dataset.projectId = projectId;
  card.dataset.deadline = project.deadline;
  card.dataset.status = project.status;
  card.dataset.progress = String(project.progress);
  card.dataset.description = project.description || "";

  const header = document.createElement("div");
  header.className = "project-card-top";

  const title = document.createElement("h3");
  title.textContent = project.name;

  const status = document.createElement("span");
  status.className = "status-pill";
  if (project.status === "Completed") status.classList.add("status-completed");
  if (project.status === "On hold") status.classList.add("status-on-hold");
  status.textContent = project.status;
  header.append(title, status);

  const actions = document.createElement("div");
  actions.className = "project-actions";
  const editButton = document.createElement("button");
  editButton.className = "project-action";
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${project.name}`);
  const deleteButton = document.createElement("button");
  deleteButton.className = "project-action project-action-danger";
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${project.name}`);
  actions.append(editButton, deleteButton);
  header.append(actions);

  const description = document.createElement("p");
  description.className = "project-description";
  description.textContent = project.description || "No description added.";

  const metadata = document.createElement("div");
  metadata.className = "project-card-meta";
  const deadline = document.createElement("span");
  deadline.className = "project-deadline";
  deadline.textContent = `◷  Due ${displayDate(project.deadline)}`;
  metadata.append(deadline);

  const progress = document.createElement("div");
  progress.className = "project-progress";
  const progressLabel = document.createElement("div");
  progressLabel.className = "progress-label";
  const progressText = document.createElement("span");
  progressText.textContent = "Progress";
  const percent = document.createElement("strong");
  percent.textContent = `${project.progress}%`;
  progressLabel.append(progressText, percent);

  const track = document.createElement("div");
  track.className = "progress-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", `${project.name} progress`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(project.progress));
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${project.progress}%`;
  track.append(fill);
  progress.append(progressLabel, track);

  card.append(header, description, metadata, progress);
  return card;
}

function updateProjectSummary(projects) {
  document.querySelector("#stat-total").textContent = String(projects.length);
  document.querySelector("#stat-progress").textContent = String(
    projects.filter(project => project.status === "In progress").length
  );
  document.querySelector("#stat-completed").textContent = String(
    projects.filter(project => project.status === "Completed").length
  );
}

function listenToProjects(user) {
  if (stopListeningToProjects) stopListeningToProjects();
  projectList.replaceChildren();
  emptyState.hidden = true;
  showNotice(projectsStatus, "Loading your projects…");

  const projectsQuery = query(
    collection(db, "users", user.uid, "projects"),
    where("ownerUid", "==", user.uid),
    orderBy("updatedAt", "desc")
  );
  stopListeningToProjects = onSnapshot(
    projectsQuery,
    snapshot => {
      const projects = snapshot.docs.map(projectDoc => ({
        id: projectDoc.id,
        ...projectDoc.data()
      }));
      projectList.replaceChildren(
        ...projects.map(project => makeProjectCard(project, project.id))
      );
      updateProjectSummary(projects);
      projectsStatus.hidden = true;
      emptyState.hidden = projects.length !== 0;
    },
    error => {
      console.error("Unable to load projects:", error);
      projectList.replaceChildren();
      emptyState.hidden = true;
      updateProjectSummary([]);
      showNotice(
        projectsStatus,
        error.code === "permission-denied"
          ? "Firestore denied access. Check that Firestore is enabled and the included security rules are deployed."
          : "We couldn’t load your projects. Check your connection and try again.",
        "error"
      );
    }
  );
}

function openProjectForm() {
  editingProjectId = null;
  projectFormTitle.textContent = "Create a project";
  saveProjectButton.innerHTML = 'Create project <span aria-hidden="true">→</span>';
  projectForm.reset();
  progressValue.textContent = "0%";
  clearNotice(projectStatusMessage);
  projectForm.hidden = false;
  document.querySelector("#project-name").focus();
}

function editProject(projectId) {
  const card = projectList.querySelector(`[data-project-id="${CSS.escape(projectId)}"]`);
  if (!card) return;

  editingProjectId = projectId;
  projectFormTitle.textContent = "Edit project";
  saveProjectButton.innerHTML = 'Save changes <span aria-hidden="true">→</span>';
  document.querySelector("#project-name").value = card.querySelector("h3").textContent;
  document.querySelector("#project-description").value = card.dataset.description;
  document.querySelector("#project-deadline").value = card.dataset.deadline;
  document.querySelector("#project-status").value = card.dataset.status;
  progressInput.value = card.dataset.progress;
  progressValue.textContent = `${progressInput.value}%`;
  clearNotice(projectStatusMessage);
  projectForm.hidden = false;
  document.querySelector("#project-name").focus();
}

function closeProjectForm() {
  projectForm.reset();
  editingProjectId = null;
  projectFormTitle.textContent = "Create a project";
  saveProjectButton.innerHTML = 'Create project <span aria-hidden="true">→</span>';
  progressValue.textContent = "0%";
  clearNotice(projectStatusMessage);
  projectForm.hidden = true;
}

authSwitch.addEventListener("click", () => setAuthMode(!isSignUp));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearNotice(authStatus);
  authSubmit.disabled = true;
  authSubmit.textContent = isSignUp ? "Creating account…" : "Signing in…";

  try {
    const email = emailInput.value.trim();
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, passwordInput.value);
      showNotice(appStatus, "Your account is ready. Welcome to Project Tracker!", "success");
      window.setTimeout(() => clearNotice(appStatus), 5000);
    } else {
      await signInWithEmailAndPassword(auth, email, passwordInput.value);
    }
    passwordInput.value = "";
  } catch (error) {
    showNotice(authStatus, authErrorMessage(error), "error");
  } finally {
    authSubmit.disabled = false;
    authSubmit.innerHTML = isSignUp
      ? 'Create account <span aria-hidden="true">→</span>'
      : 'Sign in <span aria-hidden="true">→</span>';
  }
});

for (const buttonId of ["new-project-button", "empty-create-button"]) {
  document.querySelector(`#${buttonId}`).addEventListener("click", openProjectForm);
}
for (const buttonId of ["cancel-project-button", "cancel-project-button-bottom"]) {
  document.querySelector(`#${buttonId}`).addEventListener("click", closeProjectForm);
}

projectList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || !currentUser) return;
  const card = button.closest(".project-card");
  if (!card) return;
  const projectId = card.dataset.projectId;

  if (button.dataset.action === "edit") {
    editProject(projectId);
    return;
  }

  if (button.dataset.action !== "delete") return;
  const projectName = card.querySelector("h3").textContent;
  if (!window.confirm(`Delete “${projectName}”? This action cannot be undone.`)) return;

  button.disabled = true;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "projects", projectId));
    if (editingProjectId === projectId) closeProjectForm();
    showAppFeedback("Project deleted successfully.");
  } catch (error) {
    console.error("Unable to delete project:", error);
    showAppFeedback(
      error.code === "permission-denied"
        ? "You don’t have permission to delete this project."
        : "We couldn’t delete this project. Check your connection and try again.",
      "error"
    );
  } finally {
    button.disabled = false;
  }
});

progressInput.addEventListener("input", () => {
  progressValue.textContent = `${progressInput.value}%`;
});

projectForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  clearNotice(projectStatusMessage);
  saveProjectButton.disabled = true;
  saveProjectButton.textContent = editingProjectId ? "Saving changes…" : "Creating…";

  const formData = new FormData(projectForm);
  const project = {
    ownerUid: currentUser.uid,
    name: String(formData.get("name")).trim(),
    description: String(formData.get("description")).trim(),
    deadline: String(formData.get("deadline")),
    status: String(formData.get("status")),
    progress: Number(formData.get("progress"))
  };

  try {
    if (editingProjectId) {
      const projectRef = doc(db, "users", currentUser.uid, "projects", editingProjectId);
      await updateDoc(projectRef, {
        ...project,
        updatedAt: serverTimestamp()
      });
      closeProjectForm();
      showAppFeedback("Project updated successfully.");
    } else {
      await addDoc(collection(db, "users", currentUser.uid, "projects"), {
        ...project,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      closeProjectForm();
      showAppFeedback("Project created successfully.");
    }
  } catch (error) {
    console.error(`Unable to ${editingProjectId ? "update" : "create"} project:`, error);
    showNotice(
      projectStatusMessage,
      error.code === "permission-denied"
        ? "Firestore denied this change. Make sure you own the project and the current security rules are deployed."
        : `We couldn’t ${editingProjectId ? "update" : "create"} this project. Check your connection and try again.`,
      "error"
    );
  } finally {
    saveProjectButton.disabled = false;
    saveProjectButton.innerHTML = editingProjectId
      ? 'Save changes <span aria-hidden="true">→</span>'
      : 'Create project <span aria-hidden="true">→</span>';
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Unable to sign out:", error);
    showNotice(appStatus, "We couldn’t sign you out. Please try again.", "error");
  } finally {
    logoutButton.disabled = false;
  }
});

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric"
}).format(new Date());

try {
  const configIsMissing = Object.values(firebaseConfig).some(value =>
    typeof value !== "string" || !value || value.startsWith("YOUR_")
  );
  if (configIsMissing) throw new Error("Firebase web app configuration is incomplete.");

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user => {
    currentUser = user;
    authView.hidden = Boolean(user);
    appView.hidden = !user;

    if (user) {
      setUserDetails(user);
      listenToProjects(user);
    } else {
      if (stopListeningToProjects) stopListeningToProjects();
      stopListeningToProjects = null;
      clearNotice(appStatus);
      projectList.replaceChildren();
      updateProjectSummary([]);
      closeProjectForm();
      authForm.reset();
      setAuthMode(false);
    }
  }, error => {
    console.error("Firebase authentication state error:", error);
    showNotice(authStatus, "We couldn’t connect to Firebase. Check your setup and refresh the page.", "error");
  });
} catch (error) {
  console.error("Firebase initialization failed:", error);
  authSubmit.disabled = true;
  authSwitch.disabled = true;
  showNotice(authStatus, "Firebase is not configured correctly. Verify firebase-config.js and refresh the page.", "error");
}
