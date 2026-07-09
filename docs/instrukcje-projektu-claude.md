# Strona medytacjakrakow.pl — kontekst techniczny

Strona należy do niekomercyjnej organizacji — Stowarzyszenie Studio Dźwięku Jogi, Kraków. Właściciele: `kk` i `acyuta` (nazywani też **edytorami**). Dariusz jest technicznym współpracownikiem prowadzącym migrację. Komunikacja w języku polskim.

## Stary stack (WordPress — w trakcie wygaszania)

Hosting Zenbox (LiteSpeed, s34.zenbox.pl). Motyw CheerUp 6.0.3 (brak licencji). Modern Events Calendar Lite 6.5.6 — niezałatana luka bezpieczeństwa. Po incydencie bezpieczeństwa (22-23.06.2026) strona przywrócona z backupu, zabezpieczona Wordfence + 2FA. Decyzje właścicieli o MEC i CheerUp zdepriorityzowane — trwa migracja. Folder `/spotkania/` z plikiem `iframe-contact-form.php` poza WordPressem — wymaga przeglądu bezpieczeństwa.

## Nowy stack (w budowie)

- **Framework:** Astro 7
- **CMS:** Decap CMS (`decap-cms-app`, `decap-server`) z włączonym **Editorial Workflow** — każda zmiana przechodzi przez podgląd (Netlify Deploy Preview) przed publikacją
- **Auth:** Netlify Identity + Git Gateway
- **Repo:** `Haribol-Tech/medytacjakrakow` (publiczne, GitHub)
- **Live:** `medytacjakrakow.netlify.app`
- **Lokalnie:** `npm run cms` (port 8081) + `npm run dev` (port 4321)
- **Panel CMS:** `/admin`
- **Ważne:** `local_backend: true` tylko lokalnie — NIE w `public/admin/config.yml`
- **Widget:** `netlify-identity-widget` jako pakiet npm (nie CDN — CORS)
- **Netlify Identity:** rejestracja Invite only, Git Gateway włączony
- **Baza danych operacyjna:** Airtable (konto SDJ założone przez Dariusza, osobne od jego prywatnego konta) — harmonogramy, zapisy, prowadzący, kategorie
- **Maile transakcyjne:** MailerSend (plan Free, 500 maili/miesiąc — wystarczy dla skali SDJ; szablony maili w kodzie Netlify Function, nie w panelu MailerSend)
- **Newsletter:** MailerLite (istniejący płatny plan SDJ — tylko osoby które wyraziły zgodę na newsletter)
- **Szablon:** Restraint (ThemeForest, Bootstrap 5) zakupiony i zintegrowany. Coachi (Creative Market) — inspiracja wizualna, bez zakupu.

## Stan projektu

Szkielet strony zbudowany i działający na Netlify:
- `BaseLayout.astro` + `PageLayout.astro` z headerem, footerem, nawigacją ze szablonu Restraint
- Strona główna (`/`) — hero + lista aktualności z Astro Content Collections
- Podstrony: `/o-nas/`, `/medytacja-krakow/` (placeholder)
- Dynamiczne strony wpisów: `/[slug].astro`
- `src/content.config.ts` — kolekcje `aktualnosci` i `zajecia` (Astro 7 API)
- Decap CMS skonfigurowany (`public/admin/config.yml`)
- **Ochrona przed double content:** `netlify.toml` z nagłówkiem `X-Robots-Tag: noindex` na branch deploy i deploy preview; meta `noindex` w `BaseLayout.astro` warunkowo gdy hostname kończy się na `.netlify.app`

Specyfikacja systemu kalendarza i zapisów **w pełni opracowana** — dokument `SDJ-specyfikacja-kalendarza-v1.4.docx` w folderze `docs/` projektu.

## Architektura kalendarza i zapisów (zamknięta koncepcja)

**Podział odpowiedzialności:**
- **Decap CMS** — treść opisowa zajęć (nazwa, opis, zdjęcia, film YouTube), aktualności, strony statyczne
- **Airtable** — dane operacyjne: harmonogramy, terminy, zapisy uczestników, prowadzący, kategorie z kolorami, widoczność miesięcy
- **Netlify Functions** — API między frontendem a Airtable i MailerSend
- Jedynym elementem wspólnym Decap CMS i Airtable jest **slug** zajęć (np. `kirtan-medytacja`)

**Model danych Airtable (7 tabel) — baza założona i zweryfikowana:**
- `Kategorie` — nazwa + kolor hex do kalendarza
- `Prowadzący` — imię/nazwisko, opcjonalne zdjęcie i bio; harmonogram może mieć 1 lub 2 prowadzących
- `Zajęcia` — slug, kategoria (link), zapisy (select: aktywne/nieaktywne), limity miejsc, przypomnienie, pole `Aktywne` (wyłącznik główny)
- `Harmonogramy` — tryb (co-tydzien/co-miesiac-dzien-tygodnia/jednorazowe), godziny, miejsce, prowadzący, zapisy, limity, `Aktywny`
- `Wyjątki` — typ: `odwołane` (widoczne w kalendarzu) lub `dezaktywowane` (ukryte)
- `Widoczność miesięcy` — 24 wiersze (2 lata), checkbox `Widoczny publicznie`; bieżący i przyszłe miesiące wymagają zatwierdzenia
- `Zapisy` — imię, email, telefon, RODO, status (potwierdzony/rezerwowy/anulowany), źródło, harmonogram + data zajęć

**Netlify Functions:**
- `GET /api/terminy` — cache 60 min (ochrona limitu 1000 wywołań API Airtable/miesiąc); na czas developmentu cache wyłączony
- `POST /api/zapis` — zapis na żywo (bez cache), mail przez MailerSend

**Kalendarz UI:**
- Pełne decyzje UI/UX udokumentowane w `docs/kalendarz-ui.md` — tamten dokument jest źródłem prawdy dla implementacji komponentu
- Mobile: widok lista (domyślny) + widok kropki; Desktop: widok lista (domyślny) + widok siatka
- Karty zajęć mają dwa przyciski: "Więcej informacji" (secondary) + przycisk akcji zapisu (primary)
- Formularz zapisu jako modal (bottom sheet) — otwierany wyłącznie przez przycisk akcji zapisu
- Logika widoczności: przeszłość zawsze widoczna, bieżący i przyszłe miesiące — sprawdź tabelę `Widoczność miesięcy`
- Astro podczas budowania generuje dwa słowniki JS: `window.ZAJECIA_NAZWY` (slug → nazwa + nazwa_skrocona) i `window.ZAJECIA_OPISY` (slug → opis, używany gdy `OPIS_ZAJEC_TRYB = 'modal'`)
- Stałe konfiguracyjne w `public/js/kalendarz.js`: `DOMYSLNY_WIDOK`, `PROG_WYSWIETLANIA_MIEJSC`, `POKAZ_FILTR_KATEGORII`, `OPIS_ZAJEC_TRYB`

## Na horyzoncie (kolejność implementacji)

1. **Netlify Function** GET /api/terminy (bez cache na czas dev, cache 60 min przed launchem) ✓ gotowe
2. **Komponent kalendarza** w Astro (lista + kropki + siatka desktop)
3. **Netlify Function** POST /api/zapis + MailerSend (potwierdzenia, przypomnienia)
4. **Newsletter** — MailerLite integracja
5. **Kontakt** — Netlify Forms
6. **SEO** — przekierowania 301 w `netlify.toml`
7. **Launch** — upgrade Netlify do Personal ($9/mies.), konfiguracja MailerSend (SPF merge z Zenbox), canonical URL

## Kluczowe zasady i ograniczenia

**Netlify:**
- `local_backend: true` w produkcyjnym `config.yml` psuje CMS — tylko lokalnie
- `netlify-identity-widget` przez CDN powoduje błędy CORS — używamy pakietu npm
- Astro 7 dev server nie serwuje `index.html` z podfolderów `public/` — panel CMS w `src/pages/admin.astro`
- Free plan nie obsługuje prywatnych repo w organizacjach GitHub — repo publiczne
- **System kredytowy:** 300 kredytów/mies. (free), 1 deploy = 15 kredytów ≈ 20 deployów/mies. Development lokalnie żeby nie palić kredytów. **Editorial Workflow = 2-3 buildy na publikację** → plan Personal ($9/mies.) potrzebny od startu korzystania przez edytorów

**Airtable:**
- Konto SDJ (osobne od konta Dariusza) — dane osobowe uczestników = własność stowarzyszenia (RODO)
- Limit 1000 wywołań API/miesiąc (free) → cache 60 min w Netlify Function (wyłączony na czas dev)
- Limit 1000 rekordów/baza łącznie → okresowa archiwizacja tabeli Zapisy (eksport CSV + usunięcie starych)
- Nazwy pól z polskimi znakami diakrytycznymi (dla edytorów); w kodzie: `record.fields['Prowadzący']` — zmienne lokalne bez diakrytyków tylko z przyczyn technicznych JS

**Poczta (DNS):**
- Zenbox ma już SPF, DKIM, DMARC dla domeny medytacjakrakow.pl
- Dodanie MailerSend wymaga **scalenia** rekordów SPF w jeden (nie dodawania osobnych) — do zrobienia razem przy konfiguracji MailerSend z dostępem do panelu DNS Zenbox
- DKIM nie ma problemu z konfliktem (osobny rekord per usługa)
- Zenbox PHP dostępny jako plan B dla wysyłki maili gdyby MailerSend nie wypalił

**Decap CMS — podział treści:**
- Decap: opisy zajęć (w tym `nazwa_skrocona` — opcjonalna skrócona nazwa do widoku siatki kalendarza desktop), zdjęcia (optymalizowane przez Astro `<Image />`), filmy YouTube (tylko link)
- Airtable: wszystko operacyjne — harmonogramy, zapisy, kategorie
- Slug = jedyny element wspólny (przepisywany raz przy tworzeniu zajęć, nigdy nie zmienia)
- Astro podczas budowania strony generuje słownik `slug → { nazwa, nazwa_skrocona }` dostępny dla skryptu kalendarza jako zmienna JavaScript — frontend używa `nazwa_skrocona || nazwa` gdy `terminy.js` zwraca tylko slug