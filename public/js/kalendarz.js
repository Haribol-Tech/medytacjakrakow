/* ============================================================
   KALENDARZ SDJ — logika UI
   ============================================================ */

/* ---- Stałe konfiguracyjne ---- */
const DOMYSLNY_WIDOK = 'lista';         // 'lista' | 'kropki' (mobile) | 'siatka' (desktop)
const PROG_WYSWIETLANIA_MIEJSC = 40;    // 0 = zawsze pokazuj, 100 = nigdy, 40 = gdy ≥40% zajęte
const POKAZ_FILTR_KATEGORII = true;     // true | false
const OPIS_ZAJEC_TRYB = 'podstrona';    // 'podstrona' | 'modal'

/* ---- Nazwy miesięcy i dni (dopełniacz) ---- */
const MIESIACE_MIANOWNIK = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'
];
const MIESIACE_DOPELNIACZ = [
  'stycznia','lutego','marca','kwietnia','maja','czerwca',
  'lipca','sierpnia','września','października','listopada','grudnia'
];
const DNI_TYGODNIA_MIANOWNIK = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
const DNI_TYGODNIA_KROTKIE = ['Nd','Pn','Wt','Śr','Czw','Pt','Sb'];

/* ---- Stan aplikacji ---- */
let aktualnyRok = new Date().getFullYear();
let aktualnyMiesiac = new Date().getMonth() + 1; // 1-12

// Ustal widok z localStorage z walidacją per urządzenie
function ustalWidokPoczatkowy() {
  const zapisany = localStorage.getItem('sdj_widok');
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const dozwolone = isMobile ? ['lista', 'kropki'] : ['lista', 'siatka'];
  if (zapisany && dozwolone.includes(zapisany)) return zapisany;
  return DOMYSLNY_WIDOK;
}
let aktualnyWidok = ustalWidokPoczatkowy();
let aktualnaKategoria = null; // null = wszystkie
let zaladowaneDane = {}; // cache danych per miesiac: 'YYYY-MM' → terminy[]
let ladowanie = false;

/* ---- Elementy DOM ---- */
const el = {
  miesiacLabel: document.getElementById('kalendarz-miesiac-label'),
  prevBtn: document.getElementById('prev-miesiac'),
  nextBtn: document.getElementById('next-miesiac'),
  widokPrzelacznik: document.getElementById('kalendarz-widok-przelacznik'),
  filtr: document.getElementById('kalendarz-filtr'),
  content: document.getElementById('kalendarz-content'),
  skeleton: document.getElementById('kalendarz-skeleton'),
  blad: document.getElementById('kalendarz-blad'),
  modalOverlay: document.getElementById('zapis-modal-overlay'),
  modalTytul: document.getElementById('zapis-modal-tytul'),
  modalBody: document.getElementById('zapis-modal-body'),
  modalZamknij: document.getElementById('zapis-modal-zamknij'),
};

/* ============================================================
   INICJALIZACJA
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Sprawdź czy URL ma parametr termin (powrót z podstrony zajęć)
  const params = new URLSearchParams(window.location.search);
  const terminParam = params.get('termin');

  // Inicjalizuj przełącznik widoków
  renderujPrzelacznikWidokow();

  // Nawigacja
  el.prevBtn.addEventListener('click', () => zmienMiesiac(-1));
  el.nextBtn.addEventListener('click', () => zmienMiesiac(1));

  // Zamknięcie modalu
  el.modalZamknij.addEventListener('click', zamknijModal);
  el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) zamknijModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') zamknijModal();
  });

  // Załaduj dane i renderuj
  zaladujIRenderuj(terminParam);
});

/* ============================================================
   ŁADOWANIE DANYCH
   ============================================================ */
async function zaladujIRenderuj(terminParam = null) {
  const klucz = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}`;

  if (zaladowaneDane[klucz]) {
    renderuj(zaladowaneDane[klucz], terminParam);
    return;
  }

  pokazSkeleton();

  try {
    const url = `/api/terminy?rok=${aktualnyRok}&miesiac=${aktualnyMiesiac}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dane = await res.json();
    zaladowaneDane[klucz] = dane.terminy ?? [];
    renderuj(zaladowaneDane[klucz], terminParam);
  } catch (err) {
    console.error('Błąd ładowania kalendarza:', err);
    pokazBlad();
  }
}

function pokazSkeleton() {
  el.skeleton.hidden = false;
  el.blad.hidden = true;
  el.content.innerHTML = '';
  el.content.appendChild(el.skeleton);
}

function pokazBlad() {
  el.skeleton.hidden = true;
  el.blad.hidden = false;
}

/* ============================================================
   RENDEROWANIE GŁÓWNE
   ============================================================ */
function renderuj(terminy, terminParam = null) {
  el.skeleton.hidden = true;
  el.blad.hidden = true;

  // Zaktualizuj etykietę miesiąca
  el.miesiacLabel.textContent = `${MIESIACE_MIANOWNIK[aktualnyMiesiac - 1]} ${aktualnyRok}`;

  // Filtr kategorii
  if (POKAZ_FILTR_KATEGORII) {
    renderujFiltr(terminy);
  }

  // Filtruj po kategorii
  const przefiltrowane = aktualnaKategoria
    ? terminy.filter(t => t.kategoriaNazwa === aktualnaKategoria)
    : terminy;

  // Renderuj odpowiedni widok
  el.content.innerHTML = '';

  if (aktualnyWidok === 'lista') {
    renderujListe(przefiltrowane, terminParam);
  } else if (aktualnyWidok === 'kropki') {
    renderujKropki(przefiltrowane);
  } else if (aktualnyWidok === 'siatka') {
    renderujSiatke(przefiltrowane);
  }
}

/* ============================================================
   FILTR KATEGORII
   ============================================================ */
function renderujFiltr(terminy) {
  const kategorie = [...new Set(
    terminy.map(t => t.kategoriaNazwa).filter(Boolean)
  )].sort();

  if (kategorie.length === 0) {
    el.filtr.hidden = true;
    return;
  }

  el.filtr.hidden = false;
  el.filtr.innerHTML = '';

  const wszystkieBtn = document.createElement('button');
  wszystkieBtn.className = 'filtr-pill' + (aktualnaKategoria === null ? ' aktywny' : '');
  wszystkieBtn.textContent = 'Wszystkie';
  wszystkieBtn.addEventListener('click', () => {
    aktualnaKategoria = null;
    zaladujIRenderuj();
  });
  el.filtr.appendChild(wszystkieBtn);

  for (const kat of kategorie) {
    const btn = document.createElement('button');
    btn.className = 'filtr-pill' + (aktualnaKategoria === kat ? ' aktywny' : '');
    btn.textContent = kat;
    btn.addEventListener('click', () => {
      aktualnaKategoria = kat;
      zaladujIRenderuj();
    });
    el.filtr.appendChild(btn);
  }
}

/* ============================================================
   WIDOK LISTA
   ============================================================ */
function renderujListe(terminy, terminParam = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'lista-widok';

  if (terminy.length === 0) {
    wrapper.innerHTML = '<p style="color:var(--text-color);text-align:center;padding:40px 0">Brak zajęć w tym miesiącu.</p>';
    el.content.appendChild(wrapper);
    return;
  }

  let kartaDoSkrolowania = null;

  for (const termin of terminy) {
    const karta = tworzKarte(termin);
    wrapper.appendChild(karta);

    // Zaznacz kartę do przewinięcia (termin z URL lub najbliższe zajęcia)
    if (terminParam && termin.id === terminParam) {
      kartaDoSkrolowania = karta;
    }
  }

  el.content.appendChild(wrapper);

  // Przewiń do właściwego miejsca
  if (kartaDoSkrolowania) {
    setTimeout(() => kartaDoSkrolowania.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    // Wyczyść parametr z URL bez przeładowania strony
    const url = new URL(window.location);
    url.searchParams.delete('termin');
    window.history.replaceState({}, '', url);
  } else {
    przewinDoNajblizszych(wrapper, terminy);
  }
}

function przewinDoNajblizszych(wrapper, terminy) {
  const dzisiajStr = new Date().toISOString().slice(0, 10);
  const karty = wrapper.querySelectorAll('.karta');

  // Szukaj najbliższych nadchodzących
  for (let i = 0; i < terminy.length; i++) {
    if (terminy[i].data >= dzisiajStr && !terminy[i].odwolane) {
      setTimeout(() => {
        const karta = karty[i];
        if (!karta) return;
        // Przewiń stronę tak żeby karta była w górnej części widoku z marginesem
        const rect = karta.getBoundingClientRect();
        const offset = window.scrollY + rect.top - 120; // 120px od górnej krawędzi okna
        window.scrollTo({ top: offset, behavior: 'smooth' });
      }, 150);
      return;
    }
  }
  // Jeśli nie ma nadchodzących — zostań na górze
}

function tworzKarte(termin) {
  const karta = document.createElement('div');
  karta.className = 'karta' + (termin.odwolane ? ' odwolane' : '');
  karta.dataset.terminId = termin.id;

  const nazwaInfo = pobierzNazwe(termin.slug);
  const dataFormatowana = formatujDate(termin.data);
  const adres = termin.miejsceNazwa || 'ul. Starowiślna 20/5, Kraków';

  karta.innerHTML = `
    <div class="karta-kolor" style="background:${termin.kategoriaKolor || 'var(--accent-secondary-color)'}"></div>
    <div class="karta-body">
      <h3 class="karta-nazwa">${nazwaInfo.nazwa}</h3>
      <div class="karta-data">${dataFormatowana}</div>
      <div class="karta-godzina">${termin.godzinaStart || ''}${termin.godzinaKoniec ? '–' + termin.godzinaKoniec : ''}</div>
      <div class="karta-miejsce">${adres}</div>
      ${termin.prowadzacy?.length ? `<div class="karta-prowadzacy">${termin.prowadzacy.join(', ')}</div>` : ''}
      ${termin.odwolane ? '<div class="karta-odwolane-etykieta">Odwołane</div>' : ''}
      ${renderujInfoMiejsca(termin)}
      <div class="karta-stopka">
        ${renderujPrzyciskWiecejInfo(termin)}
        ${renderujPrzyciskZapisu(termin)}
      </div>
    </div>
  `;

  return karta;
}

function renderujInfoMiejsca(termin) {
  if (termin.odwolane || termin.zapisy === 'nieaktywne') return '';
  if (PROG_WYSWIETLANIA_MIEJSC === 100) return '';

  const zajete = termin.limitMiejsc - (termin.wolneMiejsca ?? termin.limitMiejsc);
  const procent = termin.limitMiejsc > 0 ? (zajete / termin.limitMiejsc) * 100 : 0;

  if (PROG_WYSWIETLANIA_MIEJSC === 0 || procent >= PROG_WYSWIETLANIA_MIEJSC) {
    const wolne = termin.wolneMiejsca ?? termin.limitMiejsc;
    if (wolne > 0) {
      return `<div class="karta-miejsca">Wolne miejsca: ${wolne}</div>`;
    }
  }
  return '';
}

function renderujPrzyciskWiecejInfo(termin) {
  const slug = termin.slug;
  if (!slug) return '';

  if (OPIS_ZAJEC_TRYB === 'podstrona') {
    const powrotParam = `?termin=${encodeURIComponent(termin.id)}`;
    return `<a href="/${slug}/${powrotParam}" class="btn-wiecej-info">Więcej informacji</a>`;
  } else {
    return `<button class="btn-wiecej-info" onclick="pokazOpisModal('${slug}', '${termin.id}')">Więcej informacji</button>`;
  }
}

function renderujPrzyciskZapisu(termin) {
  if (termin.odwolane) return '';

  if (termin.zapisy === 'nieaktywne') {
    return '<span class="karta-bez-zapisow">Bez zapisów</span>';
  }

  const wolne = termin.wolneMiejsca ?? termin.limitMiejsc;
  const wolneRezerwowe = termin.wolneMiejscaRezerwowe ?? termin.limitRezerwowych;

  if (wolne > 0) {
    return `<button class="btn-zapisz" onclick="otworzModalZapisu('${termin.id}', false)">Zapisz się</button>`;
  } else if (wolneRezerwowe > 0) {
    return `<button class="btn-rezerwowa" onclick="otworzModalZapisu('${termin.id}', true)">Lista rezerwowa</button>`;
  } else {
    return '<span class="karta-zapisy-zamkniete">Zapisy zamknięte</span>';
  }
}

/* ============================================================
   WIDOK KROPKI (mobile)
   ============================================================ */
function renderujKropki(terminy) {
  const wrapper = document.createElement('div');
  wrapper.className = 'kropki-widok';

  // Siatka miesięczna
  const siatka = document.createElement('div');
  siatka.className = 'kropki-siatka';

  // Nagłówki dni tygodnia (Pn-Nd)
  const dniKolejnosc = ['Pn','Wt','Śr','Czw','Pt','Sb','Nd'];
  for (const dzien of dniKolejnosc) {
    const h = document.createElement('div');
    h.className = 'kropki-naglowek-dzien';
    h.textContent = dzien;
    siatka.appendChild(h);
  }

  // Komórki dni
  const pierwszyDzien = new Date(aktualnyRok, aktualnyMiesiac - 1, 1);
  const ostatniDzien = new Date(aktualnyRok, aktualnyMiesiac, 0).getDate();
  // Dostosuj: w JS 0=Nd, chcemy 0=Pn
  let startOffset = pierwszyDzien.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  // Puste komórki przed pierwszym dniem
  for (let i = 0; i < startOffset; i++) {
    siatka.appendChild(document.createElement('div'));
  }

  const dzisiaj = new Date();
  const dzisiajStr = dzisiaj.toISOString().slice(0, 10);

  // Grupuj terminy po dacie
  const terminyPerDzien = {};
  for (const t of terminy) {
    if (!terminyPerDzien[t.data]) terminyPerDzien[t.data] = [];
    terminyPerDzien[t.data].push(t);
  }

  // Panel dzienny
  const panel = document.createElement('div');
  panel.className = 'kropki-panel-dzienny';

  let aktywnaData = null;

  for (let d = 1; d <= ostatniDzien; d++) {
    const dataStr = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const termineDnia = terminyPerDzien[dataStr] ?? [];
    const maDnia = termineDnia.length > 0;

    const komorka = document.createElement('div');
    komorka.className = 'kropki-komorka' + (maDnia ? ' ma-zajecia' : '') + (dataStr === dzisiajStr ? ' dzisiaj' : '');
    komorka.dataset.data = dataStr;

    const num = document.createElement('div');
    num.className = 'kropki-dzien-num';
    num.textContent = d;
    komorka.appendChild(num);

    if (maDnia) {
      const dots = document.createElement('div');
      dots.className = 'kropki-dots';
      for (const t of termineDnia) {
        const dot = document.createElement('div');
        dot.className = 'kropka';
        dot.style.background = t.kategoriaKolor || 'var(--accent-secondary-color)';
        dots.appendChild(dot);
      }
      komorka.appendChild(dots);

      komorka.addEventListener('click', () => {
        // Usuń aktywną klasę z poprzedniej
        siatka.querySelectorAll('.aktywna').forEach(el => el.classList.remove('aktywna'));
        komorka.classList.add('aktywna');
        aktywnaData = dataStr;
        renderujPanelDzienny(panel, termineDnia, dataStr);
      });
    }

    siatka.appendChild(komorka);

    // Ustaw domyślnie aktywny dzień (dzisiaj lub najbliższy z zajęciami)
    if (!aktywnaData && maDnia && dataStr >= dzisiajStr) {
      aktywnaData = dataStr;
      komorka.classList.add('aktywna');
    }
  }

  wrapper.appendChild(siatka);
  wrapper.appendChild(panel);
  el.content.appendChild(wrapper);

  // Renderuj panel dla domyślnego dnia
  if (aktywnaData && terminyPerDzien[aktywnaData]) {
    renderujPanelDzienny(panel, terminyPerDzien[aktywnaData], aktywnaData);
  }
}

function renderujPanelDzienny(panel, terminy, dataStr) {
  panel.innerHTML = '';
  const naglowek = document.createElement('div');
  naglowek.style.cssText = 'font-size:0.85rem;color:var(--text-color);margin-bottom:8px;';
  naglowek.textContent = formatujDate(dataStr);
  panel.appendChild(naglowek);

  for (const termin of terminy) {
    const nazwaInfo = pobierzNazwe(termin.slug);
    const miniKarta = document.createElement('div');
    miniKarta.className = 'mini-karta';
    miniKarta.innerHTML = `
      <div class="mini-karta-kropka" style="background:${termin.kategoriaKolor || 'var(--accent-secondary-color)'}"></div>
      <div class="mini-karta-info">
        <div class="mini-karta-nazwa">${nazwaInfo.nazwa}</div>
        <div class="mini-karta-godzina">${termin.godzinaStart || ''}${termin.godzinaKoniec ? '–' + termin.godzinaKoniec : ''}</div>
        <div class="mini-karta-stopka">
          ${renderujPrzyciskWiecejInfo(termin)}
          ${renderujPrzyciskZapisu(termin)}
        </div>
      </div>
    `;
    panel.appendChild(miniKarta);
  }
}

/* ============================================================
   WIDOK SIATKA (desktop)
   ============================================================ */
function renderujSiatke(terminy) {
  const wrapper = document.createElement('div');
  wrapper.className = 'siatka-widok';

  // Nagłówki dni tygodnia
  const naglowek = document.createElement('div');
  naglowek.className = 'siatka-naglowek';
  const dniKolejnosc = ['Pn','Wt','Śr','Czw','Pt','Sb','Nd'];
  for (const d of dniKolejnosc) {
    const h = document.createElement('div');
    h.className = 'siatka-naglowek-dzien';
    h.textContent = d;
    naglowek.appendChild(h);
  }
  wrapper.appendChild(naglowek);

  // Siatka komórek
  const grid = document.createElement('div');
  grid.className = 'siatka-grid';

  const pierwszyDzien = new Date(aktualnyRok, aktualnyMiesiac - 1, 1);
  const ostatniDzien = new Date(aktualnyRok, aktualnyMiesiac, 0).getDate();
  let startOffset = pierwszyDzien.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const dzisiajStr = new Date().toISOString().slice(0, 10);

  // Grupuj terminy po dacie
  const terminyPerDzien = {};
  for (const t of terminy) {
    if (!terminyPerDzien[t.data]) terminyPerDzien[t.data] = [];
    terminyPerDzien[t.data].push(t);
  }

  // Panel detali
  const panel = document.createElement('div');
  panel.className = 'siatka-panel-detali';

  // Puste komórki przed pierwszym dniem
  for (let i = 0; i < startOffset; i++) {
    const pusta = document.createElement('div');
    pusta.className = 'siatka-komorka inny-miesiac';
    grid.appendChild(pusta);
  }

  for (let d = 1; d <= ostatniDzien; d++) {
    const dataStr = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const termineDnia = terminyPerDzien[dataStr] ?? [];

    const komorka = document.createElement('div');
    komorka.className = 'siatka-komorka' + (dataStr === dzisiajStr ? ' dzisiaj' : '');

    const numEl = document.createElement('div');
    numEl.className = 'siatka-dzien-num';
    numEl.textContent = d;
    komorka.appendChild(numEl);

    if (termineDnia.length === 1) {
      komorka.classList.add('ma-jedno-zajecie');
      komorka.addEventListener('click', () => pokazPanelSiatki(panel, termineDnia[0]));
    }

    if (termineDnia.length > 0) {
      const paski = document.createElement('div');
      paski.className = 'siatka-paski';

      for (const termin of termineDnia) {
        const nazwaInfo = pobierzNazwe(termin.slug);
        const tekst = nazwaInfo.nazwa_skrocona || nazwaInfo.nazwa;
        const pasek = document.createElement('div');
        pasek.className = 'siatka-pasek';
        pasek.style.background = termin.kategoriaKolor || 'var(--accent-color)';
        pasek.textContent = tekst;

        if (termineDnia.length > 1) {
          pasek.addEventListener('click', (e) => {
            e.stopPropagation();
            pokazPanelSiatki(panel, termin);
          });
        }

        paski.appendChild(pasek);
      }
      komorka.appendChild(paski);
    }

    grid.appendChild(komorka);
  }

  wrapper.appendChild(grid);
  wrapper.appendChild(panel);
  el.content.appendChild(wrapper);
}

function pokazPanelSiatki(panel, termin) {
  const nazwaInfo = pobierzNazwe(termin.slug);
  const adres = termin.miejsceNazwa || 'ul. Starowiślna 20/5, Kraków';

  panel.className = 'siatka-panel-detali widoczny';
  panel.innerHTML = `
    <h3 class="siatka-panel-nazwa">${nazwaInfo.nazwa}</h3>
    <div class="siatka-panel-info">${formatujDate(termin.data)}, ${termin.godzinaStart || ''}${termin.godzinaKoniec ? '–' + termin.godzinaKoniec : ''}</div>
    <div class="siatka-panel-info">${adres}</div>
    ${termin.prowadzacy?.length ? `<div class="siatka-panel-info">${termin.prowadzacy.join(', ')}</div>` : ''}
    ${termin.odwolane ? `<div style="color:var(--error-color);font-size:0.85rem;font-weight:600;margin-top:4px">Odwołane</div>` : ''}
    <div class="siatka-panel-stopka">
      ${renderujPrzyciskWiecejInfo(termin)}
      ${renderujPrzyciskZapisu(termin)}
    </div>
  `;

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   PRZEŁĄCZNIK WIDOKÓW
   ============================================================ */
function renderujPrzelacznikWidokow() {
  el.widokPrzelacznik.innerHTML = '';
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  const widoki = isMobile
    ? [{ id: 'lista', label: 'Lista' }, { id: 'kropki', label: 'Kropki' }]
    : [{ id: 'lista', label: 'Lista' }, { id: 'siatka', label: 'Siatka' }];

  for (const w of widoki) {
    const btn = document.createElement('button');
    btn.className = 'widok-btn' + (aktualnyWidok === w.id ? ' aktywny' : '');
    btn.textContent = w.label;
    btn.addEventListener('click', () => {
      aktualnyWidok = w.id;
      localStorage.setItem('sdj_widok', w.id);
      renderujPrzelacznikWidokow();
      const klucz = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}`;
      if (zaladowaneDane[klucz]) renderuj(zaladowaneDane[klucz]);
    });
    el.widokPrzelacznik.appendChild(btn);
  }
}

/* ============================================================
   NAWIGACJA MIĘDZY MIESIĄCAMI
   ============================================================ */
function zmienMiesiac(kierunek) {
  aktualnyMiesiac += kierunek;
  if (aktualnyMiesiac > 12) { aktualnyMiesiac = 1; aktualnyRok++; }
  if (aktualnyMiesiac < 1) { aktualnyMiesiac = 12; aktualnyRok--; }
  zaladujIRenderuj();
}

/* ============================================================
   MODAL ZAPISU
   ============================================================ */
window.otworzModalZapisu = function(terminId, czyRezerwowa) {
  // Znajdź termin w załadowanych danych
  const klucz = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}`;
  const terminy = zaladowaneDane[klucz] ?? [];
  const termin = terminy.find(t => t.id === terminId);
  if (!termin) return;

  const nazwaInfo = pobierzNazwe(termin.slug);
  el.modalTytul.textContent = `${nazwaInfo.nazwa} — ${formatujDate(termin.data)}`;

  el.modalBody.innerHTML = '';

  if (czyRezerwowa) {
    const info = document.createElement('div');
    info.className = 'zapis-info-rezerwowa';
    info.textContent = 'Wpisujesz się na listę rezerwową. Miejsce nie jest gwarantowane — zostaniesz poinformowany/-a mailowo, jeśli się zwolni.';
    el.modalBody.appendChild(info);
  }

  const blad = document.createElement('div');
  blad.className = 'zapis-blad-komunikat';
  blad.id = 'zapis-blad-komunikat';

  const form = document.createElement('div');
  form.className = 'zapis-form';
  form.innerHTML = `
    <div class="zapis-form-pole">
      <label for="zapis-imie">Imię *</label>
      <input type="text" id="zapis-imie" required autocomplete="given-name">
    </div>
    <div class="zapis-form-pole">
      <label for="zapis-email">Adres e-mail *</label>
      <input type="email" id="zapis-email" required autocomplete="email">
    </div>
    <div class="zapis-form-pole">
      <label for="zapis-telefon">Telefon (opcjonalnie)</label>
      <input type="tel" id="zapis-telefon" autocomplete="tel">
    </div>
    <label class="zapis-form-checkbox">
      <input type="checkbox" id="zapis-pierwszyraz">
      Nie byłam/-em jeszcze w SDJ — to będzie moja pierwsza wizyta
    </label>
    <div class="zapis-form-pole">
      <label for="zapis-uwagi">Uwagi (opcjonalnie)</label>
      <textarea id="zapis-uwagi" rows="3"></textarea>
    </div>
    <label class="zapis-form-checkbox">
      <input type="checkbox" id="zapis-newsletter">
      Chcę otrzymywać newsletter SDJ
    </label>
    <label class="zapis-form-checkbox">
      <input type="checkbox" id="zapis-rodo" required>
      Wyrażam zgodę na przetwarzanie moich danych osobowych przez Stowarzyszenie Studio Dźwięku Jogi w celu realizacji zapisu na zajęcia. *
    </label>
    <button class="btn-wyslij" id="btn-wyslij-zapis">Wyślij zgłoszenie</button>
  `;

  el.modalBody.appendChild(blad);
  el.modalBody.appendChild(form);

  document.getElementById('btn-wyslij-zapis').addEventListener('click', () => {
    wyslijZapis(termin, czyRezerwowa);
  });

  el.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
};

async function wyslijZapis(termin, czyRezerwowa) {
  const imie = document.getElementById('zapis-imie')?.value.trim();
  const email = document.getElementById('zapis-email')?.value.trim();
  const rodo = document.getElementById('zapis-rodo')?.checked;
  const bladKomunikat = document.getElementById('zapis-blad-komunikat');
  const btnWyslij = document.getElementById('btn-wyslij-zapis');

  // Walidacja
  if (!imie || !email) {
    bladKomunikat.textContent = 'Wypełnij imię i adres e-mail.';
    bladKomunikat.classList.add('widoczny');
    return;
  }
  if (!rodo) {
    bladKomunikat.textContent = 'Zgoda RODO jest wymagana.';
    bladKomunikat.classList.add('widoczny');
    return;
  }

  bladKomunikat.classList.remove('widoczny');
  btnWyslij.disabled = true;
  btnWyslij.textContent = 'Wysyłanie...';

  const dane = {
    imie,
    email,
    telefon: document.getElementById('zapis-telefon')?.value.trim() || '',
    pierwszyRaz: document.getElementById('zapis-pierwszyraz')?.checked ?? false,
    uwagi: document.getElementById('zapis-uwagi')?.value.trim() || '',
    newsletter: document.getElementById('zapis-newsletter')?.checked ?? false,
    rodo: true,
    harmonogramId: termin.harmonogramId,
    dataZajec: termin.data,
    czyRezerwowa,
  };

  try {
    const res = await fetch('/api/zapis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dane),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    pokazSukcesModalu(email);
  } catch (err) {
    console.error('Błąd zapisu:', err);
    bladKomunikat.textContent = 'Wystąpił błąd. Spróbuj ponownie lub skontaktuj się z nami telefonicznie.';
    bladKomunikat.classList.add('widoczny');
    btnWyslij.disabled = false;
    btnWyslij.textContent = 'Wyślij zgłoszenie';
  }
}

function pokazSukcesModalu(email) {
  el.modalBody.innerHTML = `
    <div class="zapis-sukces">
      <div class="zapis-sukces-ikona">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="zapis-sukces-tekst">
        Zgłoszenie wysłane!<br>Potwierdzenie otrzymasz na adres<br><strong>${email}</strong>
      </div>
      <button class="btn-zamknij-sukces" onclick="zamknijModal()">Zamknij</button>
    </div>
  `;
}

window.zamknijModal = function() {
  el.modalOverlay.hidden = true;
  document.body.style.overflow = '';
};

/* ============================================================
   MODAL OPISU ZAJĘĆ (tryb 'modal')
   ============================================================ */
window.pokazOpisModal = function(slug, terminId) {
  const opis = window.ZAJECIA_OPISY?.[slug];
  const nazwa = window.ZAJECIA_NAZWY?.[slug];
  if (!opis && !nazwa) return;

  el.modalTytul.textContent = nazwa?.nazwa || slug;
  el.modalBody.innerHTML = `
    ${opis?.zdjecie ? `<img src="${opis.zdjecie}" alt="${nazwa?.nazwa || ''}" style="width:100%;border-radius:6px;margin-bottom:16px">` : ''}
    <div style="font-size:0.9rem;color:var(--text-color);line-height:1.6;margin-bottom:20px">${opis?.opis || ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-zapisz" onclick="zamknijModal();otworzModalZapisu('${terminId}', false)">Zapisz się</button>
    </div>
  `;

  el.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
};

/* ============================================================
   POMOCNICZE
   ============================================================ */
function pobierzNazwe(slug) {
  const slownik = window.ZAJECIA_NAZWY ?? {};
  return slownik[slug] ?? { nazwa: slug, nazwa_skrocona: '' };
}

function formatujDate(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr + 'T00:00:00');
  const dzien = DNI_TYGODNIA_MIANOWNIK[d.getDay()];
  const miesiac = MIESIACE_DOPELNIACZ[d.getMonth()];
  return `${dzien}, ${d.getDate()} ${miesiac}`;
}
