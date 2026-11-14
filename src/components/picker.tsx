import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
type Item = { value: string; label: string };
export function Picker({
  label,
  value,
  onChange,
  items,
  placeholder = "Choose…",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Item[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(value) => {
        if (value !== null) onChange(value);
      }}
      items={items}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
