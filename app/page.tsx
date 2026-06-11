import { redirect } from "next/navigation";

export default function Home() {
  // The proxy bounces signed-out visitors to /login.
  redirect("/dashboard");
}
