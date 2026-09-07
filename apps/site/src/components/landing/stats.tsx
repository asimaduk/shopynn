import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });

  useEffect(() => { if (inView) mv.set(to); }, [inView, to, mv]);
  useEffect(() => spring.on("change", (v) => {
    if (ref.current) ref.current.textContent = Math.round(v).toLocaleString() + suffix;
  }), [spring, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const stats = [
  { v: 4000, s: "+", l: "Active stores" },
  { v: 12, s: "M+", l: "Orders processed" },
  { v: 99, s: ".99%", l: "Uptime SLA" },
  { v: 60, s: "+", l: "Countries" },
];

export function Stats() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 rounded-[5px] glass p-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.l}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <div className="font-display text-3xl sm:text-4xl font-semibold text-gradient">
                <Counter to={s.v} suffix={s.s} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground uppercase tracking-widest">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
