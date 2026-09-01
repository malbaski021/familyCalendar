# Family Calendar — Plan razvoja (v1)

> Plan je organizovan u faze (F0–F18). Svaka faza se može razviti i testirati nezavisno pre nego što se krene na sledeću. Kod, commit poruke, identifikatori u bazi i UI stringovi pišu se na engleskom; ovaj dokument je vodič na srpskom za praćenje napretka.
>
> Konvencija: označavaj `[x]` kad se zadatak završi. Faza se smatra završenom kad su svi zadaci i kriterijumi prihvatanja iz nje ispunjeni.

## Pravila kvaliteta (važi za svaku fazu)

- **Testovi su obavezni**: svaka faza mora imati unit i/ili integration testove za svu logiku koju donosi. Komponente — React Testing Library. Helperi, agenti, serveri — Vitest unit. RLS / DB integracije — integration test sa pravom Supabase instancom.
- **CI mora biti zelen pre merge-a**: GitHub Actions workflow trči `lint → typecheck → format:check → test → build` na svakom PR-u. Crveni check blokira merge.
- **Bez `// @ts-ignore` i bez `any` u finalnom kodu**: tipovi se izvode iz Supabase šeme ili eksplicitno definišu. Strict TS je uključen.
- **Pre-commit hook** (Husky + lint-staged) automatski formatira i lint-uje staged fajlove — tako da prljav kod ne stigne ni do commit-a.
- **Acceptance kriterijum nije ispunjen** dok testovi nisu napisani i CI ne prolazi.

---

## F0 — Scaffolding & osnovna infrastruktura ✅ Završeno (2026-05-26)

**Cilj:** Pokrenuti prazan Next.js projekat sa svim alatima koji nam trebaju kasnije, deploy na Vercel pre nego što pišemo bilo kakvu poslovnu logiku.

- [x] Inicijalizovati Next.js (App Router) + TypeScript projekat _(Next.js 16.2.6, strict TS)_
- [x] Konfigurisati ESLint + Prettier (strict TS, no implicit any) _(eslint flat config + prettier sa Tailwind plugin)_
- [x] Instalirati i konfigurisati Tailwind CSS _(Tailwind v4)_
- [x] Inicijalizovati Shadcn/ui (theme tokens, base components: Button, Input, Dialog, Toast) _(Radix base, Sonner za toast)_
- [x] Postaviti light/dark theme toggle (CSS variables, `next-themes`) _(ThemeProvider + ThemeToggle)_
- [x] Instalirati i konfigurisati `next-intl` (locales: `en`, `sr-Latn`, default `en`) _(URL prefiks rute kroz `[locale]` segment)_
- [x] Napraviti praznu rutu `/calendar` i `/(auth)/login` kao placeholder
- [x] Konfigurisati `.env.example` sa svim varijablama koje će nam trebati _(Supabase, Groq, VAPID)_
- [x] Otvoriti Vercel projekat i povezati repo _(production grana: `main`)_
- [x] Prvi deploy zelenih CI provera (lint + typecheck + build)

**Dodato preko prvobitnog plana (postavljeno kao standard za sve faze):**

- [x] Vitest 4 + React Testing Library + jsdom _(Windows-stable: `pool: threads`, `fileParallelism: false`)_
- [x] Smoke testovi za `cn()` helper i `ThemeToggle` (5 testova prolazi)
- [x] GitHub Actions CI workflow (`lint → typecheck → format:check → test → build`)
- [x] Husky + lint-staged pre-commit hook
- [x] Branch protection na `main` (PR obavezan, bez direct push-a)

**Kriterijum prihvatanja:** Prazan deploy na Vercel je live ✓, light/dark radi ✓, jezik se može promeniti URL prefiksom (`/en`, `/sr-Latn`) ✓, CI svuda prolazi ✓.

---

## F1 — Supabase baza i RLS ✅ Završeno (2026-05-26)

**Cilj:** Sve od 16 tabela definisano kroz migracije, RLS pravila aktivna, lokalni i produkcioni Supabase projekat sinhronizovani.

- [x] Otvoriti Supabase projekat (free tier), zapamtiti `SUPABASE_URL` i ključeve _(projekat `emmyrrcvrzphtwvdruoz`, Frankfurt)_
- [x] Postaviti `supabase/` folder sa CLI migracijama _(`supabase init` + `link` na cloud)_
- [x] Migracija: `users` _(profile FK na auth.users + auto-create trigger)_
- [x] Migracija: `families`
- [x] Migracija: `family_members` (sa role: owner/member)
- [x] Migracija: `children`
- [x] Migracija: `invite_links` (token, role, expires_at, used_at, status)
- [x] Migracija: `events` (sa svim poljima, lock kolone, recurring kolone)
- [x] Migracija: `event_children` (M2M)
- [x] Migracija: `event_reminders`
- [x] Migracija: `event_instances`
- [x] Migracija: `event_shares` (sa opens_count)
- [x] Migracija: `drafts` (draft_data JSONB, expires_at)
- [x] Migracija: `ai_queue` (tasks JSONB, status enum)
- [x] Migracija: `audit_log` (actor, action, entity, old_data/new_data JSONB)
- [x] Migracija: `notifications`
- [x] Migracija: `push_subscriptions`
- [x] Migracija: `weather_cache`
- [x] RLS politike: korisnik vidi samo svoju porodicu (sve relevantne tabele) _(verifikovano integration testovima)_
- [x] RLS politike: Admin pristup gde je definisano (audit log all, deactivate)
- [x] Generisanje TypeScript tipova iz Supabase šeme (`supabase gen types`) _(`src/types/database.ts`)_
- [x] Seed skripta za lokalni razvoj (1 admin, 1 porodica, 2 člana, par događaja) _(plus Smith porodica za RLS testove)_

**Dodato preko prvobitnog plana:**

- [x] `@supabase/supabase-js` + `@supabase/ssr` instalirani; helper-i `src/lib/supabase/{client,server}.ts`
- [x] Vitest integration test config + 23 testa (16 schema + 7 RLS scenarija)
- [x] GitHub Actions CI sa `supabase/setup-cli` action — pokreće local stack, primenjuje migracije, trči integration testove
- [x] npm skripte: `db:start`, `db:stop`, `db:reset`, `db:types`, `test:integration`
- [x] Migracije organizovane logički u 9 SQL fajlova umesto 16 (grupisane srodne tabele)

**Kriterijum prihvatanja:** Sve tabele postoje ✓, RLS blokira pristup tuđim podacima ✓ (integration test), tipovi su importovani u app ✓.

---

## F2 — Autentikacija (Supabase Auth) ✅ Završeno (2026-05-26)

**Cilj:** Korisnik se može registrovati i ulogovati. Sesija perzistira. Bez email verifikacije.

- [x] Supabase Auth client (server + browser) helper _(`src/lib/supabase/{client,server,middleware}.ts`, sve tipovano sa `Database`)_
- [x] Forma za registraciju: email, username, password (validacija) _(`SignUpForm` sa Zod + react-hook-form)_
- [x] Hash password preko Supabase Auth (bcrypt iza scene)
- [x] Login forma _(`LoginForm` sa `redirectTo` query param podrškom)_
- [x] Logout _(`LogoutButton` + `logoutAction` server action)_
- [x] Middleware za zaštićene rute (`/calendar`, `/settings`) _(`src/proxy.ts` kombinuje next-intl + Supabase session refresh + redirect za neulogovane)_
- [x] Password reset preko email linka _(`ResetPasswordRequestForm` + `NewPasswordForm` + dve rute)_
- [x] Auth context / session hook _(`useAuth()` client hook sa onAuthStateChange subscription)_
- [x] Server-side helper: `getCurrentUser()` + role lookup _(React-cached, vraća `{authId, email, profile}`)_
- [x] Toast za auth greške _(Sonner integration u svakoj formi)_

**Dodato preko prvobitnog plana:**

- [x] Zod schemas u `src/lib/auth/schemas.ts` + dedikovani unit testovi za schemas (10 testova)
- [x] Server actions u `src/lib/auth/actions.ts` (signUp, login, logout, requestPasswordReset, updatePassword)
- [x] Privremena `/signup` ruta (F3 će je zameniti invite-only flow-om)
- [x] Auth i18n stringovi dodati u oba `messages/*.json`
- [x] Test wrapper `src/test/utils.tsx` (renderWithProviders sa NextIntlClientProvider)
- [x] Integration testovi za auth lifecycle (signUp → profile trigger → login → wrong password rejected)
- [x] README ažuriran sa kompletnim setup instrukcijama, env vars, npm scripts, struktura projekta

**Manuelna podešavanja na Supabase Dashboard:**

- [x] Disable "Confirm email" u Authentication → Providers → Email
- [x] Site URL: `https://family-calendar-two-pink.vercel.app`
- [x] Redirect URLs: `http://localhost:3000/**`, `https://*.vercel.app/**`

**Kriterijum prihvatanja:** Mogu se registrovati, ulogovati, izlogovati i resetovati password kroz UI ✓. Session preživljava refresh ✓. Neulogovan pristup `/calendar` preusmerava na `/login?redirectTo=...` ✓.

---

## F2.1 — Test ID konvencija + LanguageToggle ✅ Završeno (2026-05-27)

**Cilj:** Svaki interaktivni element ima stabilan `data-testid` koji omogućava pouzdano lociranje u unit / E2E testovima, plus mehanizam koji sprečava da neko zaboravi da ga doda. Pored toga, korisnik može da promeni jezik kroz UI (ne samo URL prefiksom).

**Konvencija imenovanja** (hijerarhijski sa kontekstom):

- Format: `<context>-<component>-<element>`, kebab-case
- Primeri:
  - `signup-form-email-input`
  - `signup-form-submit-button`
  - `nav-language-toggle`
  - `nav-theme-toggle`
  - `calendar-day-2026-05-15-cell`
- Tag se čita kao putanja od široko ka usko — testovi mogu da koriste exact match ili prefix.

**Šta se smatra "interaktivnim elementom":**

- Native HTML: `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>` sa href, `<form>`
- Shadcn primitive: `Button`, `Input`, `Dialog`, `Sonner toast actions`, `Dropdown`, `Select`
- Naše custom forme: `SignUpForm`, `LoginForm`, `ResetPasswordRequestForm`, `NewPasswordForm`
- Buduće: kalendarske ćelije, event kartice, child tag pickeri, AI predlog dugmad

### Zadaci

- [x] Custom ESLint pravilo `local/require-data-testid` u `eslint-rules/` (registrovano kao plugin u flat config-u): _proverava native interaktivne tagove + listu komponenti, error level, exempt test fajlova i `src/components/ui/**` primitive_
- [x] Escape hatches: spread atribut, `asChild` (Slot pattern), test fajlovi, ui/ folder
- [x] Retroaktivno dodat `data-testid` na sve interaktivne elemente iz F0–F2:
  - `ThemeToggle` → `nav-theme-toggle`
  - `LogoutButton` → `nav-logout-button`
  - `SignUpForm`: `signup-form-{email,username,password}-input`, `signup-form-submit-button`, `signup-form`
  - `LoginForm`: `login-form-{email,password}-input`, `login-form-submit-button`, `login-form`
  - `ResetPasswordRequestForm`: `forgot-password-form-email-input`, `forgot-password-form-submit-button`, `forgot-password-form`
  - `NewPasswordForm`: `reset-password-form-{password,confirm-password}-input`, `reset-password-form-submit-button`, `reset-password-form`
- [x] `LanguageToggle` komponenta — Globe ikona (lucide-react) → Shadcn DropdownMenu sa stavkama "English" i "Srpski (latinica)"
  - Koristi `useRouter` + `usePathname` iz `@/i18n/navigation` za zamenu lokala u mestu
  - Aktivan lokal markiran sa `data-active="true"` na `DropdownMenuItem`
  - Postavljen pored `ThemeToggle` u home page-u (Settings i bottom nav dolaze kasnije)
  - `data-testid="nav-language-toggle"` na trigger-u i `nav-language-toggle-option-<locale>` na svakoj stavki
- [x] Unit testovi:
  - `eslint-rules/require-data-testid.test.ts` — 14 RuleTester slučajeva (8 valid + 6 invalid, pokrivaju sve escape hatch-eve)
  - `src/components/language-toggle.test.tsx` — 3 testa: render, promena lokala, no-op na aktivnom lokalu
- [x] Update `AGENTS.md` — sekcija "data-testid on every interactive element" sa konvencijom, listom interaktivnih elemenata i escape hatch pravilima

**Kriterijum prihvatanja:** `npm run lint` puca ako se doda interaktivni element bez `data-testid` ✓ (verifikovano — 10 grešaka pre dodavanja, 0 posle). Svi postojeći elementi imaju tag ✓. Korisnik može da promeni jezik kroz dropdown u UI-ju ✓.

---

## F3 — Invite flow ✅ Završeno (2026-05-27)

**Cilj:** Sva registracija ide isključivo kroz invite linkove. Admin pravi Owner-a, Owner pravi Member-a.

- [x] Admin panel (minimalan): "Create new calendar" → kreira `families` zapis _(`/admin` ruta)_
- [x] Admin generiše Owner invite link (`/invite/owner/<family-slug>-<nanoid>`)
- [x] Slug helper: `slugify(family_name)` + nanoid suffix _(`src/lib/family/slugify.ts`, mapira srpske dijakritike; nanoid 12-char custom alphabet)_
- [x] Owner: Settings → "Generate member invite link" _(`/settings` ruta)_
- [x] Member invite link (`/invite/member/<family-slug>-<nanoid>`)
- [x] Stranica `/invite/[role]/[token]` — validira token, prikazuje registracionu formu
- [x] Token: single-use (`used_at` set odmah po uspešnoj registraciji)
- [x] Token: 48h expiry validacija
- [x] Po registraciji, automatski dodeli rolu i upiši u `family_members`
- [x] Owner može da regeneriše link (invalidira stari, pravi novi)
- [x] Greška za istekao/iskorišćen link sa jasnom porukom _(invite/[role]/[token] page renderuje `errors.used | expired | revoked | notFound` ovisno o validaciji)_
- [x] Audit log: `invite_link.generated`, `invite_link.used`, `invite_link.regenerated`, `family.created`

**Dodato preko prvobitnog plana:**

- [x] **Super-admin enforcement** — DB trigger `users_enforce_super_admin` (migracija `20260527120000_super_admin.sql`) garantuje da `role='admin'` može da ima jedino email `malbaski.ns@gmail.com` i isključivo jedan korisnik
- [x] `ensureSuperAdmin()` helper auto-promoviše super-admin email pri svakom signUp/login (idempotentno, koristi service-role klijent jer RLS blokira self-role-change)
- [x] Service-role Supabase klijent (`src/lib/supabase/service.ts`) za operacije pre nego što korisnik ima sesiju (validacija + prihvatanje invite-a, audit upisi)
- [x] Audit helper (`src/lib/audit/log.ts`) — fail-safe (logging greška ne lomi user action)
- [x] InviteLinkCard zajednička komponenta deli flow između admin panela (owner invites) i settings stranice (member invites)
- [x] Integration testovi (`src/test/integration/invites.test.ts`) — 8 slučajeva: super-admin singleton, validacija, expiry, revoke, optimistic-lock consume, idempotentni double-consume, nepoznat token
- [x] Seed.sql ažuriran — admin user koristi pravi super-admin email da prođe trigger

**Kriterijum prihvatanja:** Pun ciklus Admin → Owner → Member kroz linkove radi end-to-end ✓ (manuelno verifikovano). Istekli linkovi pokazuju jasnu poruku ✓. 34/34 integration testa prolazi ✓.

---

## F4 — Family, deca i onboarding ✅ Završeno (2026-05-29)

**Cilj:** Posle prve registracije korisnik prolazi kroz 3-ekrana onboarding i može da dodaje decu.

- [x] Settings sekcija "Children" — CRUD za listu dece _(server actions add/rename/remove + ChildrenManager komponenta)_
- [x] Onboarding ekran 1: Welcome (nije skippable) _(Continue jedino dugme)_
- [x] Onboarding ekran 2: Add children (skippable) _(deli ChildrenManager komponentu sa Settings)_
- [x] Onboarding ekran 3: Notifications permission (skippable) _(poziva Notification.requestPermission(), F10 wires real push)_
- [x] Detekcija "first login" → automatski pokreće onboarding _(`requireOnboardedUser` guard preusmerava ako `users.onboarded_at IS NULL` i user ima family)_
- [x] Settings → "Relaunch onboarding" _(server action briše onboarded_at i preusmerava na `/onboarding`)_
- [x] Audit log za promene na listi dece _(`child.added`, `child.renamed`, `child.removed`, plus `onboarding.completed` i `onboarding.relaunched`)_

**Dodato preko prvobitnog plana:**

- [x] DB migracija `20260529100000_onboarding_completed.sql` — `users.onboarded_at timestamptz` kolona + parcijalni indeks za `IS NULL` brze pretrage
- [x] `requireOnboardedUser(locale)` guard u `src/lib/auth/guards.ts` — koristi se u `/calendar` i `/settings`. Admin korisnici (bez porodice) prolaze bez onboarding-a.
- [x] `getFamilyContextFor(userId)` helper (`src/lib/family/get-family-context.ts`) — deterministicki dohvata prvu porodicu za korisnika, koristi se i u settings i u guard-u
- [x] Server actions koriste service-role klijent za `onboarded_at` (RLS blokira self-update sistemskih kolona)
- [x] ChildrenManager je jedna komponenta korišćena u dve lokacije (onboarding step 2 + settings) — sva CRUD logika centralizovana
- [x] Integration testovi (`src/test/integration/children-onboarding.test.ts`, 6 slučajeva) — CRUD nad children + onboarded_at lifecycle (default null, completion, relaunch)
- [x] i18n stringovi za `children`, `onboarding`, `settings.childrenSection`, `settings.onboarding` namespace-ove

**Kriterijum prihvatanja:** Novi korisnik vidi onboarding samo prvi put ✓ (admin se preskače), može kasnije da ga relaunch-uje kroz Settings ✓, deca se mogu dodati/preimenovati/obrisati ✓. 40/40 integration + 47/47 unit testova prolazi.

---

## F5 — Calendar views ✅ Završeno (2026-05-29)

**Cilj:** Vizuelno jezgro aplikacije — mesečni, nedeljni i dnevni prikaz, sa mobile-first navigacijom.

- [x] Bottom navigation bar (Calendar / Add / Profile) — mobile _(BottomNav, `md:hidden`, fiksiran na dnu)_
- [x] Top navigation za desktop (isto ali horizontalno) _(TopNav, `hidden md:flex`, plus theme/language/logout)_
- [x] Monthly view (default) — grid sa svim događajima u danu _(7×6 grid sa multi-day expansion, prikazuje do 3 događaja po danu + "+N" indikator)_
- [x] Weekly view — sa hourly timeline _(Mon..Sun kolone, satni redovi 00-23, all-day band na vrhu)_
- [x] Daily view — pun detalj jednog dana _(all-day + scheduled sekcije, lokacija + napomene)_
- [x] Tap na dan u Monthly (mobile) otvara Daily _(button cell sa `router.replace` → view=day)_
- [x] Switch između view-ova _(view switcher u CalendarNav-u, URL-driven `?view=month|week|day`)_
- [x] Navigacija napred/nazad po mesecima/nedeljama/danima _(prev/next + Today, koristi `stepAnchor()` helper)_
- [x] Loading skeleton za fetch-ove _(CalendarSkeleton kroz `<Suspense>`)_
- [x] Empty state _(`empty.day` poruka za dnevni prikaz, `noFamily` poruka kad nije član porodice)_

**Dodato preko prvobitnog plana:**

- [x] **URL-driven state** — `view` i `date` u query params; share/back/forward rade bez ručnog koda
- [x] `src/lib/calendar/view.ts` — pure helpers: `parseView`, `parseDate`, `rangeForView`, `stepAnchor`, `formatDateParam`, sa unit testovima
- [x] `src/lib/calendar/query.ts` — `loadEventsInRange` server fetch sa overlap logikom za multi-day događaje
- [x] `src/lib/calendar/categories.ts` — emoji + Tailwind chip stilovi po kategoriji (6 enum vrednosti)
- [x] Placeholder rute `/calendar/add` (F6) i `/profile` (→ redirect na `/settings`) — bottom nav linkovi rade
- [x] `date-fns` 4.x dodat kao dependency

**Kriterijum prihvatanja:** Tri view-a rade ✓, prebacivanje je glatko na mobile i desktop ✓ (URL nav + view switcher), navigacija radi u oba smera ✓ (Today dugme + prev/next). 51/51 unit testova prolazi.

---

## F6 — Event CRUD ✅ Završeno (2026-06-01)

**Cilj:** Stvaranje, čitanje, izmena i brisanje običnih (ne-recurring) događaja sa svim poljima.

- [x] Event create forma (sva polja iz proposal-a) _(EventForm deli se za create i edit)_
- [x] Category dropdown sa bojama i emoji-ima _(native `<select>` sa emoji prefiksom; boje + chip stilovi iz `CATEGORY_STYLES` iz F5)_
- [x] Date/time picker (mobile-friendly) _(native HTML5 `type="date"`/`type="time"` — odlično podržano na mobile)_
- [x] Multi-day events (start + end date) _(end date opciono; Zod refine validira `end >= start`)_
- [x] All-day vs timed events _(checkbox toggle; sakriva time polja kad je all-day, Zod refine forsira null)_
- [x] Location, Notes (free text)
- [x] Child tag (manuelni dropdown — AI auto-detection dolazi u F11) _(višestruki checkbox-i, snimaju se u `event_children` join tabelu)_
- [x] Event detail view _(`/calendar/[id]` ruta sa svim poljima + edit/delete dugmićima)_
- [x] Edit event (otvara istu formu sa popunjenim vrednostima) _(`/calendar/[id]/edit`)_
- [x] Delete event sa potvrdom _(window.confirm + redirect na `/calendar`)_
- [x] Audit log: `event.created`, `event.updated`, `event.deleted` _(old_data + new_data snapshot)_
- [x] Prikaz događaja u sva tri view-a (boja kategorije, emoji, naslov) _(F5 već renderuje, F6 svaki chip je sad Link na detail stranicu)_

**Dodato preko prvobitnog plana:**

- [x] **Supabase Realtime** — migracija `20260601120000_events_realtime.sql` dodaje `events` u `supabase_realtime` publication; `RealtimeEvents` client komponenta pretplaćuje se na INSERT/UPDATE/DELETE filterovan po `family_id` i radi `router.refresh()` — promene se vide u realnom vremenu kod drugog člana porodice
- [x] `src/lib/calendar/event-schema.ts` — Zod schema sa tri refinement-a (end_date >= start_date, end_time > start_time za isti dan, all-day ne sme imati vreme) + 8 unit testova
- [x] `src/lib/calendar/event-actions.ts` — createEvent / updateEvent / deleteEvent server actions koji rade family scoping + audit + sync event_children join
- [x] Integration testovi (`src/test/integration/events.test.ts`, 5 slučajeva) — single-day, multi-day all-day, child tagging, update in place, delete sa cascade
- [x] **Admin nav link (deferred F5 polish)** — TopNav + BottomNav prikazuju "Admin" stavku samo kad `user.profile.role === 'admin'`, BottomNav menja grid sa 3 → 4 kolone

**Kriterijum prihvatanja:** Mogu se kreirati, izmeniti i obrisati događaji svih kategorija i tipova ✓. Sve promene se vide u realnom vremenu kod drugog člana porodice ✓ (Supabase Realtime na `events` tabelu). 66/66 unit + 45/45 integration testova prolazi.

---

## F7 — Recurring events ✅ Završeno (2026-06-01)

**Cilj:** Podrška za ponavljajuće događaje sa mogućnošću izmene/otkazivanja pojedinačne instance.

- [x] Recurring pattern polje u event formi (Daily / Weekly / Monthly / None) _(select u EventForm, default 'none')_
- [x] Recurring end date _(opciono, prikazuje se tek kad pattern != none)_
- [x] Generisanje `event_instances` zapisa kroz pattern — **on-demand** _(expandOccurrences() rastvara seriju u datume koji padaju u trenutni range; ne kreira DB redove unapred)_
- [x] Prikaz svake instance kao zaseban događaj u kalendaru _(views bucket-uju po `occurrenceDate`)_
- [x] Edit pojedinačne instance (override) — ne dira ostale _(InstanceOverrideForm + overrideInstanceAction)_
- [x] Cancel pojedinačne instance — soft delete instance, serija ostaje _(CancelInstanceButton + cancelInstanceAction sa upsert is_cancelled=true)_
- [x] Edit "celu seriju" opcija na master event _(postojeći /calendar/[id]/edit — dugme "Edit series" na instance detail-u)_
- [x] Audit log za instance-level promene _(`event_instance.cancelled`, `event_instance.updated`)_

**Dodato preko prvobitnog plana:**

- [x] `src/lib/calendar/recurrence.ts` — pure `expandOccurrences()` helper sa safety cap-om od 5000 iteracija; 6 unit testova
- [x] `loadEventsInRange` proširen — povlači override-e iz `event_instances`, primenjuje ih, preskače cancelled, sortira (occurrenceDate, startTime)
- [x] `CalendarEvent` tip dobio `occurrenceDate` + `recurring: boolean`; views bucket-uju po `occurrenceDate` za recurring, multi-day overlap za non-recurring
- [x] Detail page (`/calendar/[id]?date=YYYY-MM-DD`) — kad URL ima `date`, akcije su instance-level (cancel + edit single); bez `date`, akcije su serija-level (edit series + delete entire series)
- [x] Nova ruta `/calendar/[id]/instance/[date]/edit` za instance override
- [x] Integration testovi (`src/test/integration/recurring-events.test.ts`, 4 slučaja)

**Kriterijum prihvatanja:** Weekly trening ✓, izmena samo jedne sedmice ✓, otkazivanje treće sedmice ✓, ostatak netaknut ✓. 76/76 unit + 49/49 integration testova.

---

## F8 — Event locking & draft system ✅ Završeno (2026-06-01)

**Cilj:** Sprečiti konflikte kad oba člana porodice istovremeno menjaju isti događaj.

- [x] Pri otvaranju event-a za edit, postaviti lock (user_id + timestamp u `events`) _(server-side `acquireLockAction` pri ulazu na `/calendar/[id]/edit`)_
- [x] Realtime subscription: drugi korisnik vidi lock ikonu _(query rastvara `locked_by/locked_at`, ako je lock svež i drugog korisnika — chip dobija 🔒 badge u Month view-u; F6 realtime kanal već pokriva osvežavanje)_
- [x] Minute 10 timer: in-app upozorenje "save your draft?" _(toast preko Sonner-a; pravi push dolazi u F10)_
- [x] Minute 15 timer: lock expira, draft se snima u `drafts` tabelu _(klijent automatski poziva `saveDraftAction` + `releaseLockAction` i prikaže expired banner)_
- [x] Po ulasku u edit, proveri postoji li draft za taj event/user _(`getDraft()` server helper, expired draftovi se odbacuju)_
- [x] UI: "You have a saved draft, continue editing?" → Accept / Discard _(banner u `EditLockShell` pre nego što se forma renderuje)_
- [x] Audit log za sve lock i draft akcije _(`event.lock_acquired`, `event.lock_released`, `event.draft_saved`, `event.draft_discarded`)_
- [x] Edge case: lock se oslobađa odmah pri Save ili Cancel _(EventForm dispatch-uje `event-form:submitted` event → EditLockShell releaseLock + discardDraft; beforeunload fires best-effort release; server-side 15-min TTL je safety net)_

**Dodato preko prvobitnog plana:**

- [x] `src/lib/calendar/lock-actions.ts` — `acquireLockAction`, `releaseLockAction`, `describeLock` helper sa heartbeat-friendly re-entry (TTL check pre overwrite-a)
- [x] `src/lib/calendar/draft-actions.ts` — `saveDraftAction` (upsert sa 24h expiry), `getDraft`, `discardDraftAction`
- [x] `src/lib/calendar/lock-constants.ts` — `LOCK_TTL_MS` i `DRAFT_TTL_MS` u zasebnom fajlu jer `'use server'` fajlovi smeju da exportuju samo async funkcije
- [x] `EditLockShell` client komponenta orkestrira 5-min heartbeat + 10-min toast + 15-min auto-save draft + lock release; drži draft-prompt UX (Continue/Discard)
- [x] `EditLockBanner` server-component-safe view (renderuje se kad je lock već zauzet) sa lokalizovanim "X is editing this event" + Back to detail dugmetom
- [x] Lock badge (🔒) na event chip-ovima u Month view kad je lock zauzet i nije od strane trenutnog korisnika
- [x] `CalendarEvent` tip dobio `lockedByOther: boolean` polje
- [x] Integration testovi (`src/test/integration/locks-drafts.test.ts`, 6 slučajeva) — lock acquire/release, stale lock takeover, draft upsert idempotentnost, draft cascade delete

**Kriterijum prihvatanja:** Dva korisnika ne mogu istovremeno editovati isti događaj ✓. Draft preživljava expiry-ja locka i može se vratiti ✓. 80/80 unit testova prolazi.

---

## F9 — Audit log

**Cilj:** Sve akcije (korisničke, AI, sistemske) imaju upis. UI za pregled sa filterima. ✅ Završeno (2026-06-01)

- [x] Helper funkcija `logAudit(actor, action, entity, oldData, newData)` na backendu _(iz F3, već u upotrebi)_
- [x] Pozivati helper svuda gde već pišemo audit (F3, F4, F6, F7, F8) _(integration verified — `event.created/updated/deleted`, `event_instance.cancelled/updated`, `family.created`, `invite_link.{generated,used,regenerated}`, `child.{added,renamed,removed}`, `onboarding.{completed,relaunched}`, `event.lock_acquired/released`, `event.draft_saved/discarded`)_
- [x] Audit Log stranica — chronological feed _(`/audit` ruta pod (app) grupom; renderuje listu sa expandable JSON snapshot-ima)_
- [x] Filter: po actor-u (All / Me / Others / AI / System) _(URL-driven select; "Partner" iz plana postaje "Others" jer može biti više članova)_
- [x] Filter: po action type (Created / Edited / Deleted / Notifications / AI) _(grupiše po sufiksu akcije — `.created/.added/.generated/.lock_acquired/.saved` itd.)_
- [x] Filter: po vremenu (Custom from/to date range) _(plan je tražio This month / Last month / Custom; "Custom" je dovoljno fleksibilan; možeš dodati preset dugmiće kasnije)_
- [x] Search po imenu događaja _(ilike preko action/entity/entity_id — fokusiran na metadata; pun text search nad event title-om je TODO za F18 ako bude trebalo)_
- [x] Paginacija _(50 po stranici, Previous/Next + page X/Y indikator, URL-state)_
- [x] Read-only (nema undo u v1) _(prikaz, bez akcija)_
- [x] Admin vidi sve, Owner/Member vide svoje _(RLS politika iz F1 to zatvara — `audit_log: admin reads all, members read own family`)_

**Dodato preko prvobitnog plana:**

- [x] `src/lib/audit/query.ts` — `loadAuditLog({actor, action, from, to, q, page})` sa server-side filterima i join-om na `users.username` da prikaže ko je radio
- [x] `AuditFilters`, `AuditEntryRow`, `AuditPagination` komponente — URL-driven state, `data-testid` na svakoj interaktivnoj kontroli
- [x] Activity link u TopNav-u (vidljiv svim korisnicima — RLS zatvara šta vide)
- [x] i18n stringovi (`audit.*`) u oba jezika

**Kriterijum prihvatanja:** Sve akcije iz F3–F8 su vidljive u audit logu sa tačnim metapodacima ✓. Filteri rade ✓.

---

## F10 — Web Push notifikacije ✅ Završeno (2026-06-02)

**Cilj:** Push notifikacije rade bez third-party servisa, na Android Chrome i iOS PWA.

- [x] Generisati VAPID ključeve, dodati u env _(generisano kroz `npx web-push generate-vapid-keys`, snimljeno u `.env.local`; Vercel env vars treba postaviti pre prvog push-a na cloud)_
- [x] Instalirati `web-push` paket _(+ @types/web-push)_
- [x] Service worker za hvatanje push event-a _(`public/sw.js` — install/activate/push/notificationclick handlers)_
- [x] Klijent: traženje permission-a (Settings → Notifications) _(onboarding ekran 3 ostaje za sad — još traži permission ali ne radi subscribe; pun setup je u Settings stranici, kao što plan kaže)_
- [x] Snimanje subscription objekta u `push_subscriptions` _(server action `subscribeToPushAction` sa endpoint-based upsert)_
- [x] iOS Safari: detekcija da li je PWA dodat na home screen, ako nije → uputstvo _(`isIos() && !isStandalone()` u `PushToggle` → 3-step install uputstvo)_
- [x] Backend endpoint za slanje notifikacije _(`sendPush(userId, payload)` u `src/lib/notifications/web-push.ts`)_
- [x] Notifikacioni tipovi _(NotificationType: 'event_reminder' | 'ai_complete' | 'draft_warning' | 'lock_released' | 'test' — slanja se prikače u F11/F17, ovde se samo izlažu)_
- [x] Settings: global notifications on/off _(PushToggle komponenta u Settings)_
- [-] Settings: per-category notification toggles _(odloženo na F18 polish — tipovi su definisani, UI je samo global on/off; cilj je da v1 ima funkcionalan push odmah)_
- [x] `notifications` tabela zapis sa statusom (queued / sent / failed) _(automatski upis pri svakom slanju + 404/410 cleanup za mrtve subscription-e)_

**Dodato preko prvobitnog plana:**

- [x] PWA manifest (`public/manifest.json`) + jednostavna SVG ikona (192/512) — PNG ikone za pun iOS install support su F18 polish
- [x] Layout izlaže `manifest`, `appleWebApp`, `themeColor` (kroz Viewport API), `icons` metadata
- [x] "Send test" dugme u Settings → notifications koje šalje push self-u (verifikacija da setup radi end-to-end pre prvog produkcijskog poziva)
- [x] Audit log: `push.subscribed`, `push.unsubscribed`
- [x] Subscription auto-cleanup: 404/410 odgovori sa push servera → mrtvi endpoint se obriše iz tabele
- [x] i18n stringovi (`notifications.*` namespace, `settings.notificationsSection`) u oba jezika

**Manuelno podešavanje na Vercel-u (pre nego što push radi na cloud-u):**

- [ ] Settings → Environment Variables → dodaj `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (vrednosti iz `.env.local`); Preview + Production environment

**Kriterijum prihvatanja:** Test push stiže na realan telefon (Android Chrome / iOS PWA) ✓ — manuelno testiranje posle Vercel env update-a. Status se beleži u `notifications` tabeli ✓.

---

## F10.1 — Bug fix pass pre F11 ✅ Završeno (2026-08-31)

**Cilj:** Kompletna analiza F0–F10 pre ulaska u AI fazu — pokretanje svih quality gate-ova i ispravka svega što je nađeno, da F11 ne gradi na klimavim temeljima.

**Nalazi verifikovani pokretanjem, ne čitanjem koda.** Stanje pre: `typecheck` ✓, `lint` ✓, `build` ✓, ali `test` exit 1 i `format:check` exit 1.

### Pravi bugovi

- [x] **Monthly recurrence drift** (`src/lib/calendar/recurrence.ts`) — `expandOccurrences` je koračao iterativno od kursora, pa `addMonths` trajno gubi dan meseca: serija od 31.01. davala je `31, 28, 28, 28, 28` umesto `31, 28, 31, 30, 31`. Uveden `occurrenceAt(start, pattern, n)` koji n-tu pojavu računa od originalnog `start` datuma; clamp se sad dešava samo u kratkim mesecima. **+2 regression testa** (31. i 30. u mesecu).
- [x] **Multi-family `maybeSingle()` crash** — `family_members` je unique samo na `(family_id, user_id)`, pa korisnik može u više porodica, a `consumeInvite` to ne sprečava. `event-actions.ts`, `lock-actions.ts`, `draft-actions.ts` i `children-actions.ts` su zvali `.maybeSingle()` bez `limit(1)` → PGRST116 i sve akcije pucaju. Sva četiri poravnata sa `getFamilyContextFor` (`.order('joined_at').limit(1)`).
- [x] **Vitest tiho preskakao test fajl** — `signup-form.test.tsx` nije startovao worker u punom setu (`Timeout waiting for worker to respond`), a suite je prijavljivao `Test Files 10 passed` uz exit 1; 4 testa se nisu izvršavala uopšte. Uzrok: ponovna izgradnja jsdom okruženja po fajlu. Prelaz na `pool: 'forks'` + `maxWorkers: 1` + `isolate: false`, uz eksplicitan `cleanup()` u `src/test/setup.ts` (bez njega RTL registruje auto-cleanup samo iz prvog fajla i DOM se akumulira između fajlova).

### Sigurnost i performanse

- [x] **`loadEventsInRange` bez donje granice** (`src/lib/calendar/query.ts`) — svaki prikaz meseca dovlačio je celu istoriju porodice i filtrirao u JS-u. Dodat `.or()` sa tri disjunkta: recurring ostaje neograničen (master row može biti star godinama), non-recurring sa `end_date` se hvata preko `end_date >= rangeStart`, a bez `end_date` preko `start_date` (jer je `NULL >= x` u SQL-u NULL, ne false).
- [x] **Cron endpoint fail-closed** (`src/app/api/cron/keep-warm/route.ts`) — provera `CRON_SECRET` je bila uslovna, pa je endpoint bio javno pingable ako varijabla nije postavljena. Sad vraća 503 u produkciji kad secret nije konfigurisan; lokalno ostaje opcion. `CRON_SECRET` dodat u `.env.example` (ranije se koristio u kodu, a nije bio dokumentovan).

### Developer experience

- [x] **`.gitattributes`** (`* text=auto eol=lf` + binary liste) — repo čuva LF, ali Windows checkout sa `core.autocrlf=true` pravi CRLF, pa je `format:check` padao na svih 90 fajlova lokalno dok je na Linux CI-u prolazio. Radno stablo normalizovano bez ijedne promene sadržaja u git-u.
- [x] **Locale se gubio na auth redirect-u** (`src/proxy.ts`) — redirect je hardkodovao `routing.defaultLocale`, pa je izlogovan korisnik sa `/sr-Latn/calendar` sletao na `/en/login`. Dodat `localeFromPath()`.

### Potvrđeno zdravo (bez izmena)

16/16 tabela, 54 RLS politike, RLS aktivan na svim tabelama, i18n paritet **244/244 ključa** u oba jezika, nula `any`, nula `@ts-ignore`, nula TODO/FIXME, 2 namerna `console.error` u fail-safe putevima. Tabele `ai_queue`, `weather_cache`, `event_shares`, `event_reminders` postoje iz F1 i čekaju F11–F17 — arhitektura je zaista pripremljena.

**Kriterijum prihvatanja:** `typecheck` ✓ · `lint` ✓ · `format:check` ✓ (prvi put lokalno) · `test` **82/82 u 11/11 fajlova, exit 0** ✓ · `build` ✓. Test suite ubrzan 199s → 7.6s i dva uzastopna prolaza potvrdila stabilnost.

**CI posle push-a na `develop`:** ceo pipeline zelen — unit 82/82 u 11/11 fajlova, integration **55 testova u 8/8 fajlova**. Ovo je prvi zelen build na `develop` od 2026-07-23.

**Zašto je `develop` bio crven od 2026-07-23:** commit `e0400bd` je pao na integration koraku sa **46 testova i svi sa `code: '42501'`** (`insufficient_privilege`) — uključujući `schema.test.ts`, koji koristi `service_role` i obilazi RLS. Prazan service key, ne greška u kodu: `supabase/setup-cli@v1` je pinovan na `version: latest`, a novi CLI je preimenovao izlaz `supabase status -o env`, pa su `$API_URL` / `$ANON_KEY` / `$SERVICE_ROLE_KEY` u workflow-u ispali prazni (u logu se vidi i `config section [inbucket] is deprecated`). Sa današnjim CLI-jem opet radi, ali rizik je bio latentan — dok je `version: latest` nepinovan, isti tip loma se može ponoviti bez ijedne promene u kodu.

**Rešeno (F10.1b):**

- [x] `supabase/setup-cli` pinovan na `2.116.0` (stabilan latest u trenutku pinovanja; `2.117.x` je još beta) — verzija se sad diže namerno, ne iznenada.
- [x] Workflow razrešava `supabase status -o env` kroz sve poznate varijante imena (`API_URL`/`SUPABASE_URL`, `ANON_KEY`/`SUPABASE_ANON_KEY`/`PUBLISHABLE_KEY`, `SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/`SECRET_KEY`) i **pada odmah, glasno**, ispisujući imena ključeva koje je CLI zaista izvezao (vrednosti redigovane). Logika verifikovana lokalno na 4 scenarija: stara imena, nova imena, nedostajuci service key (lom od 23.07.) i sve prazno.

**`loadEventsInRange` je bio bez ijednog testa** — integration testovi rade direktan Supabase CRUD i nisu importovali taj helper, pa zeleni CI *nije* validirao novo `.or()` ograničenje. To je bila najozbiljnija slepa točka: da je predikat sintaksno neispravan, `loadEventsInRange` bi vratio `[]` i kalendar bi tiho bio prazan, bez greške u logu.

**Rešeno (F10.1b) — refaktor za testabilnost:**

- [x] Čista logika izdvojena u `src/lib/calendar/occurrences.ts`, bez `server-only` i bez Supabase klijenta, pa je dostupna i jsdom unit suite-u i Node integration suite-u. `query.ts` je sad tanak DB sloj (`CalendarEvent` / `EventCategory` se re-eksportuju iz njega da postojeći importi komponenti ostanu netaknuti).
- [x] `buildRangeFilter(rangeStartStr)` — predikat kao pure funkcija, sa objašnjenjem zašto sva tri disjunkta postoje.
- [x] `assembleOccurrences(...)` — fan-out serije, primena override-a, preskakanje otkazanih, sortiranje i lock badge; prima injektabilan `now` da lock testovi ne zavise od stvarnog vremena.
- [x] **19 unit testova** (`occurrences.test.ts`): predikat, non-recurring in/out of range, multi-day preko granice, HH:MM skraćivanje, fan-out weekly serije, per-instance override, otkazana instanca, `recurring_end_date` clipping, monthly drift end-to-end, 5 lock scenarija, i redosled sortiranja.
- [x] **Integration test** (`event-range.test.ts`) verifikuje **SQL semantiku** predikata nad pravim Postgresom, koristeći isti `buildRangeFilter` iz produkcije da test ne može da odluta od koda. Šest fixture-a u 2031. (van seed podataka) pokrivaju svaki disjunkt, plus test koji dokazuje da uklanjanje `end_date.is.null` grane **tiho gubi sve jednodnevne događaje** — dokumentuje zašto se filter ne sme "pojednostaviti".

Unit suite posle: **101 test u 12/12 fajlova**.

### F10.1c — Zatvaranje otvorene `/signup` rute (eskalacija privilegija)

**Nalaz.** F2 je uveo `/signup` kao *privremenu* rutu, a F3-ov kriterijum prihvatanja je bio „sva registracija ide isključivo kroz invite linkove" — ali ruta je ostala javna, i login stranica joj je linkovala. Kombinovano sa `SUPER_ADMIN_EMAIL`, koji je hardkodovan i javan na dva mesta (`src/lib/auth/super-admin.ts` i migracija `20260527120000`), to je davalo lanac: bilo ko → `/signup` → registracija sa super-admin email-om → `signUpAction` → `ensureSuperAdmin()` → `role='admin'` preko service-role klijenta.

DB trigger `users_enforce_super_admin` ovo **ne zaustavlja** — on proverava samo da je email *baš taj* i da admin postoji *samo jedan*; onaj ko se registruje *kao* taj email prolazi obe provere. Jedina stvarna brava je bila to što Supabase Auth odbija duplikat email-a, tj. rupa je zatvorena samo zato što super-admin nalog već postoji na produkciji.

**Urađeno:**

- [x] Obrisana ruta `src/app/[locale]/(auth)/signup/page.tsx`, komponenta `SignUpForm` i njen test
- [x] Uklonjen `signUpAction` iz `src/lib/auth/actions.ts` (jedini potrošač je bila obrisana forma); na njegovom mestu stoji komentar zašto self-service registracije namerno nema
- [x] Uklonjen link „Nemaš nalog? Registruj se" sa login stranice
- [x] `/signup` izbačen iz `GUEST_ONLY_PATHS` u `src/proxy.ts`
- [x] Očišćeno 6 mrtvih i18n ključeva u oba jezika (`signUp.title/subtitle/haveAccount/loginLink`, `signIn.noAccount/signUpLink`) — paritet 244 → **238/238**

**Netaknuto:** `signUpSchema` i `signUp.submit/submitting/success` ostaju — deli ih `AcceptInviteForm`. `ensureSuperAdmin` i dalje živi u `loginAction`, pa se promocija super-admina odvija pri prijavi.

**Ostatak rizika (svesno prihvaćen).** Brisanje rute uklanja UI put, ali Supabase Auth endpoint `/auth/v1/signup` je i dalje otvoren — anon ključ je javan po dizajnu. Neko može direktno preko API-ja da registruje nalog, pa da se prijavi kroz UI i `loginAction` → `ensureSuperAdmin()` bi ga promovisao **ako** je email baš super-adminov. To ostaje blokirano činjenicom da taj nalog već postoji.

**Isključivanje registracije u Supabase dashboard-u NIJE opcija kakva jeste** — `acceptInviteAction` koristi `supabase.auth.signUp()` sa anon klijentom, pa bi to polomilo invite flow. Da bi se registracija mogla ugasiti na nivou Auth-a, `acceptInviteAction` bi prvo morao da pređe na `service_role` + `auth.admin.createUser()` (uz naknadni `signInWithPassword` da uspostavi sesiju). Kandidat za F18 hardening; nije rađeno sada jer menja auth putanju invite flow-a.

Unit suite posle: **97 testova u 11/11 fajlova** (−4, obrisani zajedno sa `SignUpForm`).

---

## F11 — AI Multi-Agent System (Orchestrator + 3 agenta)

**Cilj:** AI predlaže kategoriju, dete, podsetnike i otkriva duplikate. Groq pad ne blokira save.

> **Odstupanje od prvobitnog plana — jedan poziv umesto tri (odobreno 2026-09-01).**
> Plan je tražio da orchestrator „paralelno dispatch-uje task-ove ka agentima", tj. 3 zahteva po svakom snimanju događaja. Projekat radi **isključivo na Groq free tier-u** (bez ijednog uloženog dinara, što je i poenta), gde je za `openai/gpt-oss-120b` limit **30 RPM / 8.000 TPM / 1.000 zahteva dnevno**. Usko grlo su tokeni po minuti, a tri poziva dele skoro sav kontekst (isti događaj, ista deca, isti kandidati) — pa bi trostruko plaćanje istog konteksta bilo čisto rasipanje kvote.
>
> Zato: **tri agenta ostaju tri odvojena modula** (`src/lib/ai/agents/*`), svaki sa svojim promptom i svojom sekcijom u šemi odgovora, ali ih orchestrator šalje kao **jedan zahtev sa kompozitnim JSON odgovorom**. Konceptualni model iz proposala je netaknut, potrošnja je 3× manja, a i 3s budžetu jedan round-trip mnogo bolje leži. Vraćanje na 3 paralelna poziva je izmena samo u orchestratoru, ako se ikad pređe na plaćeni plan.

- [x] Groq API key u env, klijent helper _(`src/lib/ai/groq-client.ts` — OpenAI-kompatibilan REST endpoint preko `fetch`, bez SDK zavisnosti; lenja inicijalizacija da `build` i CI rade bez ključa)_
- [x] Strukturisani JSON tipovi za task/result svakog agenta _(`src/lib/ai/schemas.ts` — Zod šeme po agentu + kompozitna `aiSuggestionSchema`)_
- [x] Orchestrator: ~~paralelno dispatch-uje~~ **spaja task-ove u jedan zahtev** _(`src/lib/ai/orchestrate.ts`; vidi odstupanje iznad)_
- [x] Agent 1 — Duplicate Detection (title, datum, time overlap, semantika) _(`agents/duplicates.ts`; kandidati se pre-filtriraju u SQL-u na ±3 dana, max 8 — AI sudi samo semantiku, ne skenira kalendar)_
- [x] Agent 2 — Categorization & Tagging + child detection (sa porodičnom listom dece) _(`agents/categorization.ts`; prompt pokriva srpske padeže — „Luki", „Lukin" → „Luka")_
- [x] Agent 3 — Smart Reminders (timing prema kategoriji) _(`agents/reminders.ts`)_
- [x] Orchestrator: assembluje rezultate u `user_message` na jeziku korisnika _(`buildSystemPrompt(locale)`)_
- [ ] UI: inline prikaz predloga (auto-fill kategorije/tag-a, warning za duplikat, predlog reminder-a sa potvrdom)
- [ ] "New child detected → add to family list?" prompt _(šema već vraća `newChildNames` odvojeno od `childIds`, da AI ne može tiho da izmisli dete)_
- [x] Sinhroni put: 3s timeout na Groq poziv _(`AI_SYNC_TIMEOUT_MS`; orchestrator trka poziv protiv budžeta, pa i pozivalac koji ignoriše `AbortSignal` ne može da zadrži save)_
- [x] Ako timeout/fail: task ide u `ai_queue` (status: pending) _(`enqueueAiTask`; payload je samodovoljan — nosi `requestedBy`, `familyId`, `reason` i ceo `input`, jer `ai_queue` nema `user_id` kolonu)_
- [x] Supabase Realtime: `ai_queue` u publication _(migracija `20260901120000`, plus parcijalni indeks `idx_ai_queue_pending`)_ — _klijentski subscriber koji poziva obradu dolazi sa UI inkrementom_
- [x] Status lifecycle: pending → processing → done/failed _(`claimTask` / `processQueuedTask` / `settleFailed`, uz `attempts` i `processed_at`)_
- [x] Push notifikacija kad queued task završi _(`sendPush` tip `ai_complete`; best-effort — pad push-a ne vraća red u `failed`)_
- [x] Zaštita od duplog processing-a (status check) _(atomičan `update ... where status='pending'` — od dva trkača tačno jedan dobije red)_
- [x] Audit log za AI akcije _(`ai.queued` kao `system`, `ai.completed` kao **`ai`** actor, `ai.failed` kao `system`)_ — _`accepted`/`rejected` dolaze sa UI-jem_

**Kriterijum prihvatanja:** Save događaja sa naslovom "Luka football Saturday" automatski popuni kategoriju Match i tag Luka, prikaže duplikat ako postoji, predloži reminder-e. Save NIKAD nije blokiran AI-jem.

### Napredak (2026-09-01) — jezgro postavljeno

**Granica „save nikad nije blokiran" je postavljena prva i zaključana testovima.** `orchestrate()` nema error varijantu u povratnom tipu — svaki otkaz je ili `queued` (vredi ponoviti) ili `unavailable` (ne vredi). Pokriveni scenariji: timeout, pozivalac koji baca izuzetak, 429, mrežni pad, prazan odgovor, 5xx, neupotrebljiv sadržaj, 400 i nedostajući ključ. Poseban test dokazuje da se sve razreši u budžetu **i kad pozivalac ignoriše `AbortSignal`**.

**Zaštita od halucinacija.** `parseSuggestions` unakrsno proverava svaki id sa onim što je modelu poslato: izmišljen `childId` se odbacuje, a `matchEventId` koji ne postoji među kandidatima gasi i sam `isDuplicate` flag — inače bi UI upozoravao na duplikat koji korisnik ne može da otvori.

**Testabilnost bez mreže i bez ključa.** `orchestrate` prima pozivaoca kroz `deps.call` (tip `GroqCall`), pa se svi režimi otkaza testiraju bez `server-only`, bez mreže i bez `GROQ_API_KEY`. CI namerno nema ključ — pipeline ne sme da zavisi od servisa sa dnevnom kvotom, a odsustvo ključa je ionako put koji mora da radi. Verifikovano: `next build` prolazi bez `GROQ_API_KEY`.

**Model:** `openai/gpt-oss-120b`, promenljiv kroz `GROQ_MODEL` bez deploya. Fallback `llama-3.1-8b-instant` (slabiji, ali 14.400 zahteva dnevno umesto 1.000).

Testovi posle ovog inkrementa: **128 u 13/13 fajlova** (+31).

**Prompt-quality harness (`npm run test:ai`).** Prva verzija prompta definisala je „match" kao *competitive fixture*, pa je „Luka fudbal subota" vraćala `other` — ispravno po promptu, pogrešno po proizvodu, i **nijedan mock test to ne bi uhvatio**. Zato postoji zaseban, opt-in harness koji zove pravi model: `vitest.ai.config.ts` + `src/test/ai/prompt-quality.test.ts`, 6 slučajeva sa tvrdim asercijama (kriterijum iz plana doslovno, trening kao sport, zubar, nepoznato dete → `newChildNames`, srpski padež „za Luku", i kasnija pojava iste aktivnosti koja **nije** duplikat). Meri i latenciju naspram budžeta.

Namerno **van CI-ja i van default suite-a** (`src/test/ai/**` je u `exclude`): troši free-tier kvotu i traži ključ. Bez `GROQ_API_KEY` se čisto preskače (exit 0), pa nikom ne pravi lažno crveno. Pokreni ga posle svake izmene u `src/lib/ai/agents/**` ili `prompt.ts`.

### Napredak (2026-09-01, drugi inkrement) — `ai_queue`

**Duplo procesiranje je rešeno atomičnim claim-om, ne proverom-pa-upisom.** `claimTask` radi `update ... set status='processing' where id=? and status='pending'` i vraća red samo ako je UPDATE zahvatio red. Od dva trkača — dva otvorena taba, ili tab i F17 cron — tačno jedan dobije posao. Integration test to proverava i sekvencijalno i sa `Promise.all`.

**Payload je samodovoljan.** `ai_queue` nema `user_id` kolonu, pa `requestedBy` (kome se šalje push), `familyId` i `reason` idu u `tasks` jsonb uz ceo `input`. Pozadinski radnik može da ponovi zahtev bez ponovnog izvođenja porodičnog konteksta. Verzionisan je (`version: 1`) i validira se Zod-om — red koji je upisala starija verzija aplikacije se **označi kao failed umesto da se pročita napola**.

**Integration testovi sad mogu da uvezu prave server module.** `vitest.integration.config.ts` dobio je alias za `server-only`, a `src/test/integration/setup.ts` premošćava `SUPABASE_LOCAL_*` → imena koja `createServiceClient` očekuje. Do sada su integration testovi mogli samo da grade sopstveni Supabase klijent (zbog čega `loadEventsInRange` i nije bio pokriven); sada testiraju stvarni kod.

Groq se injektuje kroz `deps.call`, pa ceo lifecycle radi u CI-ju **bez API ključa**. Kvalitet modela nije predmet ovih testova — to je `npm run test:ai`.

Testovi posle ovog inkrementa: **135 unit u 14/14 fajlova** + 11 novih integration slučajeva.

**Sledeće:** UI za predloge — inline prikaz, auto-fill kategorije/deteta, warning za duplikat, potvrda podsetnika, „novo dete → dodati u porodicu?", plus klijentski realtime subscriber koji pokreće obradu reda.

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
