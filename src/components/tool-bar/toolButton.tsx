export type ToolButtonProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accent: string;
};

export const ToolButton = ({
  icon,
  label,
  description,
  onClick,
  accent,
}: ToolButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-neutral-700/60 active:scale-95"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accent}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-neutral-200">
          {label}
        </span>
        <span className="block text-[10px] text-neutral-500">
          {description}
        </span>
      </span>
    </button>
  );
};
