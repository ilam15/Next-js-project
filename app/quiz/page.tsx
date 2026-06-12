import Link from "next/link";
import { quizzes } from "../lib/quizzes";




export default function QuizPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      {/* Hero Section */}
      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="font-mono text-sm font-medium text-[#2f8d46]">
            // test what you've learned
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#1a1a1a] sm:text-5xl">
            JavaScript Quizzes
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-[#5b6573]">
            Pick a topic and answer a few quick questions to check your
            understanding.
          </p>
        </div>
      </section>

      {/* Quiz Cards */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-xl font-semibold text-[#1a1a1a]">
          Available Quizzes
        </h2>

        <p className="mt-1 text-sm text-[#5b6573]">
          {quizzes.length} quizzes · pick one to begin
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz, index) => (
            <Link
              key={quiz.slug}
              href={`/quiz/${quiz.slug}`}
              className="group flex flex-col rounded-lg border border-[#e2e8f0] bg-white p-5 transition-all hover:-translate-y-1 hover:border-[#2f8d46] hover:shadow-md"
            >
              <span className="font-mono text-xs font-semibold text-[#2f8d46]">
                {String(index + 1).padStart(2, "0")}
              </span>

              <h3 className="mt-2 text-lg font-semibold text-[#1a1a1a] group-hover:text-[#2f8d46]">
                {quiz.title}
              </h3>

              <p className="mt-2 text-sm text-[#5b6573]">
                {quiz.questions.length} question(s)
              </p>

              <span className="mt-4 text-sm font-medium text-[#2f8d46]">
                Start Quiz →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

