import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { initSync } from './sync/engine'
import './ui/styles.css'

registerSW({ immediate: true })
navigator.storage?.persist?.().catch(() => {})
initSync()

render(<App />, document.getElementById('app')!)
