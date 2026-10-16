# projecttracker1

## Firebase email/password login

1. In the Firebase console, create a web app and enable **Email/Password** under **Authentication → Sign-in method**.
2. Copy the web app configuration into `firebase-config.js`, replacing the `YOUR_...` placeholders.
3. Add `pavan90-rost.github.io` to **Authentication → Settings → Authorized domains**.
4. Publish the updated files with GitHub Pages.

The Firebase web app config is used by the browser and is not a server-side secret. Restrict its API key to the APIs and websites your app needs in Google Cloud Console.