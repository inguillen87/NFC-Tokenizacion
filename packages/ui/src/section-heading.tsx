import * as React from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  level?: 1 | 2;
  titleClassName?: string;
};

export function SectionHeading({ eyebrow, title, description, level = 2, titleClassName = "" }: SectionHeadingProps) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <div className="max-w-3xl">
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
      <Heading className={`mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl ${titleClassName}`.trim()}>{title}</Heading>
      {description ? <p className="mt-4 text-base leading-7 text-slate-400">{description}</p> : null}
    </div>
  );
}
