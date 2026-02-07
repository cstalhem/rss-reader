import AppShell from "@/components/layout/AppShell";
import { ArticleList } from "@/components/article/ArticleList";

export default function Home() {
  return (
    <AppShell>
      <ArticleList />
    </AppShell>
  );
}
