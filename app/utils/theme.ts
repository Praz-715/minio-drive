/** Toggle tema — class .dark di <html> adalah satu-satunya sumber kebenaran. */
export function toggleTheme() {
  if (import.meta.server) return
  const el = document.documentElement
  const dark = !el.classList.contains('dark')
  el.classList.toggle('dark', dark)
  try {
    localStorage.setItem('yasa-theme', dark ? 'dark' : 'light')
  } catch {}
}
