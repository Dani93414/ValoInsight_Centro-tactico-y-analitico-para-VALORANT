import type { ReactNode } from "react";
import BackButton from "../components/BackButton";

type ContentShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ContentShell({
  eyebrow = "Valorant",
  title,
  subtitle,
  children,
}: ContentShellProps) {
  return (
    <main className="content-page">
      <BackButton />
      <header className="content-header">
        <span className="content-eyebrow">{eyebrow}</span>
        <h1 className="content-title">{title}</h1>
        <div className="content-divider" />
        {subtitle && <p className="content-subtitle">{subtitle}</p>}
      </header>
      {children}
    </main>
  );
}

export function ContentLoading({
  title = "Cargando contenido",
  message = "Preparando datos...",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="loading-spinner" />
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function ContentError({
  title = "No se pudo cargar",
  message = "Ha fallado la carga de contenido.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="content-state-card content-state-card--error">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button className="content-primary-btn" type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function ContentEmpty({
  message = "No hay contenido disponible.",
}: {
  message?: string;
}) {
  return (
    <div className="content-state-card">
      <h2>Sin resultados</h2>
      <p>{message}</p>
    </div>
  );
}

export function ContentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="content-section">
      <h2 className="content-section-title">{title}</h2>
      {children}
    </section>
  );
}
