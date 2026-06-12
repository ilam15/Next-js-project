import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8fa]">
      <section className="flex flex-1 items-center justify-center border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <p className="font-mono text-sm font-medium text-[#2f8d46]">
            // your javascript journey starts here
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#1a1a1a] sm:text-5xl">
            JavaScript Learning Platform
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#5b6573]">
            Learn core JavaScript concepts through short, focused lessons,
            then test what you&apos;ve learned with quick quizzes.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/learn"
              className="w-full rounded-md bg-[#2f8d46] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#268039] sm:w-auto"
            >
              📚 Start Learning
            </Link>
            <Link
              href="/quiz"
              className="w-full rounded-md border border-[#e2e8f0] bg-white px-6 py-3 text-sm font-semibold text-[#1a1a1a] transition-colors hover:border-[#2f8d46] hover:text-[#2f8d46] sm:w-auto"
            >
              📝 Take Quiz
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}