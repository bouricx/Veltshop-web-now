import { useState, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-md bg-bg px-3 text-sm text-fg shadow-border outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "number" && props.value !== undefined && props.onChange) {
    return <EditableNumberInput className={className} {...props} />;
  }
  return <input className={cn(field, className)} {...props} />;
}

// Keep what the person is typing separately from the numeric form model.
// Number("") is 0, but deleting a field must leave its visible text empty.
function EditableNumberInput({ className, value, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const model = String(value ?? "");
  const [edit, setEdit] = useState(() => ({ model, text: model }));
  if (model !== edit.model) setEdit({ model, text: model });
  return (
    <input
      {...props}
      className={cn(field, className)}
      value={model === edit.model ? edit.text : model}
      onChange={(event) => {
        const text = event.target.value;
        setEdit({ model: String(Number(text)), text });
        onChange?.(event);
      }}
    />
  );
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md bg-bg px-3 py-2 text-sm text-fg shadow-border outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}
