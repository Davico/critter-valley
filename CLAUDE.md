# Nest Raiders — notes for Claude Code

## Jezik
- Sa mnom komuniciraj na srpskom (latinica). Tekst u igri, imena u kodu i commit poruke su na engleskom.

## Projekat
- 3D web igra: TypeScript + Vite + three.js (bez drugih runtime zavisnosti). Kasnije Capacitor za Google Play / App Store.
- `src/world.ts` — teren (heightfield), kolajderi (kutije, rampe, most, pečurke), dekor.
- `src/models.ts` — svi modeli su napravljeni od primitiva u kodu (bez fajlova).
- `src/game.ts` — logika: junak (hod/kotrljanje), jaja, kokoške, kolica, inkubatori, ljubimci, traka, kupovine, kamera.
- `src/main.ts` — renderer, svetla, unos (tastatura, miš, dodir), HUD.
- Fizika je naša (bez fizičkog engine-a): fiksni korak 60 Hz. Ne koristi frame time u logici.
- Test: `window.__game` (state, update) za automatsko igranje u Playwright-u.

## Pravila dizajna
- Igra mora biti fer prema deci: nema smrti, nema trajnog gubitka, bez reklama, bez nasumičnih kupovina.
- Zarada kasnije: jednokratna kupovina „Full game” + jednokratni kozmetički paketi.
