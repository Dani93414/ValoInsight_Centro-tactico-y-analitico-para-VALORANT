import "./FloatingActionButton.css";

type Props = {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
};

export default function FloatingActionButton({
  label,
  onClick,
  ariaLabel,
  className,
}: Props) {
  return (
    <button
      type="button"
      className={`floating-action-button${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </button>
  );
}
