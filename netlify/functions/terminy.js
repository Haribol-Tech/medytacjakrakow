/**
 * GET /api/terminy
 *
 * Zwraca listę terminów zajęć dla bieżącego i 2 kolejnych miesięcy.
 * Cache wyłączony na czas developmentu — przed launchem włączyć cache 60 min.
 *
 * Logika widoczności (zgodna ze specyfikacją SDJ v1.3):
 * - Terminy z przeszłości: zawsze widoczne
 * - Bieżący miesiąc i przyszłe: tylko jeśli Widoczny publicznie = true w tabeli Widoczność miesięcy
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_API = 'https://api.airtable.com/v0';

// Pobiera wszystkie rekordy z tabeli (obsługuje paginację Airtable)
async function fetchAll(tabela, params = {}) {
  const rekordy = [];
  let offset = null;

  do {
    const query = new URLSearchParams(params);
    if (offset) query.set('offset', offset);

    const res = await fetch(`${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent(tabela)}?${query}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      const blad = await res.text();
      throw new Error(`Airtable error (${tabela}): ${res.status} ${blad}`);
    }

    const dane = await res.json();
    rekordy.push(...dane.records);
    offset = dane.offset ?? null;
  } while (offset);

  return rekordy;
}

// Oblicza konkretne daty dla harmonogramu cyklicznego w danym miesiącu
function obliczDaty(harmonogram, rok, miesiac) {
  const pola = harmonogram.fields;
  const tryb = pola['Tryb'];
  const daty = [];

  if (tryb === 'jednorazowe') {
    const data = pola['Data'];
    if (data) {
      const d = new Date(data);
      if (d.getFullYear() === rok && d.getMonth() + 1 === miesiac) {
        daty.push(data);
      }
    }
    return daty;
  }

  if (tryb === 'co-tydzien') {
    const dniTygodnia = { Pn: 1, Wt: 2, Sr: 3, Czw: 4, Pt: 5, Sb: 6, Nd: 0 };
    // Obsługa polskiego "Śr" (może mieć różne kodowanie)
    const dzienNazwa = pola['Dzień tygodnia'];
    const docelowy = dniTygodnia[dzienNazwa] ?? dniTygodnia['Sr'];

    const pierwszyDzien = new Date(rok, miesiac - 1, 1);
    const ostatniDzien = new Date(rok, miesiac, 0).getDate();

    for (let d = 1; d <= ostatniDzien; d++) {
      const data = new Date(rok, miesiac - 1, d);
      if (data.getDay() === docelowy) {
        daty.push(`${rok}-${String(miesiac).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }
    return daty;
  }

  if (tryb === 'co-miesiac-dzien-tygodnia') {
    const dniTygodnia = { Pn: 1, Wt: 2, Sr: 3, Czw: 4, Pt: 5, Sb: 6, Nd: 0 };
    const ktoryMapa = { Pierwszy: 1, Drugi: 2, Trzeci: 3, Czwarty: 4, Ostatni: -1 };

    const dzienNazwa = pola['Dzień tyg. w miesiącu'];
    const docelowy = dniTygodnia[dzienNazwa] ?? dniTygodnia['Sr'];
    const ktory = ktoryMapa[pola['Który w miesiącu']] ?? 1;

    const ostatniDzien = new Date(rok, miesiac, 0).getDate();
    const pasujace = [];

    for (let d = 1; d <= ostatniDzien; d++) {
      const data = new Date(rok, miesiac - 1, d);
      if (data.getDay() === docelowy) {
        pasujace.push(d);
      }
    }

    let wybrany;
    if (ktory === -1) {
      wybrany = pasujace[pasujace.length - 1];
    } else {
      wybrany = pasujace[ktory - 1];
    }

    if (wybrany) {
      daty.push(`${rok}-${String(miesiac).padStart(2, '0')}-${String(wybrany).padStart(2, '0')}`);
    }
    return daty;
  }

  return daty;
}

export default async function handler(req, context) {
  // CORS dla lokalnego developmentu
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    // Zakresy miesięcy: bieżący + 2 do przodu
    const dzisiaj = new Date();
    const miesiace = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() + i, 1);
      miesiace.push({
        rok: d.getFullYear(),
        miesiac: d.getMonth() + 1,
        klucz: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      });
    }

    // Pobierz dane równolegle
    const [widocznosc, harmonogramy, zajecia, kategorie, prowadzacy, wyjatki] = await Promise.all([
      fetchAll('Widoczność miesięcy'),
      fetchAll('Harmonogramy', { filterByFormula: '{Aktywny}=1' }),
      fetchAll('Zajęcia', { filterByFormula: '{Aktywne}=1' }),
      fetchAll('Kategorie'),
      fetchAll('Prowadzący', { filterByFormula: '{Aktywny}=1' }),
      fetchAll('Wyjątki'),
    ]);

    // Słowniki dla szybkiego dostępu
    const widocznoscMap = {};
    for (const w of widocznosc) {
      widocznoscMap[w.fields['Miesiąc']] = w.fields['Widoczny publicznie'] === true;
    }

    const zajeciaMap = {};
    for (const z of zajecia) {
      zajeciaMap[z.id] = z.fields;
    }

    const kategorieMap = {};
    for (const k of kategorie) {
      kategorieMap[k.id] = k.fields;
    }

    const prowadzacyMap = {};
    for (const p of prowadzacy) {
      prowadzacyMap[p.id] = p.fields;
    }

    // Wyjątki po harmonogramId + dacie
    const wyjatkiMap = {};
    for (const w of wyjatki) {
      const harmonogramId = w.fields['Harmonogram']?.[0];
      const data = w.fields['Data'];
      if (harmonogramId && data) {
        const klucz = `${harmonogramId}_${data}`;
        wyjatkiMap[klucz] = w.fields['Typ'];
      }
    }

    const terminy = [];
    const dzisiajStr = dzisiaj.toISOString().slice(0, 10);

    for (const harmonogram of harmonogramy) {
      const pola = harmonogram.fields;
      const zajecieIds = pola['Zajęcia'];
      if (!zajecieIds?.length) continue;

      const zajecie = zajeciaMap[zajecieIds[0]];
      if (!zajecie) continue;

      // Wyznacz kategorię
      const kategoriaId = zajecie['Kategoria']?.[0];
      const kategoria = kategoriaId ? kategorieMap[kategoriaId] : null;

      // Wyznacz prowadzących
      const prowadzacyIds = pola['Prowadzący'] ?? [];
      const prowadzacyLista = prowadzacyIds
        .map((id) => prowadzacyMap[id])
        .filter(Boolean)
        .map((p) => p['Imię i nazwisko']);

      // Ustal ustawienia zapisów i limitów (harmonogram nadpisuje zajecia)
      const zapisyUstawienie = pola['Zapisy'] === 'z definicji zajęć' || !pola['Zapisy']
        ? zajecie['Zapisy']
        : pola['Zapisy'];

      const limitMiejsc = pola['Limit miejsc'] ?? zajecie['Limit miejsc'] ?? 0;
      const limitRezerwowych = pola['Limit rezerwowych'] ?? zajecie['Limit rezerwowych'] ?? 0;

      // Generuj terminy dla każdego miesiąca z zakresu
      for (const { rok, miesiac, klucz } of miesiace) {
        const daty = obliczDaty(harmonogram, rok, miesiac);

        for (const data of daty) {
          const wPrzeszlosci = data < dzisiajStr;
          const widoczny = wPrzeszlosci || widocznoscMap[klucz] === true;

          if (!widoczny) continue;

          // Sprawdź wyjątek dla tej daty
          const wyjatekKlucz = `${harmonogram.id}_${data}`;
          const wyjatekTyp = wyjatkiMap[wyjatekKlucz] ?? null;

          if (wyjatekTyp === 'dezaktywowane') continue;

          terminy.push({
            id: `${harmonogram.id}_${data}`,
            data,
            harmonogramId: harmonogram.id,
            slug: zajecie['Slug'] ?? null,
            nazwaWKalendarzu: zajecie['Nazwa w kalendarzu'] ?? null,
            godzinaStart: pola['Godzina start'] ?? null,
            godzinaKoniec: pola['Godzina koniec'] ?? null,
            miejsceNazwa: pola['Miejsce nazwa'] ?? null,
            miejsceAdres: pola['Miejsce adres'] ?? null,
            kategoriaNazwa: kategoria?.['Nazwa'] ?? null,
            kategoriaKolor: kategoria?.['Kolor'] ?? null,
            prowadzacy: prowadzacyLista,
            zapisy: zapisyUstawienie ?? 'nieaktywne',
            limitMiejsc,
            limitRezerwowych,
            odwolane: wyjatekTyp === 'odwolane',
          });
        }
      }
    }

    // Sortuj chronologicznie
    terminy.sort((a, b) => a.data.localeCompare(b.data));

    return new Response(JSON.stringify({ terminy }), { status: 200, headers });
  } catch (err) {
    console.error('Błąd /api/terminy:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export const config = {
  path: '/api/terminy',
};
