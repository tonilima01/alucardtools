interface Props {
  show: boolean;
  title: string;
  text?: string;
  progress?: number;
}

export function LoadingOverlay({ show, title, text, progress = 0 }: Props) {
  if (!show) return null;
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-title">{title}</div>
        <div className="loading-subtitle">{text || "Preparando visualização..."}</div>
        <div className="loading-bar"><span style={{ width: `${safeProgress}%` }} /></div>
        <div className="loading-percent">{safeProgress}%</div>
      </div>
    </div>
  );
}
