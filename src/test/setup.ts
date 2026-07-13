import '@testing-library/jest-dom/vitest'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
})
