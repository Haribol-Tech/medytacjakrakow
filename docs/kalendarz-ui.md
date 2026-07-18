# Kalendarz — decyzje UI/UX

Dokument opisuje wszystkie zatwierdzone decyzje dotyczące interfejsu strony `/kalendarz/`. Stanowi podstawę do implementacji komponentu kalendarza.

---

## 1. Struktura plików

```
src/pages/kalendarz.astro                    — strona /kalendarz/ (shell, buduje słowniki nazw i opisów)
src/components/Kalendarz.astro               — główny komponent (orkiestrator, importuje widoki)
src/components/kalendarz/WidokLista.astro    — widok listy + <template> karty zajęć
src/components/kalendarz/WidokKropki.astro   — widok kropki + panel detali dzienny
src/components/kalendarz/WidokSiatka.astro   — widok siatki desktop
src/components/kalendarz/PanelDetali.astro   — panel szczegółów zajęć (desktop, pod/obok siatki)
src/components/kalendarz/ModalZapisu.astro   — modal formularza zapisu
public/js/kalendarz.js                       — logika UI (stan, nawigacja, fetch, klonowanie templates)
public/css/kalendarz.css                     — style kalendarza (osobny plik, nie w CSS szablonu)
```

Architektura: każdy widok definiuje strukturę HTML jako `<template>` w Astro. JavaScript klonuje szablony i wypełnia danymi — nie buduje HTML jako string. Logika globalna (stan, nawigacja, fetch) w `kalendarz.js`; logika lokalna każdego widoku docelowo w `<script>` jego komponentu.

Dane pobierane **client-side** przez `fetch('/api/terminy')` przy załadowaniu strony — nie server-side. Uzasadnienie: dane zmieniają się w czasie (cache 60 min po stronie API), strona jest statyczna.

---

## 2. Widoki — dostępność na urządzeniach

| Widok | Mobile | Desktop |
|---|---|---|
| Lista | ✓ domyślny | ✓ domyślny |
| Kropki | ✓ | — |
| Siatka | — | ✓ |

Przełącznik widoków: przycisk w nagłówku strony `/kalendarz/`. Wybór zapamiętywany w `localStorage` przeglądarki.

Stała w kodzie: `DOMYSLNY_WIDOK = 'lista'` — możliwe wartości: `'lista'`, `'kropki'` (mobile), `'siatka'` (desktop).

---

## 3. Nawigacja między miesiącami

- Strzałki prev/next — jedyna metoda nawigacji
- Etykieta bieżącego miesiąca (np. "Lipiec 2026") — nieaktywny tekst, nie jest przyciskiem
- Cofanie w przeszłość: bez ograniczeń; każdy nowy miesiąc to osobne wywołanie `GET /api/terminy?rok=&miesiac=`
- `terminy.js` wymaga rozszerzenia o opcjonalny parametr `?rok=RRRR&miesiac=MM` (do zrobienia przy implementacji)

---

## 4. Ładowanie danych i obsługa błędów

- **Skeleton loader** podczas `fetch` — animowany puls szarych kart (nie spinner); standard mobilny
- **Błąd sieci / błąd API** — komunikat: "Nie udało się załadować kalendarza. Spróbuj odświeżyć stronę." — bez detali technicznych

---

## 5. Widok lista

### Zachowanie

- Wyświetla wszystkie zajęcia bieżącego miesiąca, posortowane chronologicznie
- Przy wejściu na stronę lista **przewija się automatycznie do najbliższych nadchodzących zajęć** — jeśli dzisiaj są zajęcia, lista startuje od dzisiaj; jeśli nie ma — od najbliższego dnia z zajęciami w przyszłości; jeśli w tym miesiącu nie ma już nadchodzących — lista startuje od początku miesiąca. Zajęcia z przeszłości w tym miesiącu widoczne po przewinięciu w górę.
- Poprzedni miesiąc (po kliknięciu strzałki wstecz): lista startuje od początku miesiąca

### Karta zajęć — layout i zawartość

Karta ma pasek koloru kategorii po lewej stronie i body z czterema strefami:

**Nagłówek** (jeden wiersz): badge kategorii (lewy) + pełna data w dopełniaczu np. "Czwartek, 2 lipca" (prawy)

**Nazwa zajęć** — duża, wyraźna

**Szczegóły** — jedna linia z zawijaniem, każdy element poprzedzony ikoną SVG:
- ikona zegara + godzina start–koniec
- ikona pinezki + adres (domyślnie "ul. Starowiślna 20/5, Kraków"; jeśli inne — nazwa miejsca z Airtable)
- ikona osoby + prowadzący (tylko jeśli przypisany; wiersz ukryty gdy brak)

**Separator** (linia pozioma)

**Stopka** (jeden wiersz): liczba wolnych miejsc po lewej (warunkowa, format "Wolne: X / Y") + przyciski po prawej: "Informacje" (secondary) i przycisk akcji zapisu (primary)

Przyciski zawsze w jednej linii obok siebie. `border-radius: 10px` zgodnie z szablonem Restraint.

### Przyciski na karcie

Każda karta ma **dwa przyciski** w stopce:

- **"Więcej informacji"** (secondary — obramowany) → zachowanie sterowane stałą `OPIS_ZAJEC_TRYB` (patrz sekcja 10)
- **Przycisk akcji zapisu** (primary — wypełniony) → otwiera modal formularza

Hierarchia wizualna: przycisk zapisu jest dominujący (wypełniony kolor), "Więcej informacji" subtelniejszy. Kliknięcie gdziekolwiek w kartę poza przyciskami nie robi nic.

### Tryby przycisku "Więcej informacji"

Sterowane stałą `OPIS_ZAJEC_TRYB` w `public/js/kalendarz.js`:

**Tryb `'podstrona'` (domyślny):** kliknięcie przenosi na podstronę zajęć (np. `/kirtan-medytacja/`). Przed przejściem skrypt zapisuje w URL parametr identyfikujący konkretny termin, np. `/kalendarz/?termin=abc123-2026-07-15` (ID harmonogramu + data). Na podstronie zajęć widoczny przycisk "Wróć do kalendarza" — po powrocie kalendarz odczytuje parametr `termin` z URL i przewija listę dokładnie do tej karty z której użytkownik wyszedł. Rekomendowany dla SDJ — nowi użytkownicy potrzebują pełnej strony żeby zbudować zaufanie do organizacji.

**Tryb `'modal'`:** kliknięcie otwiera nakładkę z opisem zajęć (zdjęcie, opis, prowadzący) bez opuszczania kalendarza. Na dole nakładki przycisk "Zapisz się" otwiera modal formularza. Wymaga słownika `window.ZAJECIA_OPISY` wbudowanego przez Astro podczas budowania strony (analogicznie do `window.ZAJECIA_NAZWY`).

### Stany karty — przycisk akcji zapisu

| Stan | Tekst przycisku akcji | Styl przycisku akcji | Informacja o miejscach |
|---|---|---|---|
| Wolne miejsca podstawowe | Zapisz się | zielony, wypełniony | warunkowa (patrz niżej) |
| Brak miejsc, wolne rezerwowe | Lista rezerwowa | szary, obramowanie | warunkowa |
| Brak wszystkich miejsc | Zapisy zamknięte | brak przycisku, tekst | ukryta |
| Zapisy nieaktywne | *(brak przycisku akcji)* | — | ukryta |
| Odwołane | *(brak przycisku akcji)* | wyszarzona karta | ukryta |

Przycisk "Więcej informacji" pojawia się zawsze — niezależnie od stanu zapisu i stanu karty. Karta z nieaktywnymi zapisami lub odwołana ma tylko przycisk "Więcej informacji" w stopce — **tę samą wysokość** co pozostałe karty, stopka istnieje.

### Liczba wolnych miejsc

Stała w kodzie: `PROG_WYSWIETLANIA_MIEJSC` (liczba 0–100, procent zapełnienia).

- `0` → zawsze wyświetlaj
- `100` → nigdy nie wyświetlaj
- `40` → wyświetlaj gdy zajęte ≥ 40% miejsc podstawowych (wartość domyślna)

Wyświetlana jest tylko liczba miejsc **podstawowych** (nie rezerwowych). Informacja o liście rezerwowej pojawia się dopiero w modalu.

### Filtr kategorii

- Pillsy (pill buttons) nad listą: "Wszystkie" + jedna pozycja per kategoria
- Na mobile: przewijane poziomo jeśli kategorii jest dużo
- Na desktop: leżą w rzędzie bez przewijania
- Stała w kodzie: `POKAZ_FILTR_KATEGORII = true` — wyłączenie ukrywa cały pasek pillsów

---

## 6. Widok kropki (mobile)

Wzorowany na Apple Calendar (tryb miesięczny na iPhone).

### Układ ekranu

- **Górna część (stała):** siatka miesięczna 7×5 komórek; nie scrolluje się
- **Dolna część (scrollowalna):** panel dzienny z zajęciami dla wybranego dnia; scrolluje się niezależnie od siatki

### Kropki w siatce

- Każde zajęcia w danym dniu = jedna kolorowa kropka (kolor = kategoria)
- Kilka zajęć w jednym dniu = kilka kropek w rzędzie

### Interakcja

- Tap w dzień **z zajęciami** → panel dzienny aktualizuje się (bez animacji strony, tylko zawartość dołu się zmienia); wybrany dzień otrzymuje wyraźne tło
- Tap w dzień **bez zajęć** → nic się nie dzieje; komórka nie reaguje wizualnie
- Przy wejściu na stronę: panel pokazuje zajęcia z bieżącego dnia (lub najbliższego dnia z zajęciami jeśli dzisiaj nic nie ma)

### Panel dzienny

Karty zajęć z pełnymi informacjami — identyczną zawartością jak karta w widoku lista (badge kategorii, data, nazwa, godzina z ikoną, adres z ikoną, prowadzący z ikoną, separator, stopka z wolnymi miejscami i przyciskami). Implementowane przy tworzeniu `WidokKropki.astro`.

---

## 7. Widok siatka (desktop)

### Paski w komórkach

- Każde zajęcia w danym dniu = poziomy kolorowy pasek na pełną szerokość komórki
- Tekst na pasku: `nazwa_skrocona` (jeśli wypełniona w Decap CMS), w przeciwnym razie `nazwa` ze słownika JS
- Kilka zajęć w jednym dniu: paski stackują się jeden pod drugim

### Interakcja z komórką

- **1 zajęcie w dniu** → kliknięcie w dowolne miejsce komórki wyświetla panel detali
- **Kilka zajęć w dniu** → tylko kliknięcie w konkretny pasek wyświetla panel detali dla tych zajęć; kliknięcie w puste miejsce komórki nie robi nic

### Panel detali (desktop)

Kliknięcie w komórkę/pasek wyświetla panel z informacjami o zajęciach i dwoma przyciskami: "Więcej informacji" (link do podstrony) i przycisk akcji zapisu (otwiera modal). Identyczna logika stanów jak na kartach w widoku lista.

**Pozycja panelu:** do ustalenia na etapie implementacji — pod kalendarzem lub obok, w zależności od dostępnej przestrzeni i tego co jeszcze znajdzie się na stronie `/kalendarz/`. Decyzja nie blokuje implementacji pozostałych elementów.

---

## 8. Słownik nazw — integracja Decap CMS z frontendem

`terminy.js` zwraca tylko `slug` zajęć (nie nazwę). Pełna nazwa pochodzi z Decap CMS.

Astro podczas budowania strony odczytuje kolekcję `zajecia` i wbudowuje w stronę `kalendarz.astro` dwa słowniki:

**Słownik nazw** (zawsze obecny):
```javascript
window.ZAJECIA_NAZWY = {
  'kirtan-medytacja': { nazwa: 'Kirtan Medytacja', nazwa_skrocona: 'Kirtan' },
  'medytacja-od-podstaw': { nazwa: 'Medytacja od podstaw', nazwa_skrocona: '' },
  // ...
}
```

Frontend używa: `nazwa_skrocona || nazwa` — jeśli skrócona jest wypełniona, używa jej (w siatce desktop); jeśli pusta, używa pełnej (wszędzie).

**Słownik opisów** (używany tylko gdy `OPIS_ZAJEC_TRYB = 'modal'`):
```javascript
window.ZAJECIA_OPISY = {
  'kirtan-medytacja': { opis: 'Kirtan to wspólne śpiewanie...', zdjecie: '/images/kirtan.jpg' },
  // ...
}
```

Oba słowniki generowane przez Astro z kolekcji `zajecia` podczas budowania — zero dodatkowych zapytań do serwera w przeglądarce.

---

## 9. Modal zapisu (bottom sheet)

- Otwierany **wyłącznie** przez kliknięcie przycisku akcji zapisu ("Zapisz się" / "Lista rezerwowa") — nigdy przez kliknięcie w kartę, pasek lub komórkę
- Wysuwany od dołu ekranu — standard mobilny; nie otwiera nowej strony
- Zamykany tapnięciem poza panel lub przyciskiem Anuluj

### Stany modalu

**Formularz** (stan domyślny): pola zapisu + przycisk Wyślij

**Sukces**: formularz znika; pojawia się checkmark + "Zgłoszenie wysłane! Potwierdzenie otrzymasz na adres [email]." + przycisk "Zamknij"; modal **nie zamyka się automatycznie**

**Błąd**: komunikat błędu nad przyciskiem Wyślij; formularz zostaje wypełniony; użytkownik może spróbować ponownie bez wpisywania danych od nowa

### Informacja o liście rezerwowej

Gdy użytkownik otwiera modal dla zajęć bez wolnych miejsc podstawowych (przycisk "Lista rezerwowa"), w modalu pojawia się wyraźna informacja: "Wpisujesz się na listę rezerwową. Miejsce nie jest gwarantowane — zostaniesz poinformowany/-a mailowo, jeśli się zwolni."

---

## 10. Stałe konfiguracyjne w kodzie

Wszystkie stałe w `public/js/kalendarz.js`:

| Stała | Typ | Domyślnie | Opis |
|---|---|---|---|
| `DOMYSLNY_WIDOK` | string | `'lista'` | Widok przy pierwszym wejściu (`'lista'`, `'kropki'`, `'siatka'`) |
| `PROG_WYSWIETLANIA_MIEJSC` | number | `40` | Próg % zapełnienia do pokazania liczby miejsc (0–100) |
| `POKAZ_FILTR_KATEGORII` | boolean | `true` | Czy pokazywać pasek pillsów z kategoriami |
| `OPIS_ZAJEC_TRYB` | string | `'podstrona'` | Zachowanie przycisku "Więcej informacji": `'podstrona'` (link do podstrony zajęć) lub `'modal'` (nakładka z opisem bez opuszczania kalendarza) |

---

## 11. Paleta kolorów (szablon Restraint)

CSS kalendarza używa zmiennych z `public/css/custom.css`:

| Zmienna | Wartość | Użycie |
|---|---|---|
| `--accent-color` | `#3D493A` | Przyciski "Zapisz się", aktywne pillsy |
| `--accent-secondary-color` | `#AEA17E` | Akcent drugorzędny |
| `--primary-color` | `#1E1E1E` | Tekst główny kart |
| `--text-color` | `#9C9C9C` | Tekst pomocniczy (godzina, adres) |
| `--secondary-color` | `#FAF9FA` | Tło strony |
| `--error-color` | `rgb(230, 87, 87)` | Tekst "Odwołane", błędy w modalu |

Kolory kategorii zajęć: wartości hex z tabeli `Kategorie` w Airtable — zwracane przez `terminy.js`.

---

## 12. TODO — sticky header dla `/kalendarz/` na mobile

**Problem:** na mobile gdy lista jest długa (koniec miesiąca), użytkownik musi scrollować do góry żeby przełączyć widok (lista ↔ kropki).

**Rozwiązanie:** osobny layout dla strony `/kalendarz/` z kompaktowym sticky headerem łączącym nawigację strony i kalendarza w jednym pasku.

**Zawartość sticky headera:** logo SDJ (klikalne, wraca na stronę główną) + nawigacja miesiąca (prev/next + etykieta) + ikony przełącznika widoków + hamburger menu.

**Zakres:** wymaga stworzenia osobnego layoutu `KalendarzLayout.astro` lub warunkowej modyfikacji `PageLayout.astro`. Docelowo header strony i nagłówek kalendarza to jeden element na mobile.

**Priorytet:** przed launchem — bez tego UX na mobile jest niepełny.

---

## 13. Architektura komponentów — status refaktoryzacji

Docelowy podział (wzorzec `<template>` + klonowanie JS):

| Komponent | Status | Uwagi |
|---|---|---|
| `WidokLista.astro` | ✓ zrobione | `<template id="tmpl-karta">` klonowany przez JS |
| `WidokKropki.astro` | ⏳ w kolejce | Panel dzienny z pełnymi informacjami jak karta listy |
| `WidokSiatka.astro` | ⏳ w kolejce | `<template>` dla komórki i paska |
| `PanelDetali.astro` | ⏳ w kolejce | Desktop — pod lub obok siatki (pozycja do ustalenia przy implementacji) |
| `ModalZapisu.astro` | ⏳ w kolejce | Formularz zapisu z walidacją |
