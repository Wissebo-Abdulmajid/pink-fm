import { HashRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { UpdateAvailable } from '../components/feedback/UpdateAvailable'

export function App() {
  return (
    <HashRouter>
      <AppRouter />
      <UpdateAvailable />
    </HashRouter>
  )
}
