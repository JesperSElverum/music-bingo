import { Routes, Route, Link } from 'react-router-dom';
import Landing from './routes/Landing';
import CreateGame from './routes/CreateGame';
import HostRoom from './routes/HostRoom';
import JoinGame from './routes/JoinGame';
import PlayerRoom from './routes/PlayerRoom';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between">
        <Link to="/" className="headline text-xl tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-2">
            Music Bingo
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-4 sm:px-6 pb-6 max-w-3xl w-full mx-auto">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/host/:code" element={<HostRoom />} />
          <Route path="/join" element={<JoinGame />} />
          <Route path="/play/:code" element={<PlayerRoom />} />
        </Routes>
      </main>
    </div>
  );
}
