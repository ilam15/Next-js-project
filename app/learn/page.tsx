import Link from "next/link";
import { topics } from "../lib/topics";

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      {/* Hero */}
      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="font-mono text-sm font-medium text-[#2f8d46]">
            // learn javascript step by step
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#1a1a1a] sm:text-5xl">
            JavaScript, explained simply
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[#5b6573]">
            A free, structured course covering everything from your first
            variable to advanced concepts &mdash; with short lessons you can
            finish in one sitting.
          </p>
          <div className="mt-8">
            <Link
              href={`/learn/${topics[0]?.slug}`}
              className="inline-block rounded-md bg-[#2f8d46] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#268039]"
            >
              Start learning
            </Link>
          </div>
        </div>
      </section>

      {/* Topic list */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-xl font-semibold text-[#1a1a1a]">Course modules</h2>
        <p className="mt-1 text-sm text-[#5b6573]">
          {topics.length} lessons &middot; go in order or jump to what you need
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {topics.map((topic, index) => (
            <Link
              key={topic.slug}
              href={`/learn/${topic.slug}`}
              className="group flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#2f8d46] hover:shadow-md"
            >
              <span className="font-mono text-xs font-semibold text-[#2f8d46]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-[#1a1a1a] group-hover:text-[#2f8d46]">
                {topic.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-[#5b6573]">
                {topic.content}
              </p>
              <span className="mt-4 text-sm font-medium text-[#2f8d46]">
                Read lesson &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}