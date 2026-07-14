import { nav } from '../../app'

export function Tabs({ active }: { active: 'home' | 'history' | 'charts' }) {
  return (
    <nav class="tabs">
      <button class={active === 'home' ? 'on' : ''} onClick={() => nav('/')}>
        <span class="ic">▤</span>Workouts
      </button>
      <button class={active === 'history' ? 'on' : ''} onClick={() => nav('/history')}>
        <span class="ic">≣</span>History
      </button>
      <button class={active === 'charts' ? 'on' : ''} onClick={() => nav('/charts')}>
        <span class="ic">◭</span>Progress
      </button>
    </nav>
  )
}
