import { useState } from 'preact/hooks'

const DISMISS_KEY = 'wlog_install_hint_dismissed'

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}
function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * iOS never prompts to install a web app — guide the user through the manual
 * Share -> Add to Home Screen path. Shown only on iOS, only in the browser
 * (never once installed), dismissible for good.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(localStorage.getItem(DISMISS_KEY) === '1')
  if (dismissed || !isIos() || isStandalone()) return null
  return (
    <div class="installhint">
      <div class="t">Install this app on your phone</div>
      <div class="m">
        {/iPhone|iPad|iPod/.test(navigator.userAgent) && /FxiOS/.test(navigator.userAgent) ? (
          <>
            Open the <b>menu</b>, tap <b>Share</b>, then <b>“Add to Home Screen”</b>.
          </>
        ) : (
          <>
            Tap <b>Share</b> <span aria-hidden="true">(the ⬆︎ square below)</span> and then{' '}
            <b>“Add to Home Screen”</b>.
          </>
        )}{' '}
        You get an app icon, full screen, and it works without internet at the gym.
      </div>
      <button
        class="dismiss"
        aria-label="Dismiss install hint"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDismissed(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}
