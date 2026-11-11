import { redirect } from "next/navigation";
import { CONFIG } from "@/lib/config";

export default function Home() {
  redirect(CONFIG.ROUTES.LOGIN);
}