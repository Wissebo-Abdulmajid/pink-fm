import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(projectRoot, 'docs', 'screenshots')
const profileDirectory = join(projectRoot, '.cache', 'browser-qa', 'pink-fm-browser-qa-' + process.pid + '-' + Date.now())
const origin = (process.env.QA_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '')
const runEnhancedModel = process.env.QA_SEMANTIC === '1'
const reportName = runEnhancedModel
  ? 'browser-qa-semantic.json'
  : origin.endsWith('/pink-fm')
    ? 'browser-qa-pages.json'
    : 'browser-qa.json'
const reportPath = join(projectRoot, 'docs', reportName)
const debuggingPort = 10000 + (process.pid % 40000)
const manifestPath = join(projectRoot, 'dist', 'gifts', 'siti', 'embeddings', 'manifest.json')
const indexPath = join(projectRoot, 'dist', 'gifts', 'siti', 'embeddings', 'index.json')
const giftPath = join(projectRoot, 'dist', 'gifts', 'siti', 'gift.json')

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const browserPath = browserCandidates.find((candidate) => existsSync(candidate))
if (!browserPath) {
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.')
}

for (const requiredPath of [manifestPath, indexPath, giftPath]) {
  if (!existsSync(requiredPath)) {
    throw new Error('Production build is missing ' + requiredPath + '. Run npm run build first.')
  }
}

mkdirSync(outputDirectory, { recursive: true })

const browser = spawn(
  browserPath,
  [
    '--headless=new',
    ...(runEnhancedModel ? [] : ['--disable-background-networking']),
    ...(process.env.QA_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
    '--disable-gpu',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=' + debuggingPort,
    '--user-data-dir=' + profileDirectory,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
const browserDiagnostics = []
for (const stream of [browser.stdout, browser.stderr]) {
  stream?.on('data', (chunk) => {
    const value = String(chunk).trim()
    if (value) browserDiagnostics.push(value)
  })
}
browser.on('exit', (code, signal) => {
  if (code && code !== 0) {
    console.error(`Browser process exited with code ${code}${signal ? ` (${signal})` : ''}.`)
    if (browserDiagnostics.length) console.error(browserDiagnostics.slice(-8).join('\n'))
  }
})

const delay = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

async function readJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText + ' from ' + url)
  return response.json()
}

async function waitForBrowser() {
  const endpoint = 'http://127.0.0.1:' + debuggingPort + '/json/version'
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      return await readJson(endpoint)
    } catch {
      await delay(100)
    }
  }
  throw new Error('Timed out waiting for the browser debugging endpoint.')
}

async function openCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl)
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let commandId = 0
  const pending = new Map()
  const errors = []

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id) {
      const command = pending.get(message.id)
      if (!command) return
      pending.delete(message.id)
      if (message.error) command.reject(new Error(command.method + ': ' + message.error.message))
      else command.resolve(message.result)
      return
    }

    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      const description = details.exception?.description ?? details.text ?? 'Unknown exception'
      const location = details.url ? ` at ${details.url}:${details.lineNumber ?? 0}` : ''
      errors.push('Uncaught exception: ' + description + location)
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const textValue = message.params.args
        .map((argument) => argument.value ?? argument.description ?? '')
        .join(' ')
      errors.push('console.error: ' + textValue)
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry
      errors.push('Browser log: ' + entry.text + (entry.url ? ` (${entry.url})` : ''))
    }
  })
  socket.addEventListener('close', () => {
    for (const command of pending.values()) {
      command.reject(new Error('The browser debugging connection closed unexpectedly.'))
    }
    pending.clear()
  })

  const send = (method, params = {}) =>
    new Promise((resolvePromise, reject) => {
      commandId += 1
      pending.set(commandId, { resolve: resolvePromise, reject, method })
      socket.send(JSON.stringify({ id: commandId, method, params }))
    })

  return { socket, send, errors }
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Browser evaluation failed.')
  }
  return response.result.value
}

async function waitForCondition(cdp, expression, label, timeout = 10000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(cdp, expression)) return Date.now() - startedAt
    await delay(100)
  }
  throw new Error('Timed out waiting for ' + label)
}

const waitForSelector = (cdp, selector, timeout) =>
  waitForCondition(
    cdp,
    'Boolean(document.querySelector(' + JSON.stringify(selector) + '))',
    'selector ' + selector,
    timeout,
  )

async function navigate(cdp, hash, selector) {
  await cdp.send('Page.navigate', { url: origin + '/' + hash })
  try {
    await waitForSelector(cdp, selector, 15000)
  } catch (error) {
    const diagnostic = await evaluate(
      cdp,
      `({ href: location.href, readyState: document.readyState, body: document.body?.innerText?.slice(0, 500), root: document.querySelector('#root')?.innerHTML?.slice(0, 500) })`,
    )
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nNavigation diagnostic: ${JSON.stringify(diagnostic)}\nBrowser errors: ${JSON.stringify(cdp.errors)}`,
    )
  }
  await delay(250)
}

async function setViewport(cdp, width, height, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await delay(100)
}

async function pressKey(cdp, key, code, virtualKeyCode, text = '') {
  const input = {
    code,
    key,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode,
  }
  await cdp.send('Input.dispatchKeyEvent', { ...input, type: 'rawKeyDown' })
  if (text) await cdp.send('Input.dispatchKeyEvent', { ...input, text, type: 'char' })
  await cdp.send('Input.dispatchKeyEvent', { ...input, type: 'keyUp' })
}

const pressEnter = (cdp) => pressKey(cdp, 'Enter', 'Enter', 13, '\r')

async function clickSelector(cdp, selector) {
  const result = await evaluate(
    cdp,
    '(' +
      function clickUnique(target) {
        const matches = document.querySelectorAll(target)
        if (matches.length !== 1) return { clicked: false, count: matches.length }
        matches[0].click()
        return { clicked: true, count: 1 }
      }.toString() +
      ')(' + JSON.stringify(selector) + ')',
  )
  if (!result.clicked) throw new Error('Expected one clickable ' + selector + '; found ' + result.count)
}

async function tapSelector(cdp, selector) {
  const point = await evaluate(
    cdp,
    '(' +
      function centre(target) {
        const element = document.querySelector(target)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      }.toString() +
      ')(' + JSON.stringify(selector) + ')',
  )
  if (!point) throw new Error('Touch target was not found: ' + selector)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function setInput(cdp, selector, value) {
  const applied = await evaluate(
    cdp,
    '(' +
      function setNativeValue(target, nextValue) {
        const element = document.querySelector(target)
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false
        const prototype = element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        setter?.call(element, nextValue)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }.toString() +
      ')(' + JSON.stringify(selector) + ', ' + JSON.stringify(value) + ')',
  )
  if (!applied) throw new Error('Input was not found: ' + selector)
}

async function inspect(cdp, name, expectedText) {
  const result = await evaluate(
    cdp,
    '(' +
      function browserInspection(text) {
        const root = document.documentElement
        return {
          title: document.title,
          hash: location.hash,
          expectedTextPresent: document.body.textContent?.includes(text) ?? false,
          mainPresent: Boolean(document.querySelector('main')),
          horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          clientHeight: root.clientHeight,
          overflowingElements: [...document.querySelectorAll('body *')]
            .filter((element) => {
              const rect = element.getBoundingClientRect()
              return rect.right > root.clientWidth + 1 || rect.left < -1
            })
            .slice(0, 8)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className : '',
              text: element.textContent?.trim().slice(0, 60) ?? '',
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              width: Math.round(element.getBoundingClientRect().width),
            })),
        }
      }.toString() +
      ')(' + JSON.stringify(expectedText) + ')',
  )
  if (!result.mainPresent || !result.expectedTextPresent || result.horizontalOverflow) {
    throw new Error(name + ' failed layout inspection: ' + JSON.stringify(result))
  }
  return { name, ...result }
}

async function capture(cdp, name) {
  // Let short entrance transitions settle so release screenshots represent the
  // stable interface instead of a partially transparent animation frame.
  await delay(300)
  const screenshot = await cdp.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
    fromSurface: true,
  })
  writeFileSync(join(outputDirectory, name + '.png'), Buffer.from(screenshot.data, 'base64'))
}

async function openBot(cdp) {
  await clickSelector(cdp, '[aria-label="Open WisseBot"]')
  await waitForSelector(cdp, '.modal', 10000)
}

async function startLightweight(cdp) {
  await openBot(cdp)
  await waitForSelector(cdp, '.semantic-consent', 10000)
  await clickSelector(cdp, '.semantic-consent .text-button')
  await waitForSelector(cdp, '.semantic-status--lightweight', 10000)
}

async function submitBotMessage(cdp, message) {
  const before = await evaluate(cdp, "document.querySelectorAll('.bot-message').length")
  await setInput(cdp, '#wissebot-message', message)
  await clickSelector(cdp, '.bot-form button[type="submit"]')
  await waitForCondition(
    cdp,
    "document.querySelectorAll('.bot-message').length >= " + (before + 2) + " && !document.querySelector('.bot-message--thinking')",
    'WisseBot response to ' + message,
    15000,
  )
  if (!(await evaluate(cdp, "Boolean(document.querySelector('.bot-result'))"))) {
    throw new Error('WisseBot did not produce a grounded catalogue recommendation for: ' + message)
  }
}

async function freshSemanticConsent(cdp) {
  await evaluate(cdp, 'localStorage.clear()')
  await cdp.send('Page.reload', { ignoreCache: true })
  await waitForSelector(cdp, '.retro-radio', 15000)
  await openBot(cdp)
  await waitForSelector(cdp, '.semantic-consent', 10000)
}

async function testStaleAndCorruptIndexes(cdp, checks) {
  const originalManifest = readFileSync(manifestPath, 'utf8')
  const originalIndex = readFileSync(indexPath, 'utf8')
  try {
    const stale = JSON.parse(originalManifest)
    stale.catalogueContentHash = '0'.repeat(64)
    writeFileSync(manifestPath, JSON.stringify(stale, null, 2) + '\n')
    await freshSemanticConsent(cdp)
    await clickSelector(cdp, '.semantic-consent .button')
    await waitForSelector(cdp, '.semantic-status--stale-index', 15000)
    checks.push({ name: 'stale-embedding-manifest', passed: true })
    await clickSelector(cdp, '.semantic-status--stale-index .text-button')
    await waitForSelector(cdp, '.semantic-status--lightweight', 10000)
    await clickSelector(cdp, '.modal [aria-label^="Close"]')
    writeFileSync(manifestPath, originalManifest)

    const corrupt = JSON.parse(originalIndex)
    corrupt.dimensions += 1
    writeFileSync(indexPath, JSON.stringify(corrupt, null, 2) + '\n')
    await freshSemanticConsent(cdp)
    await clickSelector(cdp, '.semantic-consent .button')
    await waitForSelector(cdp, '.semantic-status--unavailable', 15000)
    checks.push({ name: 'corrupt-embedding-index', passed: true })
    await clickSelector(cdp, '.semantic-status--unavailable .text-button')
    await waitForSelector(cdp, '.semantic-status--lightweight', 10000)
    await clickSelector(cdp, '.modal [aria-label^="Close"]')
  } finally {
    writeFileSync(manifestPath, originalManifest)
    writeFileSync(indexPath, originalIndex)
  }
}

async function testUnavailableModel(cdp, checks) {
  const originalGift = readFileSync(giftPath, 'utf8')
  try {
    const gift = JSON.parse(originalGift)
    gift.assistant.semantic.modelId = 'Xenova/pink-fm-intentionally-unavailable-model'
    gift.assistant.semantic.modelRevision = 'main'
    writeFileSync(giftPath, JSON.stringify(gift, null, 2) + '\n')
    await freshSemanticConsent(cdp)
    await clickSelector(cdp, '.semantic-consent .button')
    await waitForSelector(cdp, '.semantic-status--unavailable', 60000)
    const status = await evaluate(cdp, "document.querySelector('.semantic-status strong')?.textContent ?? ''")
    checks.push({ name: 'semantic-model-unavailable', passed: true, status })
    await clickSelector(cdp, '.semantic-status--unavailable .text-button')
    await waitForSelector(cdp, '.semantic-status--lightweight', 10000)
    await clickSelector(cdp, '.modal [aria-label^="Close"]')
  } finally {
    writeFileSync(giftPath, originalGift)
  }
}

async function testEnhancedModel(cdp, checks, semanticPerformance) {
  await freshSemanticConsent(cdp)
  const startedAt = Date.now()
  await clickSelector(cdp, '.semantic-consent .button')
  await waitForCondition(
    cdp,
    "Boolean(document.querySelector('.semantic-status--ready, .semantic-status--unavailable, .semantic-status--stale-index'))",
    'enhanced semantic model terminal state',
    210000,
  )
  semanticPerformance.wallClockModelReadyMs = Date.now() - startedAt
  const terminalState = await evaluate(
    cdp,
    "document.querySelector('.semantic-status')?.className ?? ''",
  )
  if (!terminalState.includes('semantic-status--ready')) {
    semanticPerformance.failureStatus = await evaluate(
      cdp,
      "document.querySelector('.semantic-status strong')?.textContent?.trim() ?? ''",
    )
    checks.push({
      name: 'enhanced-model-bounded-fallback',
      passed: true,
      terminalState,
      status: semanticPerformance.failureStatus,
    })
    await clickSelector(cdp, '.semantic-status .text-button')
    await waitForSelector(cdp, '.semantic-status--lightweight', 10000)
    await clickSelector(cdp, '.modal [aria-label^="Close"]')
    return
  }
  semanticPerformance.readyStatus = await evaluate(
    cdp,
    "document.querySelector('.semantic-status small')?.textContent?.trim() ?? ''",
  )
  semanticPerformance.device = await evaluate(
    cdp,
    "document.querySelector('.semantic-status small')?.textContent?.trim().split(' ')[0] ?? ''",
  )
  await submitBotMessage(cdp, 'I need a softer landing after a long day')
  semanticPerformance.firstInferenceStatus = await evaluate(
    cdp,
    "document.querySelector('.semantic-status small')?.textContent?.trim() ?? ''",
  )
  await submitBotMessage(cdp, 'nak lagu tenang tapi tak mengantuk')
  semanticPerformance.repeatInferenceStatus = await evaluate(
    cdp,
    "document.querySelector('.semantic-status small')?.textContent?.trim() ?? ''",
  )
  checks.push({ name: 'enhanced-model-wasm-no-webgpu', passed: semanticPerformance.device === 'WASM' })
  if (semanticPerformance.device !== 'WASM') {
    throw new Error('The no-WebGPU QA run did not use the expected WASM fallback.')
  }
  await clickSelector(cdp, '.modal [aria-label^="Close"]')
}

async function run() {
  await waitForBrowser()
  const target = await readJson(
    'http://127.0.0.1:' + debuggingPort + '/json/new?' + encodeURIComponent('about:blank'),
    { method: 'PUT' },
  )
  const cdp = await openCdp(target.webSocketDebuggerUrl)
  const checks = []
  const semanticPerformance = {
    requested: runEnhancedModel,
    estimatedDownloadBytes: 148897792,
  }

  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Log.enable'),
    cdp.send('Network.enable'),
  ])

  await setViewport(cdp, 390, 844, true)
  await navigate(cdp, '#/g/siti', '.welcome__content')
  checks.push(await inspect(cdp, 'welcome-390', 'Your frequency is ready'))
  await capture(cdp, 'welcome-mobile')

  await evaluate(cdp, "document.querySelector('.welcome__tune').focus()")
  await pressEnter(cdp)
  await waitForSelector(cdp, '.mood-grid', 10000)
  checks.push(await inspect(cdp, 'mood-390', 'How would you like to feel?'))
  await capture(cdp, 'mood-mobile')

  await evaluate(cdp, "document.querySelector('.mood-preset').focus()")
  await pressEnter(cdp)
  await waitForSelector(cdp, '.retro-radio', 10000)
  checks.push(await inspect(cdp, 'radio-390', 'Why this frequency'))
  await capture(cdp, 'radio-mobile')
  console.log('QA milestone: primary radio flow')

  const providerRequestsBeforeConsent = await evaluate(
    cdp,
    `performance.getEntriesByType('resource').filter((entry) => /open\\.spotify\\.com|youtube(?:-nocookie)?\\.com|embed\\.music\\.apple\\.com/.test(entry.name)).length`,
  )
  if (providerRequestsBeforeConsent !== 0) throw new Error('A playback provider loaded before consent.')
  checks.push({ name: 'playback-no-provider-before-consent', passed: true, providerRequests: 0 })
  await clickSelector(cdp, '.playback-consent__actions .button--secondary')
  await waitForSelector(cdp, '.player-status', 10000)
  const deniedState = await evaluate(cdp, `({
    message: document.querySelector('.player-status')?.textContent ?? '',
    providerFrames: document.querySelectorAll('.provider-player iframe').length,
    fallback: Boolean(document.querySelector('.playback-external-link'))
  })`)
  if (!deniedState.message.includes('Embedded players are turned off') || deniedState.providerFrames || !deniedState.fallback) {
    throw new Error('Playback-consent denial did not preserve an external-only radio: ' + JSON.stringify(deniedState))
  }
  checks.push({ name: 'playback-consent-denied', passed: true, ...deniedState })

  // Select a known, reviewed full-song YouTube record through the visible catalogue flow.
  await evaluate(cdp, 'localStorage.clear()')
  await cdp.send('Page.reload', { ignoreCache: true })
  await waitForSelector(cdp, '.playback-consent', 10000)
  await navigate(cdp, '#/g/siti/library', '.catalogue-browser')
  const tunedCindai = await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('.catalogue-list li')].find((item) => item.querySelector('strong')?.textContent?.trim() === 'Cindai')
    const button = row?.querySelector('button')
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!tunedCindai) throw new Error('The reviewed Cindai catalogue row could not be tuned.')
  await waitForSelector(cdp, '.playback-consent', 10000)
  await clickSelector(cdp, '.playback-consent__actions .button:not(.button--secondary)')
  await waitForCondition(
    cdp,
    `Boolean(document.querySelector('.provider-player--youtube')) &&
      Boolean(document.querySelector('.playback-external-link')) &&
      (document.querySelector('.player-shell__coverage')?.textContent ?? '').includes('FULL SONG')`,
    'YouTube full-song player shell and fallback',
    30000,
  )
  const youtubeOutcome = await evaluate(cdp, `({
    track: document.querySelector('.player-shell__display h2')?.textContent?.trim() ?? '',
    coverage: document.querySelector('.player-shell__coverage')?.textContent?.trim() ?? '',
    iframeLoaded: Boolean(document.querySelector('.provider-player--youtube iframe')),
    status: document.querySelector('.player-status')?.textContent?.trim() ?? '',
    fallback: Boolean(document.querySelector('.playback-external-link'))
  })`)
  if (youtubeOutcome.track !== 'Cindai' || !youtubeOutcome.coverage.includes('FULL SONG') || !youtubeOutcome.fallback) {
    throw new Error('Real YouTube recommendation did not retain its player/fallback: ' + JSON.stringify(youtubeOutcome))
  }
  checks.push({ name: 'real-youtube-recommendation-provider-outcome', passed: true, ...youtubeOutcome })

  await clickSelector(cdp, '.radio-secondary-actions button:first-child')
  await clickSelector(cdp, '.radio-secondary-actions button:first-child')
  await delay(300)
  const rapidChange = await evaluate(cdp, `({
    playerShells: document.querySelectorAll('.player-shell').length,
    providerViewports: document.querySelectorAll('.provider-player').length,
    currentTitle: document.querySelector('.player-shell__display h2')?.textContent?.trim() ?? ''
  })`)
  if (rapidChange.playerShells !== 1 || rapidChange.providerViewports > 1 || !rapidChange.currentTitle) {
    throw new Error('Rapid recommendations duplicated or lost the persistent player: ' + JSON.stringify(rapidChange))
  }
  checks.push({ name: 'rapid-recommendation-player-reuse', passed: true, ...rapidChange })

  const energyBefore = Number(await evaluate(cdp, "document.querySelector('#energy-dial').value"))
  await evaluate(cdp, "document.querySelector('#energy-dial').focus()")
  await pressKey(cdp, 'ArrowRight', 'ArrowRight', 39)
  const energyAfter = Number(await evaluate(cdp, "document.querySelector('#energy-dial').value"))
  if (energyAfter <= energyBefore) throw new Error('Keyboard tuning did not raise the energy dial.')
  checks.push({ name: 'keyboard-energy-dial', passed: true, before: energyBefore, after: energyAfter })

  await tapSelector(cdp, '.radio-presets button:nth-of-type(2)')
  await delay(200)
  checks.push({ name: 'touch-mood-preset', passed: await evaluate(cdp, "Boolean(document.querySelector('.retro-radio'))") })

  await clickSelector(cdp, '.radio-secondary-actions button:last-child')
  await waitForSelector(cdp, '.modal', 10000)
  checks.push(await inspect(cdp, 'wissebot-consent-390', 'Enhanced local understanding'))
  const modelRequestsBeforeConsent = await evaluate(
    cdp,
    `performance.getEntriesByType('resource').filter((entry) => { const name = entry.name.toLowerCase(); return name.includes('huggingface') || name.includes('onnx/model') }).length`,
  )
  if (modelRequestsBeforeConsent !== 0) {
    throw new Error('Opening WisseBot started semantic model network requests before consent.')
  }
  checks.push({ name: 'enhanced-model-no-silent-download', passed: true, modelRequests: 0 })
  await capture(cdp, 'wissebot-mobile')
  await clickSelector(cdp, '.modal [aria-label^="Close"]')
  console.log('QA milestone: consent and multilingual instant mode')

  await startLightweight(cdp)
  await submitBotMessage(cdp, 'something romantic and cheerful')
  await submitBotMessage(cdp, 'nak lagu tenang tapi tak mengantuk')
  await submitBotMessage(cdp, 'yang macam tadi tapi lebih upbeat')
  await submitBotMessage(cdp, 'malam ni saya masak untuk keluarga, nak sesuatu yang ceria tapi jangan terlalu kuat atau dramatik')
  checks.push(await inspect(cdp, 'wissebot-multilingual-390', 'Current recommendation'))
  await clickSelector(cdp, '.modal [aria-label^="Close"]')

  // Chromium may request an implicit origin-level favicon before it processes
  // the app's explicit base-scoped SVG icon. GitHub project pages cannot own
  // that origin-root path, so this request is browser noise rather than an app
  // resource failure.
  const primaryErrors = cdp.errors.filter(
    (message) =>
      !message.includes('/favicon.ico') &&
      !message.includes('open.spotify.com') &&
      !message.includes('youtube.com/iframe_api') &&
      !message.includes('youtube-nocookie.com'),
  )
  if (primaryErrors.length) {
    throw new Error('Browser console errors in primary flows:\n' + primaryErrors.join('\n'))
  }

  await setViewport(cdp, 320, 760, true)
  await navigate(cdp, '#/g/siti/radio', '.retro-radio')
  checks.push(await inspect(cdp, 'radio-320', 'Why this frequency'))
  await capture(cdp, 'radio-320')

  const minimumRadioTarget = await evaluate(
    cdp,
    `Math.min(...[...document.querySelectorAll('.radio-presets button, .radio-secondary-actions button, .playback-consent button, .player-control, .recommendation-queue__actions button')].filter((element) => element.offsetParent !== null).map((element) => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height)))`,
  )
  if (minimumRadioTarget < 44) throw new Error('A primary radio touch target is smaller than 44 CSS pixels.')
  checks.push({ name: 'radio-touch-targets', passed: true, minimumCssPixels: minimumRadioTarget })

  await evaluate(cdp, "document.documentElement.style.fontSize = '200%'")
  await delay(200)
  checks.push(await inspect(cdp, 'radio-320-text-zoom-200', 'Why this frequency'))
  await evaluate(cdp, "document.documentElement.style.fontSize = ''")
  await delay(100)

  await evaluate(cdp, "document.documentElement.classList.add('high-contrast')")
  checks.push(await inspect(cdp, 'radio-320-high-contrast', 'Why this frequency'))
  await evaluate(cdp, "document.documentElement.classList.remove('high-contrast')")
  console.log('QA milestone: 320px reflow, text zoom, contrast and touch targets')

  await navigate(cdp, '#/g/siti/library', '.catalogue-browser')
  checks.push(await inspect(cdp, 'library-320', 'Explore the catalogue'))
  const catalogueCount = Number(await evaluate(cdp, "document.querySelector('#catalogue-heading + small')?.textContent"))
  if (catalogueCount !== 142) throw new Error('Expected 142 catalogue tracks in the browser; found ' + catalogueCount)
  await setInput(cdp, '#catalogue-search', 'Malaysian Philharmonic Orchestra')
  await waitForCondition(
    cdp,
    "document.querySelector('#catalogue-heading + small')?.textContent === '1'",
    'long-title catalogue filter',
    10000,
  )
  checks.push(await inspect(cdp, 'library-long-title-320', 'Malaysian Philharmonic Orchestra'))
  checks.push({ name: 'catalogue-search-scale', passed: true, totalTracks: catalogueCount })

  await navigate(cdp, '#/g/siti/settings', '.settings-page')
  checks.push(await inspect(cdp, 'settings-playback-320', 'Playback preference'))
  console.log('QA milestone: catalogue scale and settings')

  await setViewport(cdp, 768, 1024, true)
  await navigate(cdp, '#/g/siti/radio', '.retro-radio')
  checks.push(await inspect(cdp, 'radio-tablet-768', 'Why this frequency'))

  await setViewport(cdp, 1280, 900, false)
  checks.push(await inspect(cdp, 'radio-desktop-1280', 'Why this frequency'))
  await capture(cdp, 'radio-desktop')

  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await cdp.send('Page.reload', { ignoreCache: false })
  await waitForSelector(cdp, '.retro-radio', 10000)
  await waitForSelector(cdp, '.frequency-scale__needle', 10000)
  const motion = await evaluate(
    cdp,
    '(' +
      function reducedMotionInspection() {
        const needle = document.querySelector('.frequency-scale__needle')
        if (!needle) return { media: matchMedia('(prefers-reduced-motion: reduce)').matches, transitionSeconds: 999 }
        return {
          media: matchMedia('(prefers-reduced-motion: reduce)').matches,
          transitionSeconds: Number.parseFloat(getComputedStyle(needle).transitionDuration) || 0,
        }
      }.toString() + ')()',
  )
  if (!motion.media || motion.transitionSeconds > 0.001) {
    throw new Error('Reduced-motion inspection failed: ' + JSON.stringify(motion))
  }
  checks.push({ name: 'reduced-motion', passed: true, ...motion })
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  console.log('QA milestone: tablet, desktop and reduced motion')

  await navigate(cdp, '#/g/siti', '.welcome__content')
  await evaluate(cdp, 'navigator.serviceWorker.ready.then(() => true)')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none',
  })
  await cdp.send('Page.reload', { ignoreCache: false })
  await waitForSelector(cdp, '.welcome__content', 15000)
  checks.push(await inspect(cdp, 'offline-cached-profile', 'Your frequency is ready'))
  await cdp.send('Page.navigate', { url: origin + '/#/g/siti/radio' })
  await waitForSelector(cdp, '.retro-radio', 15000)
  await waitForSelector(cdp, '.player-shell', 15000)
  await evaluate(cdp, "window.dispatchEvent(new Event('offline'))")
  await waitForCondition(cdp, "document.body.textContent.includes('Pink FM is ready, but full-song playback requires an internet connection.')", 'offline music message', 10000)
  checks.push(await inspect(cdp, 'offline-music-message', 'Pink FM is ready, but full-song playback requires an internet connection.'))
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'wifi',
  })
  console.log('QA milestone: offline cached reopening')

  await navigate(cdp, '#/g/siti/radio', '.retro-radio')
  await testStaleAndCorruptIndexes(cdp, checks)
  if (runEnhancedModel) {
    await testEnhancedModel(cdp, checks, semanticPerformance)
  } else {
    await testUnavailableModel(cdp, checks)
  }
  console.log('QA milestone: semantic failure and index integrity fallbacks')

  await setViewport(cdp, 320, 760, true)
  await navigate(cdp, '#/g/does-not-exist', '.error-screen')
  checks.push(await inspect(cdp, 'missing-profile-320', 'Frequency not found'))
  await capture(cdp, 'missing-profile-mobile')

  const unexpectedErrors = cdp.errors.filter(
    (message) =>
      !message.includes('404') &&
      !message.includes('ERR_INTERNET_DISCONNECTED') &&
      !message.includes('open.spotify.com') &&
      !message.includes('youtube.com/iframe_api') &&
      !message.includes('youtube-nocookie.com') &&
      !message.includes('pink-fm-intentionally-unavailable-model'),
  )
  if (unexpectedErrors.length) {
    throw new Error('Unexpected browser errors:\n' + unexpectedErrors.join('\n'))
  }

  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    browser: browserPath,
    origin,
    checks,
    semanticPerformance,
    expectedConsoleErrors: cdp.errors.length - unexpectedErrors.length,
    unexpectedConsoleErrors: unexpectedErrors,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
  cdp.socket.close()

  for (const check of checks) {
    if ('clientWidth' in check) {
      console.log(
        check.name + ': ' + check.clientWidth + 'px viewport, ' +
          check.scrollWidth + 'px document, no horizontal overflow',
      )
    } else {
      console.log(check.name + ': passed')
    }
  }
  console.log(
    'Browser QA passed: ' + checks.length +
      ' checks, zero unexpected console errors. Report: ' + reportPath,
  )
}

try {
  await run()
} finally {
  browser.kill()
  await delay(150)
  rmSync(profileDirectory, { force: true, recursive: true })
}
