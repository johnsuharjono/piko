import { useState } from "react";
import { LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { useProjects } from "../projects/provider";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
export function AccountMenu() {
  const projects = useProjects();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const action = async (run: () => Promise<void>) => {
    setError("");
    setPending(true);
    try {
      await run();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete that action.",
      );
    } finally {
      setPending(false);
    }
  };
  if (projects.status === "connecting")
    return (
      <span className="account-connecting" role="status">
        Connecting…
      </span>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="account-trigger"
            aria-label="Account"
          />
        }
      >
        <UserRound size={16} />
        <span>
          {projects.viewer?.anonymous
            ? "Guest"
            : projects.viewer?.name || "Account"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="account-menu">
        {projects.viewer?.anonymous && (
          <p className="account-note">
            Saved to your guest workspace. Sign in for access on other devices.
            Clearing cookies removes guest access.
          </p>
        )}
        {!projects.viewer?.anonymous && projects.viewer && (
          <p className="account-note">{projects.viewer.name}</p>
        )}
        {(error || projects.error) && (
          <p className="account-note account-error" role="alert">
            {error || projects.error}
          </p>
        )}
        {(!projects.viewer || projects.viewer.anonymous) && (
          <DropdownMenuItem
            closeOnClick={false}
            disabled={pending || !projects.viewer?.githubEnabled}
            onClick={() => void action(projects.signIn)}
          >
            <LogIn />
            Sign in with GitHub
          </DropdownMenuItem>
        )}
        {projects.viewer?.anonymous && !projects.viewer.githubEnabled && (
          <p className="account-note">
            GitHub sign-in is not configured yet. Guest projects still save
            automatically.
          </p>
        )}
        {projects.status === "error" && (
          <DropdownMenuItem onClick={projects.retry}>
            <RefreshCw />
            Reconnect
          </DropdownMenuItem>
        )}
        {projects.viewer && !projects.viewer.anonymous && (
          <DropdownMenuItem
            closeOnClick={false}
            disabled={pending}
            onClick={() => void action(projects.signOut)}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
