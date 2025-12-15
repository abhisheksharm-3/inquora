// src/components/shared/MarkdownRenderer.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/atom-one-dark.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert break-words break-all ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Custom styling for code blocks
          code: ({ children, className, ...props }) => {
            const isInline = !className?.includes("language-");
            return isInline ? (
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className={`${className} block rounded-md bg-muted p-4 text-sm overflow-x-auto text-foreground`}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom styling for pre blocks
          pre: ({ children }) => (
            <pre className="rounded-md bg-muted p-4 overflow-x-auto">
              {children}
            </pre>
          ),
          // Custom styling for blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          ),
          // Custom styling for tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">{children}</td>
          ),
          // Custom styling for lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2">
              {children}
            </ol>
          ),
          // Custom styling for headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-4 mt-6 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mb-3 mt-5 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-4 text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 mt-3 text-foreground">
              {children}
            </h4>
          ),
          // Custom styling for paragraphs
          p: ({ children }) => (
            <p className="mb-3 text-foreground leading-relaxed">{children}</p>
          ),
          // Custom styling for links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:text-primary/80 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Custom styling for horizontal rules
          hr: () => <hr className="my-6 border-border" />,
          // Custom styling for strong text
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          // Custom styling for emphasis
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
