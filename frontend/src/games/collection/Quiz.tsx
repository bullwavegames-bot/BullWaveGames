import { useState } from "react";
import { QUESTIONS } from "../../../shared/questions.mjs";
import { finish, GameFrame, shuffle, type Props } from "./common";
export function Quiz({
  api,
  paused,
  topic,
}: Props & { topic: "general" | "sports" | "movies" }) {
  const [questions] = useState(() => shuffle(QUESTIONS[topic]).slice(0, 10));
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[round];
  return (
    <GameFrame
      title="Trivia quiz"
      paused={paused}
      status={`Question ${round + 1}/${questions.length} · Score ${score}`}
    >
      <progress value={round} max={questions.length} />
      <h2 className="quiz-question">{q[0]}</h2>
      <div className="quiz-options">
        {q[1].map((option, i) => (
          <button
            className={`quiz-option ${answer !== null ? (i === q[2] ? "correct-answer" : i === answer ? "wrong-answer" : "") : ""}`}
            key={option}
            disabled={answer !== null}
            onClick={() => {
              setAnswer(i);
              if (i === q[2]) setScore(score + 100);
            }}
          >
            <span>{"ABCD"[i]}</span>
            {option}
          </button>
        ))}
      </div>
      {answer !== null ? (
        <div aria-live="polite">
          <p>
            {answer === q[2] ? "Correct!" : `Correct answer: ${q[1][q[2]]}`}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (round === questions.length - 1)
                finish(
                  api,
                  score,
                  score >= 600,
                  `${score / 100}/${questions.length} correct`,
                );
              else {
                setRound(round + 1);
                setAnswer(null);
              }
            }}
          >
            {round === questions.length - 1 ? "See results" : "Next question →"}
          </button>
        </div>
      ) : null}
    </GameFrame>
  );
}
