import React from "react";
import { TypeSectionHeaderProps } from "@/types/ui";

/**
 * A reusable component for displaying a consistent header for various sections of a webpage.
 *
 * It consists of a smaller subtitle and a larger main title, both of which can be
 * customized via props.
 *
 * @component
 * @param {TypeSectionHeaderProps} props - The properties for the component.
 * @param {string} [props.subtitle="FAQ"] - The text content for the subtitle.
 * @param {string} [props.title="You might have a question?"] - The text content for the main title.
 * @param {string} [props.subtitleClassName] - Optional CSS classes to apply to the subtitle element.
 * @param {string} [props.titleClassName] - Optional CSS classes to apply to the title element.
 * @returns {JSX.Element} The rendered section header.
 */
const SectionHeader = ({
  subtitle = "FAQ",
  title = "You might have a question?",
  subtitleClassName = "text-primary text-center mb-4 text-2xl tracking-tight",
  titleClassName = "text-center text-4xl md:text-5xl font-semibold tracking-tighter mb-36",
}: TypeSectionHeaderProps) => {
  return (
    <>
      <p className={subtitleClassName}>{subtitle}</p>
      <h1 className={titleClassName}>{title}</h1>
    </>
  );
};

export default SectionHeader;
