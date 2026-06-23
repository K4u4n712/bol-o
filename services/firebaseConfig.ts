import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD3LzHzVZh2rG8EbLpC4ghnPcrMwYZT7bk",
  authDomain: "bolao10-5617f.firebaseapp.com",
  projectId: "bolao10-5617f",
  storageBucket: "bolao10-5617f.firebasestorage.app",
  messagingSenderId: "821468708907",
  appId: "1:821468708907:web:54d1e75e31b35ed6eaaa6e",
  measurementId: "G-C25PND1PLH",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);