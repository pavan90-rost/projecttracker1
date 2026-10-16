import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const button = document.querySelector("#login-button");
const status = document.querySelector("#login-status");

const configIsMissing = Object.values(firebaseConfig).some(value =>
  value.startsWith("YOUR_")
);
let auth = null;

if (configIsMissing) {
  status.textContent = "Firebase setup is required. Add your Firebase web app config to firebase-config.js.";
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!auth) {
    status.textContent = "Firebase setup is required. Add your Firebase web app config to firebase-config.js.";
    return;
  }

  button.disabled = true;
  status.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    status.textContent = "Signed in successfully.";
    passwordInput.value = "";
  } catch (error) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        status.textContent = "Email or password is incorrect.";
        break;
      case "auth/invalid-email":
        status.textContent = "Enter a valid email address.";
        break;
      case "auth/too-many-requests":
        status.textContent = "Too many attempts. Please try again later.";
        break;
      case "auth/network-request-failed":
        status.textContent = "Network error. Check your connection and try again.";
        break;
      default:
        status.textContent = "Sign-in failed. Check your Firebase setup and try again.";
    }
  } finally {
    button.disabled = false;
  }
});
