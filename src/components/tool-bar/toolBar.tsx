import { ToolButton, ToolButtonProps } from "./toolButton";

type ToolBarProps = {
  title: string;
  items: ToolButtonProps[];
};

export const ToolBar = ({ title, items }: ToolBarProps) => {
  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800/95 shadow-2xl backdrop-blur-sm">
      <div className="border-b border-neutral-700 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          {title}
        </span>
      </div>
      <div className="flex gap-0.5 p-1.5">
        {items.map((item) => (
          <ToolButton
            icon={item.icon}
            label={item.label}
            description={item.description}
            onClick={item.onClick}
            accent={item.accent}
          />
        ))}
      </div>
    </div>
  );
};
