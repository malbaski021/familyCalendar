# Family Calendar — Plan razvoja (v1)

> Plan je organizovan u faze (F0–F18). Svaka faza se može razviti i testirati nezavisno pre nego što se krene na sledeću. Kod, commit poruke, identifikatori u bazi i UI stringovi pišu se na engleskom; ovaj dokument je vodič na srpskom za praćenje napretka.
>
> Konvencija: označavaj `[x]` kad se zadatak završi. Faza se smatra završenom kad su svi zadaci i kriterijumi prihvatanja iz nje ispunjeni.

---

## F0 — Scaffolding & osnovna infrastruktura

**Cilj:** Pokrenuti prazan Next.js projekat sa svim alatima koji nam trebaju kasnije, deploy na Vercel pre nego što pišemo bilo kakvu poslovnu logiku.

- [ ] Inicijalizovati Next.js (App Router) + TypeScript projekat
- [ ] Konfigurisati ESLint + Prettier (strict TS, no implicit any)
- [ ] Instalirati i konfigurisati Tailwind CSS
- [ ] Inicijalizovati Shadcn/ui (theme tokens, base components: Button, Input, Dialog, Toast)
- [ ] Postaviti light/dark theme toggle (CSS variables, `next-themes`)
- [ ] Instalirati i konfigurisati `next-intl` (locales: `en`, `sr-Latn`, default `en`)
- [ ] Napraviti praznu rutu `/calendar` i `/(auth)/login` kao placeholder
- [ ] Konfigurisati `.env.example` sa svim varijablama koje će nam trebati
- [ ] Otvoriti Vercel projekat i povezati repo
- [ ] Prvi deploy zelenih CI provera (lint + typecheck + build)

**Kriterijum prihvatanja:** Prazan deploy na Vercel je live, light/dark radi, jezik se može promeniti URL prefiksom (`/en`, `/sr-Latn`).

---

## F1 — Supabase baza i RLS

**Cilj:** Sve od 16 tabela definisano kroz migracije, RLS pravila aktivna, lokalni i produkcioni Supabase projekat sinhronizovani.

- [ ] Otvoriti Supabase projekat (free tier), zapamtiti `SUPABASE_URL` i ključeve
- [ ] Postaviti `supabase/` folder sa CLI migracijama
- [ ] Migracija: `users`
- [ ] Migracija: `families`
- [ ] Migracija: `family_members` (sa role: owner/member)
- [ ] Migracija: `children`
- [ ] Migracija: `invite_links` (token, role, expires_at, used_at, status)
- [ ] Migracija: `events` (sa svim poljima, lock kolone, recurring kolone)
- [ ] Migracija: `event_children` (M2M)
- [ ] Migracija: `event_reminders`
- [ ] Migracija: `event_instances`
- [ ] Migracija: `event_shares` (sa opens_count)
- [ ] Migracija: `drafts` (draft_data JSONB, expires_at)
- [ ] Migracija: `ai_queue` (tasks JSONB, status enum)
- [ ] Migracija: `audit_log` (actor, action, entity, old_data/new_data JSONB)
- [ ] Migracija: `notifications`
- [ ] Migracija: `push_subscriptions`
- [ ] Migracija: `weather_cache`
- [ ] RLS politike: korisnik vidi samo svoju porodicu (sve relevantne tabele)
- [ ] RLS politike: Admin pristup gde je definisano (audit log all, deactivate)
- [ ] Generisanje TypeScript tipova iz Supabase šeme (`supabase gen types`)
- [ ] Seed skripta za lokalni razvoj (1 admin, 1 porodica, 2 člana, par događaja)

**Kriterijum prihvatanja:** Sve tabele postoje, RLS blokira pristup tuđim podacima u manuelnom testu, tipovi su importovani u app.

---

## F2 — Autentikacija (Supabase Auth)

**Cilj:** Korisnik se može registrovati i ulogovati. Sesija perzistira. Bez email verifikacije.

- [ ] Supabase Auth client (server + browser) helper
- [ ] Forma za registraciju: email, username, password (validacija)
- [ ] Hash password preko Supabase Auth (bcrypt iza scene)
- [ ] Login forma
- [ ] Logout
- [ ] Middleware za zaštićene rute (`/calendar`, `/settings`)
- [ ] Password reset preko email linka
- [ ] Auth context / session hook
- [ ] Server-side helper: `getCurrentUser()` + role lookup
- [ ] Toast za auth greške

**Kriterijum prihvatanja:** Mogu se registrovati, ulogovati, izlogovati i resetovati password kroz UI. Session preživljava refresh.

---

## F3 — Invite flow

**Cilj:** Sva registracija ide isključivo kroz invite linkove. Admin pravi Owner-a, Owner pravi Member-a.

- [ ] Admin panel (minimalan): "Create new calendar" → kreira `families` zapis
- [ ] Admin generiše Owner invite link (`/invite/owner/<family-slug>-<nanoid>`)
- [ ] Slug helper: `slugify(family_name)` + nanoid suffix
- [ ] Owner: Settings → "Generate member invite link"
- [ ] Member invite link (`/invite/member/<family-slug>-<nanoid>`)
- [ ] Stranica `/invite/[role]/[token]` — validira token, prikazuje registracionu formu
- [ ] Token: single-use (`used_at` set odmah po uspešnoj registraciji)
- [ ] Token: 48h expiry validacija
- [ ] Po registraciji, automatski dodeli rolu i upiši u `family_members`
- [ ] Owner može da regeneriše link (invalidira stari, pravi novi)
- [ ] Greška za istekao/iskorišćen link sa jasnom porukom
- [ ] Audit log: `invite_link_used`

**Kriterijum prihvatanja:** Pun ciklus Admin → Owner → Member kroz linkove radi end-to-end. Istekli linkovi pokazuju jasnu poruku.

---

## F4 — Family, deca i onboarding

**Cilj:** Posle prve registracije korisnik prolazi kroz 3-ekrana onboarding i može da dodaje decu.

- [ ] Settings sekcija "Children" — CRUD za listu dece
- [ ] Onboarding ekran 1: Welcome (nije skippable)
- [ ] Onboarding ekran 2: Add children (skippable)
- [ ] Onboarding ekran 3: Notifications permission (skippable)
- [ ] Detekcija "first login" → automatski pokreće onboarding
- [ ] Settings → "Relaunch onboarding"
- [ ] Audit log za promene na listi dece

**Kriterijum prihvatanja:** Novi korisnik vidi onboarding samo prvi put, može kasnije da ga relaunch-uje, deca se mogu dodati/preimenovati/obrisati.

---

## F5 — Calendar views

**Cilj:** Vizuelno jezgro aplikacije — mesečni, nedeljni i dnevni prikaz, sa mobile-first navigacijom.

- [ ] Bottom navigation bar (Calendar / Add / Profile) — mobile
- [ ] Top navigation za desktop (isto ali horizontalno)
- [ ] Monthly view (default) — grid sa svim događajima u danu
- [ ] Weekly view — sa hourly timeline
- [ ] Daily view — pun detalj jednog dana
- [ ] Tap na dan u Monthly (mobile) otvara Daily
- [ ] Switch između view-ova
- [ ] Navigacija napred/nazad po mesecima/nedeljama/danima
- [ ] Loading skeleton za fetch-ove
- [ ] Empty state ("No events this month")

**Kriterijum prihvatanja:** Tri view-a rade, prebacivanje je glatko na mobile i desktop, navigacija radi u oba smera.

---

## F6 — Event CRUD

**Cilj:** Stvaranje, čitanje, izmena i brisanje običnih (ne-recurring) događaja sa svim poljima.

- [ ] Event create forma (sva polja iz proposal-a)
- [ ] Category dropdown sa bojama i emoji-ima (Birthday, Performance, Match, School, Doctor, Other)
- [ ] Date/time picker (mobile-friendly)
- [ ] Multi-day events (start + end date)
- [ ] All-day vs timed events
- [ ] Location, Notes (free text)
- [ ] Child tag (manuelni dropdown — AI auto-detection dolazi u F11)
- [ ] Event detail view
- [ ] Edit event (otvara istu formu sa popunjenim vrednostima)
- [ ] Delete event sa potvrdom
- [ ] Audit log: `event.created`, `event.updated`, `event.deleted`
- [ ] Prikaz događaja u sva tri view-a (boja kategorije, emoji, naslov)

**Kriterijum prihvatanja:** Mogu se kreirati, izmeniti i obrisati događaji svih kategorija i tipova (single, multi-day, all-day, timed). Sve promene se vide u realnom vremenu kod drugog člana porodice (Supabase Realtime na `events` tabelu).

---

## F7 — Recurring events

**Cilj:** Podrška za ponavljajuće događaje sa mogućnošću izmene/otkazivanja pojedinačne instance.

- [ ] Recurring pattern polje u event formi (Daily / Weekly / Monthly / None)
- [ ] Recurring end date
- [ ] Generisanje `event_instances` zapisa kroz pattern (backend job ili on-demand)
- [ ] Prikaz svake instance kao zaseban događaj u kalendaru
- [ ] Edit pojedinačne instance (override) — ne dira ostale
- [ ] Cancel pojedinačne instance — soft delete instance, serija ostaje
- [ ] Edit "celu seriju" opcija na master event
- [ ] Audit log za instance-level promene

**Kriterijum prihvatanja:** Mogu napraviti weekly trening, promeniti termin samo jedne sedmice, otkazati treću sedmicu, ostatak ostaje neizmenjen.

---

## F8 — Event locking & draft system

**Cilj:** Sprečiti konflikte kad oba člana porodice istovremeno menjaju isti događaj.

- [ ] Pri otvaranju event-a za edit, postaviti lock (user_id + timestamp u `events`)
- [ ] Realtime subscription: drugi korisnik vidi lock ikonu
- [ ] Minute 10 timer: push notifikacija "You have unsaved changes, save your draft?"
- [ ] Minute 15 timer: lock expira, draft se snima u `drafts` tabelu
- [ ] Po ulasku u edit, proveri postoji li draft za taj event/user
- [ ] UI: "You have a saved draft, continue editing?" → Accept / Discard
- [ ] Audit log za sve lock i draft akcije
- [ ] Edge case: lock se oslobađa odmah pri Save ili Cancel

**Kriterijum prihvatanja:** Dva korisnika ne mogu istovremeno editovati isti događaj. Draft preživljava expiry-ja locka i može se vratiti.

---

## F9 — Audit log

**Cilj:** Sve akcije (korisničke, AI, sistemske) imaju upis. UI za pregled sa filterima.

- [ ] Helper funkcija `logAudit(actor, action, entity, oldData, newData)` na backendu
- [ ] Pozivati helper svuda gde već pišemo audit (F3, F4, F6, F7, F8)
- [ ] Audit Log stranica — chronological feed
- [ ] Filter: po actor-u (All / Me / Partner / AI / System)
- [ ] Filter: po action type (Created / Edited / Deleted / AI / Notifications)
- [ ] Filter: po vremenu (This month / Last month / Custom range)
- [ ] Search po imenu događaja
- [ ] Paginacija ili infinite scroll
- [ ] Read-only (nema undo u v1 — undo je v2)
- [ ] Admin vidi sve, Owner/Member vide svoje

**Kriterijum prihvatanja:** Sve akcije iz F3–F8 su vidljive u audit logu sa tačnim metapodacima. Filteri rade.

---

## F10 — Web Push notifikacije

**Cilj:** Push notifikacije rade bez third-party servisa, na Android Chrome i iOS PWA.

- [ ] Generisati VAPID ključeve, dodati u env
- [ ] Instalirati `web-push` paket
- [ ] Service worker za hvatanje push event-a
- [ ] Klijent: traženje permission-a (sa onboarding ekrana 3 i Settings)
- [ ] Snimanje subscription objekta u `push_subscriptions`
- [ ] iOS Safari: detekcija da li je PWA dodat na home screen, ako nije → uputstvo
- [ ] Backend endpoint za slanje notifikacije (`sendPush(userId, payload)`)
- [ ] Notifikacioni tipovi: event reminder, AI complete, draft expiry warning, lock released
- [ ] Settings: per-category notification toggles
- [ ] Settings: global notifications on/off
- [ ] `notifications` tabela zapis sa statusom (queued / sent / failed)

**Kriterijum prihvatanja:** Test push stiže na realan telefon (Android i iOS PWA). Status se beleži.

---

## F11 — AI Multi-Agent System (Orchestrator + 3 agenta)

**Cilj:** AI predlaže kategoriju, dete, podsetnike i otkriva duplikate. Groq pad ne blokira save.

- [ ] Groq API key u env, klijent helper
- [ ] Strukturisani JSON tipovi za task/result svakog agenta
- [ ] Orchestrator: paralelno dispatch-uje task-ove ka agentima
- [ ] Agent 1 — Duplicate Detection (title, datum, time overlap, semantika)
- [ ] Agent 2 — Categorization & Tagging + child detection (sa porodičnom listom dece)
- [ ] Agent 3 — Smart Reminders (timing prema kategoriji)
- [ ] Orchestrator: assembluje rezultate u `user_message` na jeziku korisnika
- [ ] UI: inline prikaz predloga (auto-fill kategorije/tag-a, warning za duplikat, predlog reminder-a sa potvrdom)
- [ ] "New child detected → add to family list?" prompt
- [ ] Sinhroni put: 3s timeout na Groq poziv
- [ ] Ako timeout/fail: task ide u `ai_queue` (status: pending)
- [ ] Supabase Realtime trigger na novi `ai_queue` zapis → procesira u pozadini
- [ ] Status lifecycle: pending → processing → done/failed
- [ ] Push notifikacija kad queued task završi
- [ ] Zaštita od duplog processing-a (status check)
- [ ] Audit log za sve AI akcije (suggested / accepted / rejected / queued)

**Kriterijum prihvatanja:** Save događaja sa naslovom "Luka football Saturday" automatski popuni kategoriju Match i tag Luka, prikaže duplikat ako postoji, predloži reminder-e. Save NIKAD nije blokiran AI-jem.

---

## F12 — Weather forecast

**Cilj:** U event detail-u pokazati vremensku prognozu za datum događaja.

- [ ] Open-Meteo client (no API key)
- [ ] Fetch samo kad se otvori event detail (lazy)
- [ ] Cache u `weather_cache` (po event_id i datumu)
- [ ] Inline prikaz ikone + temperature + kratkog opisa
- [ ] Fallback poruka: "Forecast currently unavailable" ako API padne
- [ ] Provera: weather pad ne utiče na ostatak UI-ja

**Kriterijum prihvatanja:** Prognoza se pojavljuje u event detail-u za buduće datume. Pad API-ja se gracioizno hendluje.

---

## F13 — Share event link (public read-only)

**Cilj:** Bilo koji event može se podeliti javnim linkom.

- [ ] Backend endpoint za generisanje share token-a (`slugify(title-date)` + nanoid)
- [ ] Upis u `event_shares`
- [ ] Public stranica `/share/[slug]` — bez auth-a, samo title/date/time/location
- [ ] Tracking: `opens_count++` pri svakom otvaranju
- [ ] Dugme "Share" u event detail-u (copy to clipboard)
- [ ] Audit log: `share_link.generated`
- [ ] Stranica radi i ako korisnik nije ulogovan

**Kriterijum prihvatanja:** Generisani link otvara read-only prikaz iz inkognito prozora. Open count raste.

---

## F14 — Settings page

**Cilj:** Jedno mesto za sve korisničke preferencije.

- [ ] Language switch (en / sr-Latn)
- [ ] Theme toggle (Light / Dark)
- [ ] Notifications: global on/off + per-category
- [ ] Children: lista sa add/rename/remove
- [ ] Change password (current + new)
- [ ] Archive account dugme (vodi u F15)
- [ ] Relaunch onboarding dugme
- [ ] Sve promene se snimaju instant + audit log

**Kriterijum prihvatanja:** Sve podešavanja perzistiraju, jezik se menja u runtime-u, theme switch radi bez reload-a.

---

## F15 — Account archival (30-day grace)

**Cilj:** Korisnik može da arhivira nalog, ima 30 dana da se predomisli.

- [ ] "Archive account" potvrda sa jasnim upozorenjem
- [ ] Postavi `users.status = 'archived'`, `archived_at = now()`
- [ ] Logout i lock iz aplikacije
- [ ] Login tokom grace period-a reaktivira nalog
- [ ] Vercel Cron (vidi F17): dnevno briše naloge gde je `archived_at < now() - 30 dana`
- [ ] Notifikacija Admin-u kada nalog uđe u archival
- [ ] Drugi član porodice nastavlja da vidi sve event-e

**Kriterijum prihvatanja:** Arhiviran nalog ne može da se uloguje preko login forme, ali login se može iskoristiti za reaktivaciju unutar 30 dana.

---

## F16 — Offline read-only mode

**Cilj:** Bez interneta, korisnik vidi poslednje keširane podatke, ne može da edituje.

- [ ] Service Worker — caching strategy za poslednji fetched kalendar
- [ ] Detekcija online/offline (browser API + ping)
- [ ] Offline banner: "You are offline. Changes are disabled until connection is restored."
- [ ] Disable Add/Edit/Delete dugmadi u offline modu
- [ ] Auto-reload sveže podatke kad konekcija dođe nazad

**Kriterijum prihvatanja:** U offline modu se vide poslednji event-i ali se ne mogu menjati. Banner je vidljiv. Online povratak osvežava podatke.

---

## F17 — Vercel Cron jobs

**Cilj:** Zakazani pozadinski poslovi.

- [ ] `vercel.json` ili App Router cron handlers
- [ ] Daily: brisanje arhiviranih naloga starijih od 30 dana (F15)
- [ ] Daily: brisanje istečenih invite linkova (F3)
- [ ] Daily: brisanje istečenih drafts (F8)
- [ ] Daily: retry `ai_queue` zapisa koji su u statusu `failed` (jednom)
- [ ] Hourly ili more frequent: provera event reminder-a koji treba da se pošalju (F10)
- [ ] Svaki cron loguje rezultat (broj obrađenih, broj grešaka)

**Kriterijum prihvatanja:** Cron-ovi rade na Vercel-u, vidi se izvršenje u dashboard-u, ne dupliraju posao.

---

## F18 — QA & polish

**Cilj:** Sve radi end-to-end, na mobile-u izgleda kako treba, edge case-ovi su pokriveni.

- [ ] E2E test (Playwright) za core flow: register → create event → AI suggestion → edit → share
- [ ] Mobile responsive check (Android Chrome, iOS Safari) — manuelni
- [ ] PWA manifest + install na iOS home screen test
- [ ] Performance: Lighthouse pass (mobile)
- [ ] Provera svih error handling scenarija iz proposal-a (Groq down, Supabase down, weather down, push fail, expired invite, duplicate AI queue)
- [ ] Bezbednosni pregled: RLS svuda, hash-ovi password-a, nema secrets u client bundle-u
- [ ] Provera audit log-a — sve akcije iz F3–F17 stvarno upisuju
- [ ] Provera prevoda — sve UI poruke imaju i `en` i `sr-Latn` varijantu
- [ ] Cleanup TODO komentara, console.log poziva, neiskorišćenih file-ova
- [ ] README sa setup uputstvima za lokalni razvoj

**Kriterijum prihvatanja:** Aplikacija je spremna za upotrebu od strane porodice. Sva v1 funkcionalnost iz proposal-a radi.

---

## Šta sledi (v2)

Iz proposal-a u v2 idu:
- Offline event creation sa auto-sync
- Undo / Restore iz audit log-a
- Agent 4 — Weekly Briefing
- Agent 5 — Conflict Advisor
- Agent 6 — Natural Language Input
- Agent 7 — Activity Analysis
- Push notification retry on failure

Ne dirati arhitekturu radi v2 — sve tabele su već u F1, samo dodajemo logiku.
