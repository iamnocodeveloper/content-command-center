import { redirect } from "next/navigation";

/** La raíz entra directo a la primera sección del dashboard. */
export default function Home() {
  redirect("/hooks");
}
