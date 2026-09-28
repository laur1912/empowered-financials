import { isAuthed, passwordConfigured } from "@/lib/auth";
import Login from "@/components/Login";
import Planner from "@/components/Planner";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isAuthed())) return <Login configured={passwordConfigured()} />;
  return <Planner />;
}
