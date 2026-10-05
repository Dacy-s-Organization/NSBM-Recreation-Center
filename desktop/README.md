# NSBM Recreation Center — Desktop

Windows desktop version of the Recreation Center staff portal. It is a WPF window hosting a Blazor UI (BlazorWebView on WebView2) and talks to the same Supabase project as the web app, so staff sign in with the same accounts and see the same data.

## Features

- Sign in with a staff email and password. The session is remembered between launches.
- Dashboard with student, record and inventory counts.
- Students: faculty and batch browsing, one scrolling list per batch, search, house and gender filters, add, edit (popup) and delete (confirmation popup), CSV import with preview and a downloadable template.
- Achievements: Sports Fiesta and Inter-University sections, each with an Achievements tab and an Athletic Records tab.
  - Achievements and records are added and edited in popups.
  - Achievements filter by search, year, category (Other sports or Athletics) and sport or event. The name column reads Sport, Event or Sport / Event to match the category.
  - Records filter by search, year, track and gender.
  - Changing a filter or the year shows a loading overlay over the table until the results are ready.
  - Adding a record for a track and year that another student of the same gender already holds asks whether to replace the previous record before saving.
  - The same student can't get a second record for the same track and year (use Edit instead).
  - **Add sport** (super staff, next to the section switcher) opens a popup with Other sports and Athletic events tabs to add or delete sports and events.
  - Achievements CSV import.
- Inventory: list, inline edit, add, delete.
- Light and dark theme, following Windows by default. The title bar, window border and scrollbars all follow the theme.
- Native-feeling window: themed minimize, maximize and close buttons, Windows 11 Snap Layouts on the maximize button, double-click the title bar to maximize, correct maximize above the taskbar.
- Resolution-aware sizing: opens at up to 1440x900 (90% of the screen on smaller displays), never shrinks below 960x600 (less on very small screens), sharp on high-DPI and mixed-DPI monitors, and reopens where you left it.

## Requirements

To build:

- Windows 10 1809 or later
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) 18 or later, only if you change styles (the compiled CSS is committed)

To run the published exe:

- Windows 10 1809 or later with the [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (preinstalled on Windows 11)
- No .NET install needed; the exe is self-contained

## Build and run

All commands run from the `desktop` folder.

1. **Configure Supabase.** Copy the example settings and fill in your project URL and the publishable (anon) key from the Supabase dashboard (Project Settings, API). Never use the `service_role` key.

   ```powershell
   Copy-Item RecCenter.Desktop/appsettings.example.json RecCenter.Desktop/appsettings.json
   notepad RecCenter.Desktop/appsettings.json
   ```

   `appsettings.json` is gitignored and embedded into the exe at build time. An `appsettings.json` placed next to the exe overrides the embedded one.

2. **Run in development.**

   ```powershell
   dotnet run --project RecCenter.Desktop
   ```

3. **Rebuild the stylesheet** (only after changing classes in `.razor` files or `RecCenter.Desktop/Styles/app.css`), then build again, because the CSS is embedded in the exe.

   ```powershell
   cd RecCenter.Desktop
   npm install
   npm run css
   cd ..
   ```

4. **Publish a single exe.**

   ```powershell
   dotnet publish RecCenter.Desktop -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
   ```

   This produces `publish/NSBM Recreation Center.exe` (about 70 MB). Copy that one file to any Windows PC and run it. Close any running copy of the app before publishing, or the exe can't be overwritten.

## Project layout

- `RecCenter.Core` — models, a small Supabase client (auth and PostgREST), and the services for students, records, tracks, achievements, inventory and CSV import.
- `RecCenter.Desktop` — the WPF host (`MainWindow`, custom title bar, window placement), Razor pages and components under `Components/`, Tailwind source in `Styles/app.css`, and static assets in `wwwroot/`.

## Local data

- Signed-in session: `%AppData%\NSBM Recreation Center\session.dat` (encrypted with Windows DPAPI for the current user)
- Window size, position and last theme: `%AppData%\NSBM Recreation Center\window.json`
- WebView2 cache and theme preference: `%LocalAppData%\NSBM Recreation Center\WebView2`
- Crash log: `%LocalAppData%\NSBM Recreation Center\crash.log`

Deleting `window.json` resets the window to its default size.
