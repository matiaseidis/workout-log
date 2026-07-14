import { Route, Router, Switch } from 'wouter-preact'
import { useHashLocation } from 'wouter-preact/use-hash-location'
import { useProfile } from './hooks/useProfile'
import { ActiveSession } from './ui/screens/ActiveSession'
import { Celebrate } from './ui/screens/Celebrate'
import { Charts } from './ui/screens/Charts'
import { History } from './ui/screens/History'
import { Peek } from './ui/screens/Peek'
import { PickWorkout } from './ui/screens/PickWorkout'
import { ProfileSetup } from './ui/screens/ProfileSetup'
import { RoutineEditor } from './ui/screens/RoutineEditor'
import { Settings } from './ui/screens/Settings'
import { SessionDetail } from './ui/screens/SessionDetail'
import { Summary } from './ui/screens/Summary'

/** Hash navigation helper — usable from event handlers anywhere. */
export const nav = (to: string) => {
  location.hash = to
}

export function App() {
  const profile = useProfile()
  if (profile === undefined) return <div class="app" /> // loading — avoid setup flash
  if (profile === null)
    return (
      <div class="app">
        <ProfileSetup />
      </div>
    )
  return (
    <Router hook={useHashLocation}>
      <div class="app">
        <Switch>
          <Route path="/routine/new">{() => <RoutineEditor />}</Route>
          <Route path="/routine/:id">{(p) => <RoutineEditor id={p!.id} />}</Route>
          <Route path="/session/:id/peek/:peekId">{(p) => <Peek id={p!.id} peekId={p!.peekId} />}</Route>
          <Route path="/session/:id">{(p) => <ActiveSession id={p!.id} />}</Route>
          <Route path="/celebrate/:id">{(p) => <Celebrate id={p!.id} />}</Route>
          <Route path="/summary/:id">{(p) => <Summary id={p!.id} />}</Route>
          <Route path="/settings">{() => <Settings />}</Route>
          <Route path="/history">{() => <History />}</Route>
          <Route path="/detail/:id">{(p) => <SessionDetail id={p!.id} />}</Route>
          <Route path="/charts">{() => <Charts />}</Route>
          <Route>{() => <PickWorkout />}</Route>
        </Switch>
      </div>
    </Router>
  )
}
