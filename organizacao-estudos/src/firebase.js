import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC0v0XzhFVIRNqo1c7od1PVwyNxamQjuzo",
    authDomain: "org-de-estudo.firebaseapp.com",
    projectId: "org-de-estudo",
    storageBucket: "org-de-estudo.firebasestorage.app",
    messagingSenderId: "993450914051",
    appId: "1:993450914051:web:00264c803b01ef6cbcb936"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);