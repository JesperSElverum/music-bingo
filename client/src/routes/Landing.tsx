import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";

export default function Landing() {
  return (
    <div className="mt-8 sm:mt-16 flex flex-col items-center text-center gap-6">
      <h1 className="headline text-4xl sm:text-6xl">
        <span className="bg-clip-text  bg-gradient-to-r from-accent to-accent-2">
          Music Bingo
        </span>
      </h1>
      <p className="text-muted max-w-md">
        Spin up a Spotify playlist, hand out boards, and yell <em>bingo</em>{" "}
        when the right song hits.
      </p>
      <GlassCard className="w-full max-w-sm mt-4">
        <div className="flex flex-col gap-3">
          <Link to="/create" className="btn btn-primary w-full">
            Create a game
          </Link>
          <Link to="/join" className="btn btn-ghost w-full">
            Join with a room code
          </Link>
        </div>
      </GlassCard>
      <p className="text-xs text-muted mt-2 max-w-sm">
        Hosts need Spotify Premium (for Web Playback). Players just need a phone
        and a name.
      </p>
    </div>
  );
}
