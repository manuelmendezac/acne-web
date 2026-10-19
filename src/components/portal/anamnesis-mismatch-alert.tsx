import { Alert } from '@/components/ui/feedback';

/**
 * The questionnaire and the photograph disagree.
 *
 * The server derives the messages (`CaseDetailDto.anamnesisMismatch`) from what the model saw and
 * what the patient answered; this component only shows them, next to the suggestion they refer
 * to. It is a reason to look twice — at the photograph, at the patient, at the episode the
 * questionnaire describes — never a verdict (RNF-06).
 */
export function AnamnesisMismatchAlert({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert tone="danger" title="Incongruencia entre la anamnesis y la imagen">
      <ul className="space-y-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        Aviso informativo generado a partir de la evaluación asistida; la decisión es del
        profesional.
      </p>
    </Alert>
  );
}
