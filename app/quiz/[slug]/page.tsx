import { quizzes } from "../../lib/quizzes";



export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const quiz = quizzes.find((q) => q.slug === slug);

  if (!quiz) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Quiz Not Found</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-8 text-4xl font-bold text-[#1a1a1a]">
        {quiz.title}
      </h1>

      {quiz.questions.map((q, index) => (
        <div
          key={index}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {index + 1}. {q.question}
          </h2>

          <div className="space-y-3">
            {q.options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name={`question-${index}`}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button className="rounded-md bg-[#2f8d46] px-6 py-3 font-medium text-white hover:bg-[#26753a]">
        Submit Quiz
      </button>
    </div>
  );
}