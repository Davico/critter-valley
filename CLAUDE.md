# Critter Valley — notes for Claude Code

## Jezik
- Sa mnom komuniciraj na srpskom (latinica). Tekst u igri, imena u kodu i commit poruke su na engleskom.

## Projekat
- 3D web igra: TypeScript + Vite + three.js (bez drugih runtime zavisnosti). Kasnije Capacitor za Google Play / App Store.
- `src/world.ts` — jezgro: aktivni teren (`setTerrain`), površine (trava/sneg/led), kolajderi (`BOXES`, `groundAt`, `pushOut`), zajednički graditelji (teren, drveće, stene, oblaci).
- `src/biomes/` — svaki biom je jedan modul (`Biome` u `types.ts`): teren, površine, gnezda + čuvari, vozilo, dom, portal, saveti, dekor. `meadow.ts` = dolina sa kampom, `snow.ts` = Snežna planina.
- `src/game.ts` — `loadArea()` (briše scenu osim objekata sa `userData.keep` i gradi biom), junak (hod, kotrljanje, grudva koja raste na snegu, klizanje na ledu, jahanje), poslastice, čuvari (`hen`: juri/kljuca, `ram`: nišani „!“ pa juriša pravo, ošamuti se kad udari u prepreku), kolica (dolina), sanke (planina), portal, kamera.
- `src/snacks.ts` — poslastice po biomu (🍓🍯🍉 / 🍪☕🎂, zlatne ✨ idu u zajednički „gold“).
- `src/camp.ts` — kamp u dolini + gradnja u svakom biomu (kockice se pamte po biomu u `S.builds`; predmeti za životinje samo u kampu): gradnja, ostava, posetioci, prijatelji, buddy moći, jahanje (`ride`), knjiga po biomima. Van doline prati te samo buddy.
- `src/save.ts` — snimanje (localStorage `critter_valley_v1`, sa migracijom starog formata). `src/fx.ts` — čestice, plutajući tekst, HUD poruke.
- Petlja: poslastica → ostava → životinja dolazi ako ima svoju hranu + ono što voli → poklon 🎁 → 3 posete = prijatelj. Portal ka Snežnoj planini se otvara sa 3 prijatelja.
- Novi biom: napravi modul u `src/biomes/`, dodaj ga u `index.ts`, dodaj id u `Biome['id']`, životinje u `ANIMALS` (sa `biome`), predmete u `PALETTE` (sa `biome`).
- `src/main.ts` — renderer, svetla, unos (tastatura, miš, dodir), HUD.
- Fizika je naša (bez fizičkog engine-a): fiksni korak 60 Hz. Ne koristi frame time u logici.
- Test: `window.__game` (state, update) za automatsko igranje u Playwright-u.

## Pravila dizajna
- Igra mora biti fer prema deci: nema smrti, nema trajnog gubitka, bez reklama, bez nasumičnih kupovina.
- Zarada kasnije: jednokratna kupovina „Full game” + jednokratni kozmetički paketi.
