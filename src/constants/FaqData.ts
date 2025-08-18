import { TypeFaqItem } from "@/types/TypeContent";

export const FaqData: TypeFaqItem[] = [
  {
    value: "faq-1",
    question: "Is Inquora really free to use right now?",
    answer:
      "Yes! Inquora is completely free to use during our public beta phase. We want to gather feedback and build the best product possible with the help of our early users. We will provide plenty of notice before introducing any pricing.",
  },
  {
    value: "faq-2",
    question: "How secure is my data when I upload it?",
    answer:
      "Security is our top priority. Your data is encrypted both in transit and at rest. We use secure cloud infrastructure and Supabase for authentication, ensuring that only you have access to your documents and conversations.",
  },
  {
    value: "faq-3",
    question: "What file types can I use with Inquora?",
    answer:
      "You can upload a wide variety of formats, including PDFs, Microsoft Office documents (Word, PowerPoint, Excel), and even provide URLs to websites or YouTube videos for analysis. We are constantly expanding our support for new formats.",
  },
  {
    value: "faq-4",
    question: "Are there any limits on uploads or questions?",
    answer:
      "During the free beta period, there are no hard limits on the number of documents you can upload or the number of questions you can ask. We encourage you to use the platform as much as you need.",
  },
  {
    value: "faq-5",
    question: "Do you use my data to train your AI models?",
    answer:
      "Absolutely not. Your data is yours alone. We do not use any of your documents, conversations, or personal information to train our or any third-party AI models. Your privacy is paramount.",
  },
];
