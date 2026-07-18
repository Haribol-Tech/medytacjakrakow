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

// Detekcja mobile przez dedykowany element CSS (niezawodna)
function czyMobile() {
  const el = document.getElementById('mobile-detector');
  if (!el) return window.innerWidth < 768;
  return getComputedStyle(el).display !== 'none';
}

// Widok ustalany w DOMContentLoaded gdy DOM jest gotowy
let aktualnyWidok = DOMYSLNY_WIDOK;
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

  // Ustal widok po załadowaniu DOM (czyMobile() wymaga elementu w DOM)
  const zapisanyWidok = localStorage.getItem('sdj_widok');
  const mobile = czyMobile();
  const dozwolone = mobile ? ['lista', 'kropki'] : ['lista', 'siatka'];
  aktualnyWidok = (zapisanyWidok && dozwolone.includes(zapisanyWidok))
    ? zapisanyWidok
    : DOMYSLNY_WIDOK;

  // Inicjalizuj przełącznik widoków
  renderujPrzelacznikWidokow();

  // Nawigacja
  el.prevBtn.addEventListener('click', () => zmienMiesiac(-1));
  el.nextBtn.addEventListener('click', () => zmienMiesiac(1));

  // Reaguj na zmianę rozmiaru okna — aktualizuj przełącznik widoków
  let ostatniMobile = czyMobile();
  window.addEventListener('resize', () => {
    const terazMobile = czyMobile();
    if (terazMobile !== ostatniMobile) {
      ostatniMobile = terazMobile;
      // Jeśli aktualny widok nie jest dozwolony na nowym urządzeniu — reset do listy
      const dozwolone = terazMobile ? ['lista', 'kropki'] : ['lista', 'siatka'];
      if (!dozwolone.includes(aktualnyWidok)) {
        aktualnyWidok = 'lista';
        localStorage.setItem('sdj_widok', 'lista');
      }
      renderujPrzelacznikWidokow();
      const klucz = `${aktualnyRok}-${String(aktualnyMiesiac).padStart(2, '0')}`;
      if (zaladowaneDane[klucz]) renderuj(zaladowaneDane[klucz]);
    }
  });

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
  ['widok-lista', 'widok-kropki', 'widok-siatka'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
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

  // Ukryj wszystkie widoki
  ['widok-lista', 'widok-kropki', 'widok-siatka'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });

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
  const wrapper = document.getElementById('widok-lista');
  if (!wrapper) return;

  wrapper.innerHTML = '';
  wrapper.hidden = false;

  if (terminy.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--text-color);text-align:center;padding:40px 0';
    p.textContent = 'Brak zajęć w tym miesiącu.';
    wrapper.appendChild(p);
    return;
  }

  let kartaDoSkrolowania = null;

  for (const termin of terminy) {
    const karta = tworzKarte(termin);
    if (!karta) continue;
    wrapper.appendChild(karta);

    if (terminParam && termin.id === terminParam) {
      kartaDoSkrolowania = karta;
    }
  }

  // Przewiń do właściwego miejsca
  if (kartaDoSkrolowania) {
    setTimeout(() => {
      const rect = kartaDoSkrolowania.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 120, behavior: 'smooth' });
    }, 150);
    const url = new URL(window.location);
    url.searchParams.delete('termin');
    window.history.replaceState({}, '', url);
  } else {
    przewinDoNajblizszych(wrapper, terminy);
  }
}

function przewinDoNajblizszych(wrapper, terminy) {
  // Przewijanie tylko na mobile — na desktop jest dość miejsca
  if (!czyMobile()) return;

  const dzisiajStr = new Date().toISOString().slice(0, 10);
  const karty = wrapper.querySelectorAll('.karta');

  // Szukaj najbliższych nadchodzących
  for (let i = 0; i < terminy.length; i++) {
    if (terminy[i].data >= dzisiajStr && !terminy[i].odwolane) {
      setTimeout(() => {
        const karta = karty[i];
        if (!karta) return;
        const rect = karta.getBoundingClientRect();
        const offset = window.scrollY + rect.top - 120;
        window.scrollTo({ top: offset, behavior: 'smooth' });
      }, 150);
      return;
    }
  }
}

function tworzKarte(termin) {
  const tmpl = document.getElementById('tmpl-karta');
  if (!tmpl) return null;

  const karta = tmpl.content.cloneNode(true).querySelector('.karta');
  karta.classList.toggle('odwolane', !!termin.odwolane);
  karta.dataset.terminId = termin.id;

  const nazwaInfo = pobierzNazwe(termin.slug);
  const adres = termin.miejsceNazwa || 'ul. Starowiślna 20/5, Kraków';

  // Pasek koloru
  karta.querySelector('.karta-pasek').style.background =
    termin.kategoriaKolor || 'var(--accent-secondary-color)';

  // Badge kategorii — kolor tła lekko rozbity z koloru kategorii
  const badge = karta.querySelector('.karta-badge');
  badge.textContent = termin.kategoriaNazwa || '';
  if (termin.kategoriaKolor) {
    badge.style.background = termin.kategoriaKolor + '22'; // 13% opacity
    badge.style.color = termin.kategoriaKolor;
  }

  // Data
  karta.querySelector('.karta-data').textContent = formatujDate(termin.data);

  // Nazwa
  karta.querySelector('.karta-nazwa').textContent = nazwaInfo.nazwa;

  // Godzina
  const godz = termin.godzinaStart || '';
  const koniec = termin.godzinaKoniec ? '–' + termin.godzinaKoniec : '';
  karta.querySelector('.karta-godzina').textContent = godz + koniec;

  // Adres
  karta.querySelector('.karta-miejsce').textContent = adres;

  // Prowadzący
  const prowWiersz = karta.querySelector('.karta-prowadzacy-wiersz');
  if (termin.prowadzacy?.length) {
    prowWiersz.hidden = false;
    prowWiersz.querySelector('.karta-prowadzacy').textContent = termin.prowadzacy.join(', ');
  }

  // Odwołane
  const odwInfo = karta.querySelector('.karta-odwolane-info');
  if (termin.odwolane) {
    odwInfo.hidden = false;
    if (termin.powodOdwolania) {
      odwInfo.querySelector('.karta-odwolane-tekst').textContent =
        'Odwołane — ' + termin.powodOdwolania;
    }
  }

  // Wolne miejsca
  const miejscaEl = karta.querySelector('.karta-miejsca');
  const infoMiejsca = obliczInfoMiejsca(termin);
  if (infoMiejsca) {
    miejscaEl.textContent = infoMiejsca;
    miejscaEl.hidden = false;
  }

  // Przycisk "Więcej informacji"
  const btnInfo = karta.querySelector('.btn-wiecej-info');
  if (termin.slug) {
    if (OPIS_ZAJEC_TRYB === 'podstrona') {
      btnInfo.href = '/' + termin.slug + '/?termin=' + encodeURIComponent(termin.id);
    } else {
      btnInfo.href = '#';
      btnInfo.addEventListener('click', (e) => {
        e.preventDefault();
        pokazOpisModal(termin.slug, termin.id);
      });
    }
  }

  // Przycisk akcji zapisu
  const btnAkcja = karta.querySelector('.btn-akcja');
  ustawPrzyciskAkcji(btnAkcja, termin);

  return karta;
}

function obliczInfoMiejsca(termin) {
  if (termin.odwolane || termin.zapisy === 'nieaktywne') return null;
  if (PROG_WYSWIETLANIA_MIEJSC === 100) return null;

  const wolne = termin.wolneMiejsca ?? termin.limitMiejsc;
  const zajete = (termin.limitMiejsc || 0) - wolne;
  const procent = termin.limitMiejsc > 0 ? (zajete / termin.limitMiejsc) * 100 : 0;

  if (PROG_WYSWIETLANIA_MIEJSC === 0 || procent >= PROG_WYSWIETLANIA_MIEJSC) {
    if (wolne > 0) return `Wolne: ${wolne}`;
  }
  return null;
}

function ustawPrzyciskAkcji(btn, termin) {
  if (termin.odwolane) {
    btn.remove();
    return;
  }

  if (termin.zapisy === 'nieaktywne') {
    btn.replaceWith((() => {
      const span = document.createElement('span');
      span.className = 'karta-bez-zapisow';
      span.textContent = 'Bez zapisów';
      return span;
    })());
    return;
  }

  const wolne = termin.wolneMiejsca ?? termin.limitMiejsc;
  const wolneRezerwowe = termin.wolneMiejscaRezerwowe ?? termin.limitRezerwowych;

  if (wolne > 0) {
    btn.className = 'btn-akcja btn-zapisz';
    btn.textContent = 'Zapisz się';
    btn.addEventListener('click', () => otworzModalZapisu(termin.id, false));
  } else if (wolneRezerwowe > 0) {
    btn.className = 'btn-akcja btn-rezerwowa';
    btn.textContent = 'Lista rezerwowa';
    btn.addEventListener('click', () => otworzModalZapisu(termin.id, true));
  } else {
    btn.replaceWith((() => {
      const span = document.createElement('span');
      span.className = 'karta-zapisy-zamkniete';
      span.textContent = 'Zapisy zamknięte';
      return span;
    })());
  }
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

// renderujPrzyciskWiecejInfo i renderujPrzyciskZapisu zastąpione przez ustawPrzyciskAkcji w tworzKarte()

// Pomocnicze — tworzą przyciski jako elementy DOM (dla widoków kropki i siatki)
function tworzBtnInfo(termin) {
  const btn = document.createElement('a');
  btn.className = 'btn-wiecej-info';
  btn.textContent = 'Informacje';
  if (termin.slug) {
    if (OPIS_ZAJEC_TRYB === 'podstrona') {
      btn.href = '/' + termin.slug + '/?termin=' + encodeURIComponent(termin.id);
    } else {
      btn.href = '#';
      btn.addEventListener('click', (e) => { e.preventDefault(); pokazOpisModal(termin.slug, termin.id); });
    }
  }
  return btn;
}

function tworzBtnAkcji(termin) {
  if (termin.odwolane) return null;
  if (termin.zapisy === 'nieaktywne') {
    const span = document.createElement('span');
    span.className = 'karta-bez-zapisow';
    span.textContent = 'Bez zapisów';
    return span;
  }
  const wolne = termin.wolneMiejsca ?? termin.limitMiejsc;
  const wolneRez = termin.wolneMiejscaRezerwowe ?? termin.limitRezerwowych;
  if (wolne > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn-akcja btn-zapisz';
    btn.textContent = 'Zapisz się';
    btn.addEventListener('click', () => otworzModalZapisu(termin.id, false));
    return btn;
  } else if (wolneRez > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn-akcja btn-rezerwowa';
    btn.textContent = 'Lista rezerwowa';
    btn.addEventListener('click', () => otworzModalZapisu(termin.id, true));
    return btn;
  }
  const span = document.createElement('span');
  span.className = 'karta-zapisy-zamkniete';
  span.textContent = 'Zapisy zamknięte';
  return span;
}

/* ============================================================
   WIDOK KROPKI (mobile)
   ============================================================ */
function renderujKropki(terminy) {
  const wrapper = document.getElementById('widok-kropki');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  wrapper.hidden = false;

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

    const kropka = document.createElement('div');
    kropka.className = 'mini-karta-kropka';
    kropka.style.background = termin.kategoriaKolor || 'var(--accent-secondary-color)';
    miniKarta.appendChild(kropka);

    const info = document.createElement('div');
    info.className = 'mini-karta-info';

    const nazwa = document.createElement('div');
    nazwa.className = 'mini-karta-nazwa';
    nazwa.textContent = nazwaInfo.nazwa;
    info.appendChild(nazwa);

    const godz = document.createElement('div');
    godz.className = 'mini-karta-godzina';
    godz.textContent = (termin.godzinaStart || '') + (termin.godzinaKoniec ? '–' + termin.godzinaKoniec : '');
    info.appendChild(godz);

    const stopka = document.createElement('div');
    stopka.className = 'mini-karta-stopka';
    stopka.appendChild(tworzBtnInfo(termin));
    const btnAkcji = tworzBtnAkcji(termin);
    if (btnAkcji) stopka.appendChild(btnAkcji);
    info.appendChild(stopka);

    miniKarta.appendChild(info);
    panel.appendChild(miniKarta);
  }
}

/* ============================================================
   WIDOK SIATKA (desktop)
   ============================================================ */
function renderujSiatke(terminy) {
  const wrapper = document.getElementById('widok-siatka');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  wrapper.hidden = false;

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
}

function pokazPanelSiatki(panel, termin) {
  const nazwaInfo = pobierzNazwe(termin.slug);
  const adres = termin.miejsceNazwa || 'ul. Starowiślna 20/5, Kraków';

  panel.className = 'siatka-panel-detali widoczny';
  panel.innerHTML = '';

  const pNazwa = document.createElement('h3');
  pNazwa.className = 'siatka-panel-nazwa';
  pNazwa.textContent = nazwaInfo.nazwa;
  panel.appendChild(pNazwa);

  const pData = document.createElement('div');
  pData.className = 'siatka-panel-info';
  pData.textContent = formatujDate(termin.data) + ', ' + (termin.godzinaStart || '') + (termin.godzinaKoniec ? '–' + termin.godzinaKoniec : '');
  panel.appendChild(pData);

  const pAdres = document.createElement('div');
  pAdres.className = 'siatka-panel-info';
  pAdres.textContent = adres;
  panel.appendChild(pAdres);

  if (termin.prowadzacy?.length) {
    const pProw = document.createElement('div');
    pProw.className = 'siatka-panel-info';
    pProw.textContent = termin.prowadzacy.join(', ');
    panel.appendChild(pProw);
  }

  if (termin.odwolane) {
    const pOdw = document.createElement('div');
    pOdw.style.cssText = 'color:var(--error-color);font-size:0.85rem;font-weight:600;margin-top:4px';
    pOdw.textContent = 'Odwołane';
    panel.appendChild(pOdw);
  }

  const pStopka = document.createElement('div');
  pStopka.className = 'siatka-panel-stopka';
  pStopka.appendChild(tworzBtnInfo(termin));
  const btnAkcji = tworzBtnAkcji(termin);
  if (btnAkcji) pStopka.appendChild(btnAkcji);
  panel.appendChild(pStopka);

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   PRZEŁĄCZNIK WIDOKÓW
   ============================================================ */
function renderujPrzelacznikWidokow() {
  el.widokPrzelacznik.innerHTML = '';
  const isMobile = czyMobile();

  const widoki = isMobile
    ? [{ id: 'lista', label: 'Lista' }, { id: 'kropki', label: 'Kropki' }]
    : [{ id: 'lista', label: 'Lista' }, { id: 'siatka', label: 'Siatka' }];

  const IKONY = {
    'lista': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>',
    'kropki': '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="8" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><circle cx="5" cy="16" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="19" cy="16" r="2"/></svg>',
    'siatka': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  };

  for (const w of widoki) {
    const btn = document.createElement('button');
    btn.className = 'widok-btn' + (aktualnyWidok === w.id ? ' aktywny' : '');
    btn.innerHTML = IKONY[w.id] || w.label;
    btn.setAttribute('aria-label', w.label);
    btn.title = w.label;
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
