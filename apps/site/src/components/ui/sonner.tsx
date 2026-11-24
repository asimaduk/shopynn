import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-sm group-[.toast]:opacity-90",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-950 group-[.toaster]:border-emerald-200 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-50 dark:group-[.toaster]:border-emerald-800",
          error:
            "group-[.toaster]:bg-red-50 group-[.toaster]:text-red-950 group-[.toaster]:border-red-200 dark:group-[.toaster]:bg-red-950 dark:group-[.toaster]:text-red-50 dark:group-[.toaster]:border-red-800",
          warning:
            "group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-950 group-[.toaster]:border-amber-200 dark:group-[.toaster]:bg-amber-950 dark:group-[.toaster]:text-amber-50 dark:group-[.toaster]:border-amber-800",
          info: "group-[.toaster]:bg-sky-50 group-[.toaster]:text-sky-950 group-[.toaster]:border-sky-200 dark:group-[.toaster]:bg-sky-950 dark:group-[.toaster]:text-sky-50 dark:group-[.toaster]:border-sky-800",
          loading:
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
