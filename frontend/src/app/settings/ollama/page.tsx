import { redirect } from "next/navigation";

export default function OllamaPage() {
  redirect("/settings/llm-providers");
}
