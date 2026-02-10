import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import { QueryProvider } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "RSS Reader",
  description: "Personal RSS reader with LLM-powered content curation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${lora.variable}`}>
        <Provider defaultTheme="dark">
          <QueryProvider>{children}</QueryProvider>
        </Provider>
      </body>
    </html>
  );
}
