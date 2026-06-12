import { topics } from "../../lib/topics";



export default function LearnSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const topic = topics.find((t) => t.slug === params.slug);

  if (!topic) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Lesson Not Found</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-4xl font-bold text-[#1a1a1a]">{topic.title}</h1>
      <p className="text-[#5b6573]">{topic.content}</p>
    </div>
  );
}

