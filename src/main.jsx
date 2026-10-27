import React from "react";
import { createRoot } from "react-dom/client";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import flaggenSchrift from "country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url";
import App from "./App.jsx";
import "./styles.css";

/* Länderflaggen auf Windows: Dort fehlen sie in der Emoji-Schrift, und statt 🇩🇪 steht
   „DE". Das Paket prüft auf einer Leinwand, ob das Gerät Flaggen zeichnen kann, und
   nur wenn nicht, meldet es eine Schrift an, die ausschließlich Flaggen enthält
   (unicode-range). Mac, iPhone und Android laden nichts. Die Schrift kommt von hier,
   nicht vom vorgegebenen fremden Server. Genutzt wird sie über die Klasse .flagge. */
polyfillCountryFlagEmojis("Twemoji Country Flags", flaggenSchrift);

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
