import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebAudit · Auditoría de sitios web",
  description:
    "Auditá cualquier sitio web: SEO, performance, accesibilidad, seguridad y código. Reporte con puntaje y recomendaciones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
