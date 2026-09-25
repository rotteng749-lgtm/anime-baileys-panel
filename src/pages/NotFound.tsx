import { KaizenMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Home, Terminal } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div className="anime-grid pointer-events-none absolute inset-0 opacity-60" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative text-center"
      >
        <div className="flex justify-center">
          <KaizenMark size={60} />
        </div>

        <p className="mt-8 font-mono text-7xl font-bold text-glow sm:text-8xl">
          <span className="gradient-text">404</span>
        </p>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          This route never got a socket
        </h1>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
          The page you asked for is not on this node. Head back to the deck or
          open the console.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/">
              <Home className="size-4" />
              Back to home
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/panel/console">
              <Terminal className="size-4" />
              Open console
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
