# Critter Valley — notes for Claude Code

## Jezik
- Sa mnom komuniciraj na srpskom (latinica). Tekst u igri, imena u kodu i commit poruke su na engleskom.

## Projekat
- 3D web igra: TypeScript + Vite + three.js (bez drugih runtime zavisnosti). Kasnije Capacitor za Google Play / App Store.
- `src/world.ts` — teren (heightfield), kolajderi (kutije, rampe, most, pečurke), dekor.
- `src/models.ts` — svi modeli su napravljeni od primitiva u kodu (bez fajlova).
- `src/game.ts` — junak (hod/kotrljanje), poslastice (🍓 🍯 🍉, zlatne ✨), kokoške-čuvari, kolica, traka, kamera.
- `src/camp.ts` — kamp: gradnja od kockica (voksel mapa → `BOXES` kolajderi), specijalni predmeti, ostava (pantry), posetioci, prijatelji, buddy moći, knjiga.
- `src/save.ts` — snimanje (localStorage `critter_valley_v1`). `src/fx.ts` — čestice, plutajući tekst, HUD poruke.
- Petlja: poslastica → ostava → životinja dolazi ako ima svoju hranu + ono što voli (npr. 🐰 = 🍓 + 3 cveta) → poklon 🎁 (novčići) → 3 posete = prijatelj (useli se, daje moć kao buddy).
- `src/main.ts` — renderer, svetla, unos (tastatura, miš, dodir), HUD.
- Fizika je naša (bez fizičkog engine-a): fiksni korak 60 Hz. Ne koristi frame time u logici.
- Test: `window.__game` (state, update) za automatsko igranje u Playwright-u.

## Pravila dizajna
- Igra mora biti fer prema deci: nema smrti, nema trajnog gubitka, bez reklama, bez nasumičnih kupovina.
- Zarada kasnije: jednokratna kupovina „Full game” + jednokratni kozmetički paketi.
