import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Mesmo projeto Firebase já usado pelo seu sistema.
// Usamos uma instância de app com nome próprio para o fluxo do Bonde62,
// evitando misturar o estado de login da interface com o restante do app.
const bonde62FirebaseConfig = {
  apiKey: "AIzaSyD3LzHzVZh2rG8EbLpC4ghnPcrMwYZT7bk",
  authDomain: "bolao10-5617f.firebaseapp.com",
  projectId: "bolao10-5617f",
  storageBucket: "bolao10-5617f.firebasestorage.app",
  messagingSenderId: "821468708907",
  appId: "1:821468708907:web:54d1e75e31b35ed6eaaa6e",
  measurementId: "G-C25PND1PLH",
};

const BONDE62_APP_NAME = "bonde62-auth";

const bonde62App = getApps().some((app) => app.name === BONDE62_APP_NAME)
  ? getApp(BONDE62_APP_NAME)
  : initializeApp(bonde62FirebaseConfig, BONDE62_APP_NAME);

export const bonde62Auth = getAuth(bonde62App);